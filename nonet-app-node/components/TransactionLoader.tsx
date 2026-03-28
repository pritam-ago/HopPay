import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Colors } from "@/constants/theme";
import { useWallet } from "@/contexts/WalletContext";
import { useBle, submitTransactionToBlockchain } from "@/contexts/BleContext";
import { CONTRACT_CONFIG, TransactionPayload } from "@/constants/contracts";
import { ethers } from "ethers";

// Create transferWithAuthorization signature matching the deployed contract.
//
// The contract (EIPThreeDoubleZeroNine.sol) does:
//   bytes32 messageHash = keccak256(abi.encodePacked(from, to, value, validAfter, validBefore, nonce, address(this), block.chainid));
//   ECDSA.recover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)), signature)
//
// So we must sign with the same simple-hash approach, NOT EIP-712 signTypedData.
const createTransferWithAuthorizationSignature = async (
  from: string,
  to: string,
  value: string,
  validAfter: string,
  validBefore: string,
  nonce: string,
  contractAddress: string,
  chainId: number,
  privateKey: string
): Promise<string> => {
  try {
    console.log(
      "🔐 Creating transferWithAuthorization signature (EIP-712 signTypedData)..."
    );

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    console.log("Wallet address:", wallet.address);
    console.log("Expected from address:", from);

    // Verify the wallet address matches the from address
    if (wallet.address.toLowerCase() !== from.toLowerCase()) {
      throw new Error(
        `Wallet address mismatch: expected ${from}, got ${wallet.address}`
      );
    }

    // Ensure nonce is a valid 32-byte hex string
    let nonceBytes32: string;
    if (nonce.startsWith("0x")) {
      const nonceBytes = ethers.getBytes(nonce);
      if (nonceBytes.length !== 32) {
        throw new Error(`Nonce must be exactly 32 bytes, got ${nonceBytes.length} bytes`);
      }
      nonceBytes32 = nonce;
    } else {
      if (nonce.length !== 64) {
        throw new Error(`Nonce must be 64 hex characters, got ${nonce.length}`);
      }
      nonceBytes32 = "0x" + nonce;
    }

    console.log("📝 EIP-712 Signing parameters:", {
      from,
      to,
      value,
      validAfter,
      validBefore,
      nonce: nonceBytes32,
      contractAddress,
      chainId,
    });

    // EIP-712 domain — must match the deployed contract's domain separator
    const domain = {
      name: CONTRACT_CONFIG.TOKEN_NAME,    // "MESHT"
      version: CONTRACT_CONFIG.TOKEN_VERSION, // "1"
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    // EIP-3009 TransferWithAuthorization type
    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    // The message values
    const message = {
      from: from,
      to: to,
      value: BigInt(value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonceBytes32,
    };

    console.log("📝 EIP-712 Domain:", domain);

    // Sign using EIP-712 typed structured data
    const signature = await wallet.signTypedData(domain, types, message);

    console.log("✅ EIP-712 Signature created:", {
      signature,
      signatureLength: signature.length,
    });

    // Verify locally: recover signer from typed data
    try {
      const recoveredSigner = ethers.verifyTypedData(domain, types, message, signature);
      const isValid = recoveredSigner.toLowerCase() === from.toLowerCase();
      console.log("🔍 Signature verification:", { recoveredSigner, expectedSigner: from, isValid });
      if (!isValid) {
        throw new Error(`Signature verification failed: recovered ${recoveredSigner}, expected ${from}`);
      }
    } catch (verifyError) {
      console.warn("⚠️ Signature verification failed:", verifyError);
      throw verifyError;
    }

    return signature;
  } catch (error) {
    console.error("❌ Error creating signature:", error);
    throw new Error(`Failed to create transferWithAuthorization signature: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Transaction Flow Steps - Easily editable constants
const TRANSACTION_STEPS = [
  {
    id: 1,
    title: "Preparing Transaction",
    description: "Encrypting transaction payload with Web3 cryptography",
    icon: "🔐",
    duration: 2000,
  },
  {
    id: 2,
    title: "Scanning for Nearby Devices",
    description: "Looking for Bluetooth-enabled devices in mesh network",
    icon: "📡",
    duration: 3000,
  },
  {
    id: 3,
    title: "Hopping Through Network",
    description: "Relaying encrypted payload through offline mesh nodes",
    icon: "🔄",
    duration: 4000,
  },
  {
    id: 4,
    title: "Finding Internet Gateway",
    description: "Locating device with active internet connection",
    icon: "🌐",
    duration: 3500,
  },
  {
    id: 5,
    title: "Broadcasting Transaction",
    description: "Submitting to blockchain network via gateway device",
    icon: "🚀",
    duration: 2500,
  },
  {
    id: 6,
    title: "Transaction Confirmed",
    description: "Successfully broadcasted to the blockchain",
    icon: "✅",
    duration: 1000,
  },
];

const LOADING_MESSAGES = [
  "Preparing and signing transaction...",
  "Scanning for nearby mesh nodes...",
  "Routing through offline network...",
  "Finding internet gateway...",
  "Broadcasting to blockchain network...",
  "Transaction confirmed on blockchain!",
];

interface TransactionLoaderProps {
  onComplete: (fullMessage?: string) => void;
  onCancel?: () => void;
  transactionData?: {
    amount: string;
    currency: string;
    toAddress: string;
    chain: string;
    chainId: number;
    // UPI metadata from QR scan — wired through to relayer for Decentro INR payout
    upiId?: string;
    merchantName?: string;
    merchantPhone?: string; // for demo bank SMS
  };
}

export const TransactionLoader: React.FC<TransactionLoaderProps> = ({
  onComplete,
  onCancel,
  transactionData,
}) => {
  const { userWalletAddress, walletData } = useWallet();
  const { broadcastMessage, masterState, hasInternet } = useBle();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [broadcastId, setBroadcastId] = useState<number | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [shouldPauseFlow, setShouldPauseFlow] = useState(false);
  const [isWaitingForConfirmation, setIsWaitingForConfirmation] =
    useState(false);
  const [isDirectSubmission, setIsDirectSubmission] = useState(false);
  const [directSubmissionResponse, setDirectSubmissionResponse] = useState<string | null>(null);
  const [nextStepTimeouts, setNextStepTimeouts] = useState<
    ReturnType<typeof setTimeout>[]
  >([]);

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepAnimations = useRef(
    TRANSACTION_STEPS.map(() => new Animated.Value(0))
  ).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Resume the transaction flow to the final step - ONLY when properly confirmed
  const resumeTransactionFlow = useCallback(() => {
    // STRICT: only resume if we have proper confirmation through BLE mesh network
    if (!broadcastId) {
      console.log(
        "⚠️ Cannot resume transaction flow: no broadcast ID - waiting for confirmation"
      );
      return;
    }

    const state = masterState.get(broadcastId);
    if (!state || !state.isComplete || !state.isAck) {
      console.log(
        "⚠️ Cannot resume transaction flow: invalid state - still waiting for confirmation",
        state
      );
      return;
    }

    console.log(
      "✅ Resuming transaction flow with CONFIRMED state from mesh network"
    );

    // Continue from gateway step through broadcasting to completion
    const resumeFromStep = 4; // Broadcasting Transaction step
    const finalStepIndex = TRANSACTION_STEPS.length - 1;

    // Animate through the remaining steps quickly
    let stepDelay = 0;
    for (let i = resumeFromStep; i <= finalStepIndex; i++) {
      setTimeout(() => {
        setCurrentStep(i);

        // Animate step activation
        Animated.timing(stepAnimations[i], {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Update progress bar
        Animated.timing(progressAnim, {
          toValue: (i + 1) / TRANSACTION_STEPS.length,
          duration: 500,
          useNativeDriver: false,
        }).start();

        setLoadingMessageIndex(Math.min(i, LOADING_MESSAGES.length - 1));

        // Complete the transaction at the final step
        if (i === finalStepIndex) {
          setTimeout(() => {
            setIsCompleted(true);
            setTimeout(() => {
              onComplete(state.fullMessage);
            }, 1500);
          }, 800);
        }
      }, stepDelay);

      stepDelay += 800; // 800ms between each step
    }
  }, [broadcastId, masterState, onComplete, stepAnimations, progressAnim]);

  useEffect(() => {
    resetAnimation();
    startTransactionFlow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle direct submission responses
  useEffect(() => {
    if (isDirectSubmission && directSubmissionResponse) {
      try {
        const responseObj = JSON.parse(directSubmissionResponse);
        
        if (responseObj.success) {
          console.log("✅ Direct submission successful - completing transaction");
          // Skip to final step and complete
          setCurrentStep(TRANSACTION_STEPS.length - 1);
          setLoadingMessageIndex(LOADING_MESSAGES.length - 1);
          
          // Animate to final step
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }).start();
          
          Animated.timing(stepAnimations[TRANSACTION_STEPS.length - 1], {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
          
          // Complete after a short delay
          setTimeout(() => {
            setIsCompleted(true);
            setTimeout(() => {
              onComplete(directSubmissionResponse);
            }, 1500);
          }, 800);
        } else {
          console.error("❌ Direct submission failed:", responseObj.error);
          // Transaction failed — pass the response with success:false back
          // transaction.tsx will check response.success and show an error Alert
          setCurrentStep(TRANSACTION_STEPS.length - 1);
          setIsCompleted(true);
          setTimeout(() => {
            onComplete(directSubmissionResponse);
          }, 1000);
        }
      } catch (parseErr) {
        console.error("❌ Error parsing direct submission response:", parseErr);
      }
    }
  }, [isDirectSubmission, directSubmissionResponse, onComplete, progressAnim, stepAnimations]);

  // Monitor master state for transaction completion (mesh network path)
  useEffect(() => {
    if (broadcastId && masterState.has(broadcastId)) {
      const state = masterState.get(broadcastId);
      if (state && state.isComplete && state.isAck) {
        // Transaction is complete and acknowledged - stop broadcasting
        setIsBroadcasting(false);
        setShouldPauseFlow(false);
        setIsWaitingForConfirmation(false);

        // Resume the flow to the final step
        resumeTransactionFlow();
      }
    }
  }, [masterState, broadcastId, resumeTransactionFlow]);

  // STRICT Safety check: prevent completion if still waiting for confirmation (mesh network only)
  useEffect(() => {
    // Skip safety check for direct submissions
    if (isDirectSubmission) {
      return;
    }

    // ALWAYS prevent completion if we're waiting for confirmation OR if we haven't received proper mesh confirmation
    if ((isWaitingForConfirmation || currentStep >= 3) && isCompleted) {
      // Only allow completion if we have a confirmed broadcast state
      if (!broadcastId || !masterState.has(broadcastId)) {
        console.log(
          "⚠️ STRICT Safety check: Preventing completion - no confirmed mesh state"
        );
        setIsCompleted(false);
        return;
      }

      const state = masterState.get(broadcastId);
      if (!state || !state.isComplete || !state.isAck) {
        console.log(
          "⚠️ STRICT Safety check: Preventing completion - mesh confirmation not received"
        );
        setIsCompleted(false);
      }
    }
  }, [
    isDirectSubmission,
    isWaitingForConfirmation,
    isCompleted,
    currentStep,
    broadcastId,
    masterState,
  ]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      nextStepTimeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [nextStepTimeouts]);

  const resetAnimation = () => {
    setCurrentStep(0);
    setIsCompleted(false);
    setLoadingMessageIndex(0);
    setShouldPauseFlow(false);
    setIsWaitingForConfirmation(false);
    // Clear any pending timeouts
    nextStepTimeouts.forEach((timeout) => clearTimeout(timeout));
    setNextStepTimeouts([]);

    progressAnim.setValue(0);
    stepAnimations.forEach((anim) => anim.setValue(0));
    pulseAnim.setValue(1);
    fadeAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Get current loading message based on state
  const getCurrentLoadingMessage = (): string => {
    if (isCompleted) {
      return "Transaction completed successfully!";
    }

    // Direct submission path
    if (isDirectSubmission) {
      if (directSubmissionResponse) {
        try {
          const responseObj = JSON.parse(directSubmissionResponse);
          if (responseObj.success) {
            return "Transaction confirmed on blockchain!";
          } else {
            return `Transaction failed: ${responseObj.error || "Unknown error"}`;
          }
        } catch {
          return "Processing transaction response...";
        }
      }
      return "Submitting transaction directly to blockchain...";
    }

    // Mesh network path
    if (isWaitingForConfirmation || (isBroadcasting && shouldPauseFlow)) {
      if (broadcastId && masterState.has(broadcastId)) {
        const state = masterState.get(broadcastId);
        if (state?.isAck && !state?.isComplete) {
          return "Received acknowledgment, waiting for final confirmation...";
        }
        if (state?.isComplete && state?.isAck) {
          return "Transaction confirmed by mesh network! Finalizing...";
        }
        return "Broadcasting transaction via mesh network...";
      }
      return "Waiting for mesh network confirmation...";
    }

    // If we've reached the gateway step, always show waiting message
    if (currentStep >= 3 && !hasInternet) {
      return "Found gateway device, waiting for mesh network confirmation...";
    }

    return LOADING_MESSAGES[loadingMessageIndex] || "Processing...";
  };

  // Get chunk progress for display
  const getChunkProgress = useCallback((): {
    received: number;
    total: number;
  } => {
    if (broadcastId && masterState.has(broadcastId)) {
      const state = masterState.get(broadcastId);
      if (state) {
        const progress = {
          received: state.chunks.size,
          total: state.totalChunks || 1,
        };
        return progress;
      }
    }
    return { received: 0, total: 0 };
  }, [broadcastId, masterState]);

  // Check if we should show chunk progress (only after receiving is_ack flag)
  const shouldShowChunkProgress = useCallback((): boolean => {
    if (broadcastId && masterState.has(broadcastId)) {
      const state = masterState.get(broadcastId);
      return state?.isAck === true;
    }
    return false;
  }, [broadcastId, masterState]);

  // Function to sign the transaction and create payload
  const handleTransactionSigning = async () => {
    try {
      if (!transactionData || !userWalletAddress) {
        throw new Error("Missing transaction data or wallet address");
      }

      console.log("🔐 Creating transaction payload...");
      console.log("🌐 Device has internet:", hasInternet);

      // Generate transaction parameters similar to simpleSubmitTxnOnChain.ts
      const currentTime = Math.floor(Date.now() / 1000);
      const validAfter = "0"; // Valid immediately
      const validBefore = (currentTime + 3600).toString(); // Valid for 1 hour

      // Generate a random nonce (32 bytes)
      const nonce =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");

      if (!walletData?.privateKey) {
        throw new Error("No wallet private key available for signing");
      }

      // Convert amount to wei (18 decimals). Use ethers.parseUnits to handle
      // decimal values like "0.5" safely — BigInt("0.5") would throw a SyntaxError.
      const valueInWei = ethers.parseUnits(transactionData.amount, 18).toString();

      // Create real EIP-3009 signature using wallet's private key
      const realSignature = await createTransferWithAuthorizationSignature(
        userWalletAddress,
        transactionData.toAddress,
        valueInWei,
        validAfter,
        validBefore,
        nonce,
        CONTRACT_CONFIG.CONTRACT_ADDRESS,
        transactionData.chainId || 545, // Flow EVM testnet chain ID
        walletData.privateKey
      );

      // Create the transaction payload — include UPI metadata so relayer can trigger Decentro payout
      const transactionPayload: TransactionPayload = {
        type: "TRANSFER_WITH_AUTHORIZATION",
        contractAddress: CONTRACT_CONFIG.CONTRACT_ADDRESS,
        functionName: "transferWithAuthorization",
        parameters: {
          from: userWalletAddress,
          to: transactionData.toAddress,
          value: valueInWei,
          validAfter: validAfter,
          validBefore: validBefore,
          nonce: nonce,
          signature: realSignature,
        },
        upiId: transactionData.upiId,
        merchantName: transactionData.merchantName,
        merchantPhone: transactionData.merchantPhone,
      };

      console.log("📝 Transaction payload created:", {
        type: transactionPayload.type,
        from: transactionPayload.parameters.from,
        to: transactionPayload.parameters.to,
        value: transactionPayload.parameters.value,
        upiId: transactionPayload.upiId,
      });

      const payloadString = JSON.stringify(transactionPayload);

      // Submit via relayer
      if (hasInternet) {
        console.log("🚀 Device has internet - submitting via relayer...");
        setIsDirectSubmission(true);
        setShouldPauseFlow(false);
        setIsWaitingForConfirmation(false);

        try {
          let response: string;

          if (transactionPayload.upiId) {
            // UPI payment → route through relayer: blockchain + Decentro INR payout + SMS
            console.log("💳 UPI payment — calling relayer for INR payout to:", transactionPayload.upiId);
          } else {
            console.log("🔗 Crypto payment — routing through relayer for blockchain submission");
          }

          try {
            const relayRes = await fetch(CONTRACT_CONFIG.RELAYER_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payloadString,
            });
            const relayJson = await relayRes.json();
            response = JSON.stringify({
              success: relayJson.success,
              transactionHash: relayJson.transactionHash,
              blockNumber: relayJson.blockNumber,
              payout: relayJson.payout,
              amountInr: relayJson.amountInr,
              error: relayJson.error,
              timestamp: Date.now(),
            });
            if (relayJson.success) {
              console.log("✅ Relayer: TX", relayJson.transactionHash, "| Payout:", relayJson.payout);
            }
          } catch (relayErr) {
            // Fallback: if relayer is unreachable, submit directly to blockchain
            console.warn("⚠️ Relayer unreachable, falling back to direct submission:", relayErr);
            response = await submitTransactionToBlockchain(payloadString);
          }

          setDirectSubmissionResponse(response);

          try {
            const responseObj = JSON.parse(response);
            if (responseObj.success) {
              console.log("✅ Transaction successful! Hash:", responseObj.transactionHash);
            } else {
              console.error("❌ Transaction failed:", responseObj.error);
            }
          } catch (parseErr) {
            console.warn("⚠️ Could not parse response:", parseErr);
          }
        } catch (error) {
          console.error("❌ Error in submission:", error);
          setDirectSubmissionResponse(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
            stage: "direct_submission",
          }));
        }
      } else {
        // MESH NETWORK PATH: No internet, broadcast via BLE mesh
        console.log("📡 Device has no internet - broadcasting via BLE mesh network...");
        setIsDirectSubmission(false);
        
        try {
          await broadcastMessage(payloadString);
          setIsBroadcasting(true);
          setShouldPauseFlow(true); // Pause the flow here for mesh network
          setIsWaitingForConfirmation(true); // Set waiting for confirmation

          // Find the broadcast ID from the master state
          // Since broadcastMessage creates a new entry, we need to find the latest one
          const states = Array.from(masterState.entries());
          const latestState = states.find(
            ([_, state]) => state.fullMessage === payloadString && !state.isAck
          );

          if (latestState) {
            setBroadcastId(latestState[0]);
            console.log(
              "🚀 Started broadcasting transaction with ID:",
              latestState[0]
            );
          }
        } catch (error) {
          console.error("❌ Error broadcasting transaction payload:", error);
          // Reset flags on error
          setIsBroadcasting(false);
          setShouldPauseFlow(false);
          setIsWaitingForConfirmation(false);
        }
      }
    } catch (error) {
      console.error("❌ Error signing transaction:", error);
    }
  };

  const startTransactionFlow = async () => {
    let totalDuration = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    TRANSACTION_STEPS.forEach((step, index) => {
      // Skip mesh network steps (1, 2, 3) if device has internet
      // Steps: 0=Preparing, 1=Scanning, 2=Hopping, 3=Finding Gateway, 4=Broadcasting, 5=Confirmed
      if (hasInternet && (index === 1 || index === 2 || index === 3)) {
        // Skip "Scanning for Nearby Devices" (1), "Hopping Through Network" (2), and "Finding Internet Gateway" (3)
        return; // Skip these steps entirely - don't schedule timeouts for them
      }

      const timeout = setTimeout(async () => {
        // For mesh network path: pause at gateway step if waiting for confirmation
        if (!hasInternet && (shouldPauseFlow || isWaitingForConfirmation) && index >= 3) {
          // Stop at "Finding Internet Gateway" step (index 3) and wait for confirmation (mesh network only)
          console.log(
            "🔄 Pausing transaction flow at step:",
            step.title,
            "waiting for confirmation..."
          );
          return; // Don't proceed to next steps
        }

        setCurrentStep(index);
        animateStep(index);

        if (index < LOADING_MESSAGES.length) {
          setLoadingMessageIndex(index);
        }

        // Sign the transaction during the "Preparing Transaction" step (step 0)
        if (index === 0) {
          await handleTransactionSigning();
        }

        // If this is the "Finding Internet Gateway" step and we're using mesh network, pause here
        if (!hasInternet && index === 3) {
          setIsWaitingForConfirmation(true);
          setShouldPauseFlow(true);
          console.log(
            "🌐 Reached Finding Internet Gateway step - waiting for confirmation..."
          );
        }

        // For direct submission, after preparing (step 0), quickly progress to broadcasting (step 4)
        if (hasInternet && index === 0) {
          // Wait a moment for transaction signing to complete, then jump to broadcasting
          setTimeout(() => {
            if (isDirectSubmission) {
              setCurrentStep(4); // Broadcasting Transaction
              animateStep(4);
              setLoadingMessageIndex(4);
            }
          }, 1500);
        }
      }, totalDuration);

      timeouts.push(timeout);
      // Only add duration if we're not skipping this step
      if (!(hasInternet && (index === 1 || index === 2 || index === 3))) {
        totalDuration += step.duration;
      }
    });

    // Store timeouts for cleanup
    setNextStepTimeouts(timeouts);

    // REMOVED: Automatic completion logic - now always waits for confirmation
    // The completion will ONLY be handled by the master state monitor after receiving confirmation
    // OR by the direct submission response handler
  };

  const animateStep = (stepIndex: number) => {
    // Animate step activation
    Animated.timing(stepAnimations[stepIndex], {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Update progress bar
    Animated.timing(progressAnim, {
      toValue: (stepIndex + 1) / TRANSACTION_STEPS.length,
      duration: 800,
      useNativeDriver: false,
    }).start();

    // Pulse animation for current step
    const pulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (stepIndex === currentStep && !isCompleted) {
          pulseAnimation();
        }
      });
    };

    if (stepIndex < TRANSACTION_STEPS.length - 1) {
      pulseAnimation();
    }
  };

  const renderStep = (step: (typeof TRANSACTION_STEPS)[0], index: number) => {
    const isActive = index <= currentStep;
    const isCurrent = index === currentStep;
    const isCompleted = index < currentStep;

    const stepOpacity = stepAnimations[index];
    const stepScale = stepAnimations[index].interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
    });

    return (
      <Animated.View
        key={step.id}
        style={[
          styles.stepContainer,
          {
            opacity: stepOpacity,
            transform: [{ scale: stepScale }],
          },
        ]}
      >
        <View style={styles.stepIconContainer}>
          <Animated.View
            style={[
              styles.stepIcon,
              isActive && styles.stepIconActive,
              isCompleted && styles.stepIconCompleted,
              isCurrent && {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Text
              style={[
                styles.stepIconText,
                isActive && styles.stepIconTextActive,
              ]}
            >
              {step.icon}
            </Text>
          </Animated.View>
          {index < TRANSACTION_STEPS.length - 1 && (
            <View
              style={[styles.stepLine, isCompleted && styles.stepLineCompleted]}
            />
          )}
        </View>
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
            {step.title}
          </Text>
          <Text
            style={[
              styles.stepDescription,
              isActive && styles.stepDescriptionActive,
            ]}
          >
            {step.description}
          </Text>
        </View>
      </Animated.View>
    );
  };

  // Calculate progress width based on chunks or steps
  const getProgressValue = useCallback((): number => {
    // Only use chunk progress if we should show it (after receiving is_ack flag)
    if (shouldShowChunkProgress()) {
      const chunkProgress = getChunkProgress();
      if (chunkProgress.total > 0) {
        return chunkProgress.received / chunkProgress.total;
      }
    }
    // Otherwise use step progress
    return (currentStep + 1) / TRANSACTION_STEPS.length;
  }, [getChunkProgress, shouldShowChunkProgress, currentStep]);

  // Update progress bar animation based on chunk progress
  useEffect(() => {
    const progressValue = getProgressValue();
    Animated.timing(progressAnim, {
      toValue: progressValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [getProgressValue, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={styles.fullPageContainer}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Processing Transaction</Text>
          {transactionData && (
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionText}>
                Sending {transactionData.amount} {transactionData.currency}
              </Text>
              <Text style={styles.transactionAddress}>
                to {transactionData.toAddress.slice(0, 6)}...
                {transactionData.toAddress.slice(-4)}
              </Text>
              <Text style={styles.transactionChain}>
                on {transactionData.chain}
              </Text>
            </View>
          )}
        </View>

        {/* Fixed Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>
          <Text style={styles.progressText}>
            {(() => {
              // Show chunk progress only after receiving is_ack flag
              if (shouldShowChunkProgress()) {
                const chunkProgress = getChunkProgress();
                if (chunkProgress.total > 0) {
                  return `${chunkProgress.received}/${chunkProgress.total}`;
                }
              }
              // Otherwise show step progress
              return `Step ${currentStep + 1} of ${TRANSACTION_STEPS.length}`;
            })()}
          </Text>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Steps */}
          <View style={styles.stepsContainer}>
            {TRANSACTION_STEPS.map((step, index) => renderStep(step, index))}
          </View>

          {/* Loading Message */}
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingMessage}>
              {getCurrentLoadingMessage()}
            </Text>
          </View>

          {/* Success State */}
          {isCompleted && (
            <Animated.View style={styles.successContainer}>
              <Text style={styles.successIcon}>🎉</Text>
              <Text style={styles.successText}>Transaction Successful!</Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Fixed Cancel Button */}
        {onCancel && !isCompleted && (
          <View style={styles.fixedFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel Transaction</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.1)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#79D93E",
  success: "#10B981",
  text: "#F8FAFC",
  textMuted: "#94A3B8"
};

const styles = StyleSheet.create({
  fullPageContainer: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: THEME.text,
    marginBottom: 10,
  },
  transactionInfo: {
    alignItems: "center",
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "100%",
  },
  transactionText: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
  },
  transactionAddress: {
    fontSize: 14,
    color: THEME.textMuted,
    fontFamily: "monospace",
    marginTop: 2,
  },
  transactionChain: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: THEME.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  stepsContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flexDirection: "row",
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  stepIconContainer: {
    alignItems: "center",
    marginRight: 15,
  },
  stepIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.glassBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
  },
  stepIconActive: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: THEME.primary,
  },
  stepIconCompleted: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: THEME.success,
  },
  stepIconText: {
    fontSize: 22,
    color: THEME.textMuted,
  },
  stepIconTextActive: {
    color: "#fff",
  },
  stepLine: {
    width: 3,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginTop: 8,
  },
  stepLineCompleted: {
    backgroundColor: THEME.success,
  },
  stepContent: {
    flex: 1,
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.textMuted,
    marginBottom: 4,
  },
  stepTitleActive: {
    color: THEME.text,
  },
  stepDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    lineHeight: 18,
  },
  stepDescriptionActive: {
    color: THEME.textMuted,
  },
  loadingContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  loadingMessage: {
    fontSize: 14,
    color: THEME.primary,
    fontWeight: "600",
  },
  fixedFooter: {
    padding: 20,
    backgroundColor: "transparent",
  },
  cancelButton: {
    backgroundColor: THEME.glassBg,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
  },
  cancelButtonText: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  successContainer: {
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  successText: {
    fontSize: 18,
    fontWeight: "bold",
    color: THEME.success,
  },
});
