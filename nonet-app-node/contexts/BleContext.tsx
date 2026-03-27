import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Platform, Alert } from "react-native";
import Constants from 'expo-constants';
import { BleManager } from "react-native-ble-plx";
import BleAdvertiser from "react-native-ble-advertiser";
import { useNetInfo } from "@react-native-community/netinfo";
import {
  MessageState,
  broadcastOverBle,
  stopBleBroadcast,
  encodeMessageToChunks,
  decodeSingleChunk,
  listenOverBle,
} from "../utils/bleUtils";
import { ethers } from "ethers";
import {
  CONTRACT_CONFIG,
  CONTRACT_ABI,
  TransactionPayload,
} from "../constants/contracts";

// Helper function to check if BLE is supported
const isBleSupported = (): boolean => {
  // BLE not available on web
  if (Platform.OS === 'web') {
    return false;
  }
  
  // BLE not available in Expo Go (only in custom development builds)
  const executionEnvironment = Constants.executionEnvironment;
  if (executionEnvironment === 'storeClient') {
    console.log('Running in Expo Go - BLE not supported. Use a development build for BLE features.');
    return false;
  }
  
  return true;
};

// --- Real Blockchain Transaction Submission ---
export const submitTransactionToBlockchain = async (
  originalMessage: string
): Promise<string> => {
  const startTime = Date.now();
  const TIMEOUT_MS = 120000; // 2 minutes timeout
  
  try {
    console.log("🌐 [BLOCKCHAIN] Gateway device processing transaction payload...");
    console.log("🌐 [BLOCKCHAIN] Message length:", originalMessage.length);

    // Parse the transaction payload
    let transactionPayload: TransactionPayload;
    try {
      transactionPayload = JSON.parse(originalMessage);
      console.log("🌐 [BLOCKCHAIN] Payload parsed successfully");
    } catch (parseError: any) {
      const errorMsg = `Failed to parse transaction payload: ${parseError?.message || String(parseError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "parsing",
      });
    }

    // Validate payload structure
    if (
      transactionPayload.type !== "TRANSFER_WITH_AUTHORIZATION" ||
      !transactionPayload.parameters ||
      !transactionPayload.contractAddress
    ) {
      const errorMsg = "Invalid transaction payload structure";
      console.error("❌ [BLOCKCHAIN]", errorMsg, transactionPayload);
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "validation",
      });
    }

    const { parameters, contractAddress } = transactionPayload;

    console.log("📝 [BLOCKCHAIN] Processing transferWithAuthorization:", {
      from: parameters.from,
      to: parameters.to,
      value: parameters.value,
      contractAddress,
    });

    // Set up the provider and relayer wallet with timeout
    console.log("🔗 [BLOCKCHAIN] Connecting to RPC:", CONTRACT_CONFIG.RPC_URL);
    const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.RPC_URL);
    
    // Test connection with timeout
    try {
      const networkPromise = provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("RPC connection timeout")), 10000)
      );
      await Promise.race([networkPromise, timeoutPromise]);
      console.log("✅ [BLOCKCHAIN] RPC connection successful");
    } catch (connError: any) {
      const errorMsg = `RPC connection failed: ${connError?.message || String(connError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "connection",
      });
    }

    const relayerWallet = new ethers.Wallet(
      CONTRACT_CONFIG.RELAYER_PRIVATE_KEY,
      provider
    );

    console.log(`🔗 [BLOCKCHAIN] Relayer Address: ${relayerWallet.address}`);

    // Check relayer balance with timeout
    try {
      const balancePromise = provider.getBalance(relayerWallet.address);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Balance check timeout")), 10000)
      );
      const balance = await Promise.race([balancePromise, timeoutPromise]) as bigint;
      const balanceFormatted = ethers.formatEther(balance);
      console.log(`💰 [BLOCKCHAIN] Relayer Balance: ${balanceFormatted} native tokens`);

      if (balance === BigInt(0)) {
        const errorMsg = "Relayer wallet has insufficient balance";
        console.warn("⚠️ [BLOCKCHAIN]", errorMsg);
        return JSON.stringify({
          success: false,
          error: errorMsg,
          timestamp: Date.now(),
          stage: "balance_check",
        });
      }
    } catch (balanceError: any) {
      const errorMsg = `Balance check failed: ${balanceError?.message || String(balanceError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "balance_check",
      });
    }

    // Check token balance of 'from' address before submitting
    // Use read-only contract instance (provider only, no signer) similar to native balance check
    try {
      console.log("💰 [BLOCKCHAIN] Checking token balance of from address...");
      console.log(`💰 [BLOCKCHAIN] Contract address: ${contractAddress}`);
      console.log(`💰 [BLOCKCHAIN] From address: ${parameters.from}`);
      
      // Create a read-only contract instance using just the provider (no signer needed for view functions)
      // This is the same pattern as provider.getBalance() for native tokens
      const senderWallet = new ethers.Wallet(
        CONTRACT_CONFIG.SENDER_PVT_KEY,
        provider
      );
      
      console.log("💰 [BLOCKCHAIN] Calling balanceOf on contract...");
      const tokenBalancePromise = provider.getBalance(senderWallet.address);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Token balance check timeout")), 10000)
      );
      const balance = await Promise.race([tokenBalancePromise, timeoutPromise]) as bigint;
      
      const balanceFormatted = ethers.formatEther(balance);
      const valueFormatted = ethers.formatEther(parameters.value);
      const balanceRaw = balance.toString();
      const valueRaw = parameters.value;
      
      console.log(`💰 [BLOCKCHAIN] From address (${parameters.from}) token balance: ${balanceFormatted} tokens (raw: ${balanceRaw})`);
      console.log(`💰 [BLOCKCHAIN] Transfer amount: ${valueFormatted} tokens (raw: ${valueRaw})`);
      
      if (balance < BigInt(parameters.value)) {
        const errorMsg = `Insufficient token balance: has ${balanceFormatted}, needs ${valueFormatted}`;
        console.error("❌ [BLOCKCHAIN]", errorMsg);
        console.error(`❌ [BLOCKCHAIN] Raw comparison: ${balanceRaw} < ${valueRaw}`);
        return JSON.stringify({
          success: false,
          error: errorMsg,
          timestamp: Date.now(),
          stage: "balance_check",
        });
      }
      console.log("✅ [BLOCKCHAIN] Token balance check passed");
    } catch (balanceError: any) {
      const errorMsg = `Token balance check failed: ${balanceError?.message || String(balanceError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      console.error("❌ [BLOCKCHAIN] Balance check error details:", {
        message: balanceError?.message,
        code: balanceError?.code,
        data: balanceError?.data,
        stack: balanceError?.stack,
      });
      // Continue anyway - the contract will revert if balance is insufficient
      // But log the error for debugging
    }

    // Create contract instance with relayer wallet for transaction submission
    console.log("📄 [BLOCKCHAIN] Creating contract instance with relayer wallet...");
    const tokenContract = new ethers.Contract(
      contractAddress,
      CONTRACT_ABI,
      relayerWallet
    );

    console.log("📡 [BLOCKCHAIN] Submitting transaction to Flow EVM testnet...");
    console.log("--- [BLOCKCHAIN] Transaction Parameters ---");
    console.log("from:", parameters.from);
    console.log("to:", parameters.to);
    console.log("value:", parameters.value);
    console.log("validAfter:", parameters.validAfter);
    console.log("validBefore:", parameters.validBefore);
    console.log("nonce:", parameters.nonce);
    console.log("signature:", parameters.signature);
    console.log("signature length:", parameters.signature.length);

    // Call the contract function with timeout
    let tx: any;
    try {
      // Ensure nonce is in correct format (bytes32)
      const nonceBytes32 = ethers.getBytes(parameters.nonce);
      if (nonceBytes32.length !== 32) {
        throw new Error(`Invalid nonce length: expected 32 bytes, got ${nonceBytes32.length}`);
      }
      
      const txPromise = tokenContract.transferWithAuthorization(
        parameters.from,
        parameters.to,
        parameters.value,
        parameters.validAfter,
        parameters.validBefore,
        parameters.nonce, // ethers.js will handle bytes32 conversion
        parameters.signature
      );
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction submission timeout")), TIMEOUT_MS)
      );
      
      tx = await Promise.race([txPromise, timeoutPromise]);
      console.log(`⏳ [BLOCKCHAIN] Transaction sent! Hash: ${tx.hash}`);
      console.log(`⏳ [BLOCKCHAIN] Waiting for confirmation...`);
    } catch (txError: any) {
      const errorMsg = `Transaction submission failed: ${txError?.message || String(txError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      
      // Check for specific error types
      if (txError?.code === "ACTION_REJECTED") {
        return JSON.stringify({
          success: false,
          error: "Transaction was rejected",
          timestamp: Date.now(),
          stage: "submission",
        });
      }
      if (txError?.code === "INSUFFICIENT_FUNDS") {
        return JSON.stringify({
          success: false,
          error: "Insufficient funds for gas",
          timestamp: Date.now(),
          stage: "submission",
        });
      }
      if (txError?.message?.includes("timeout")) {
        return JSON.stringify({
          success: false,
          error: "Transaction submission timed out",
          timestamp: Date.now(),
          stage: "submission",
        });
      }
      
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "submission",
      });
    }

    // Wait for the transaction to be mined with timeout
    let receipt: any;
    try {
      const receiptPromise = tx.wait();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction confirmation timeout")), TIMEOUT_MS)
      );
      receipt = await Promise.race([receiptPromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      console.log("✅ [BLOCKCHAIN] Transaction confirmed!");
      console.log(`⏱️ [BLOCKCHAIN] Total time: ${elapsed}ms`);
      console.log(`📦 [BLOCKCHAIN] Block Number: ${receipt.blockNumber}`);
      console.log(`⛽ [BLOCKCHAIN] Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`🔗 [BLOCKCHAIN] Explorer: https://evm-testnet.flowscan.io/tx/${tx.hash}`);

      // Return success response
      return JSON.stringify({
        success: true,
        transactionHash: tx.hash,
        explorerUrl: `https://evm-testnet.flowscan.io/tx/${tx.hash}`,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        timestamp: Date.now(),
      });
    } catch (receiptError: any) {
      const errorMsg = `Transaction confirmation failed: ${receiptError?.message || String(receiptError)}`;
      console.error("❌ [BLOCKCHAIN]", errorMsg);
      
      // If we have a tx hash, return partial success
      if (tx?.hash) {
        console.warn("⚠️ [BLOCKCHAIN] Transaction was sent but confirmation timed out. Hash:", tx.hash);
        return JSON.stringify({
          success: false,
          error: "Transaction sent but confirmation timed out",
          transactionHash: tx.hash,
          explorerUrl: `https://evm-testnet.flowscan.io/tx/${tx.hash}`,
          timestamp: Date.now(),
          stage: "confirmation",
        });
      }
      
      return JSON.stringify({
        success: false,
        error: errorMsg,
        timestamp: Date.now(),
        stage: "confirmation",
      });
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error("❌ [BLOCKCHAIN] Unexpected error after", elapsed, "ms:", error);

    // Extract meaningful error message
    let errorMessage = "Unknown blockchain error";
    let errorCode = "";
    
    if (error?.message) {
      errorMessage = error.message;
    } else if (error?.reason) {
      errorMessage = error.reason;
    } else if (error?.code) {
      errorCode = String(error.code);
      errorMessage = `Error code: ${error.code}`;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      errorMessage = JSON.stringify(error);
    }

    // Log full error details
    console.error("❌ [BLOCKCHAIN] Full error details:", {
      message: errorMessage,
      code: errorCode,
      stack: error?.stack,
      data: error?.data,
    });

    return JSON.stringify({
      success: false,
      error: errorMessage,
      errorCode: errorCode || undefined,
      timestamp: Date.now(),
      stage: "unknown",
    });
  }
};

interface BleContextType {
  // State
  isBroadcasting: boolean;
  hasInternet: boolean;
  masterState: Map<number, MessageState>;
  broadcastQueue: Map<number, Uint8Array[]>;

  // Actions
  broadcastMessage: (message: string) => Promise<void>;
  startBroadcasting: () => void;
  stopBroadcasting: () => void;
  clearAllAndStop: () => Promise<void>;

  // Utility functions
  getCurrentBroadcastInfo: () => { id?: number; text?: string };
  getProgressFor: (state: MessageState) => {
    received: number;
    total: number;
    percent: number;
  };

  // Force re-render trigger for UI updates
  forceUpdate: () => void;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

interface BleProviderProps {
  children: ReactNode;
}

export const BleProvider: React.FC<BleProviderProps> = ({ children }) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [, forceRerender] = useState(0);

  // Use NetInfo to get real network connectivity status
  const netInfo = useNetInfo();
  const hasInternet = netInfo.isConnected ?? false;

  // Refs for persistent state
  const managerRef = useRef<BleManager | null>(null);
  const masterStateRef = useRef<Map<number, MessageState>>(new Map());
  const broadcastQueueRef = useRef<Map<number, Uint8Array[]>>(new Map());
  const masterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastCursorRef = useRef<{ queueIndex: number; chunkIndex: number }>(
    {
      queueIndex: 0,
      chunkIndex: 0,
    }
  );
  const stopScannerRef = useRef<(() => void) | null>(null);

  // Force update function for UI re-renders
  const forceUpdate = () => {
    forceRerender((n) => n + 1);
  };

  // Handle incoming BLE chunks
  const handleIncomingChunk = (chunk: Uint8Array) => {
    const decoded = decodeSingleChunk(chunk);
    if (!decoded) return;

    const { id, totalChunks, chunkNumber, isAck } = decoded;
    const masterState = masterStateRef.current;
    let entry = masterState.get(id);

    if (entry && !entry.isAck && isAck) {
      // This is the first chunk of a response to our request.
      // Instead of deleting the state, we update it to receive the response.
      entry.isAck = true;
      entry.isComplete = false;
      entry.fullMessage = ""; // Clear the old request message text
      entry.chunks.clear(); // Clear the old request chunks
      entry.totalChunks = totalChunks; // Update with the new total for the response
    }

    if (!entry) {
      entry = {
        id,
        totalChunks,
        isComplete: false,
        isAck,
        chunks: new Map<number, Uint8Array>(),
        fullMessage: "",
      };
      masterState.set(id, entry);
    }

    if (entry.isComplete || entry.chunks.has(chunkNumber)) {
      return;
    }

    entry.chunks.set(chunkNumber, chunk);
    forceUpdate();

    if (entry.chunks.size === entry.totalChunks) {
      entry.isComplete = true;

      console.log(`📦 [MESH] All chunks received for message ID: ${id}`);
      console.log(`📦 [MESH] Total chunks: ${entry.totalChunks}, Is ACK: ${entry.isAck}`);

      // --- CORRECTED REASSEMBLY LOGIC ---
      const DATA_PER_CHUNK = 6;
      const fullBinary = new Uint8Array(entry.totalChunks * DATA_PER_CHUNK);
      let offset = 0;

      // This loop ensures chunks are placed in the correct order (1, 2, 3, ...),
      // regardless of the order they were received in.
      for (let i = 1; i <= entry.totalChunks; i++) {
        const part = entry.chunks.get(i)!.slice(3); // Get chunk by its number and slice header
        fullBinary.set(part, offset);
        offset += part.length;
      }

      const decoder = new TextDecoder();
      const fullMessage = decoder.decode(fullBinary).replace(/\0/g, ""); // Remove null padding
      entry.fullMessage = fullMessage;
      // --- END OF FIX ---

      console.log(`✅ [MESH] Message reassembled. Length: ${fullMessage.length} chars`);
      console.log(`✅ [MESH] Message preview: ${fullMessage.substring(0, 150)}...`);
      console.log(`🌐 [MESH] Device has internet: ${hasInternet}`);

      forceUpdate();

      if (hasInternet && !entry.isAck) {
        console.log(`🚀 [MESH] This device has internet - submitting to blockchain...`);
        handleApiResponse(id, fullMessage);
      } else if (!hasInternet) {
        console.log(`📡 [MESH] This device has no internet - re-broadcasting chunks...`);
        // Also ensure re-broadcasted chunks are in order
        const orderedChunks = [];
        for (let i = 1; i <= entry.totalChunks; i++) {
          orderedChunks.push(entry.chunks.get(i)!);
        }
        addToBroadcastQueue(id, orderedChunks);
      } else if (entry.isAck) {
        console.log(`✅ [MESH] Received ACK response - transaction complete`);
      }
    }
  };

  // Handle API responses
  const handleApiResponse = async (id: number, messageText: string) => {
    const startTime = Date.now();
    console.log(`🚀 [GATEWAY] Starting blockchain submission for message ID: ${id}`);
    console.log(`🚀 [GATEWAY] Message preview: ${messageText.substring(0, 100)}...`);
    
    try {
      // Parse the response to check for errors
      const apiResponse = await submitTransactionToBlockchain(messageText);
      const elapsed = Date.now() - startTime;
      
      // Try to parse response to log details
      try {
        const responseObj = JSON.parse(apiResponse);
        if (responseObj.success) {
          console.log(`✅ [GATEWAY] Transaction successful after ${elapsed}ms`);
          console.log(`✅ [GATEWAY] Transaction Hash: ${responseObj.transactionHash}`);
          console.log(`✅ [GATEWAY] Block Number: ${responseObj.blockNumber || 'N/A'}`);
        } else {
          const errorMsg = responseObj.error || 'Unknown error';
          const stage = responseObj.stage || 'unknown';
          console.error(`❌ [GATEWAY] Transaction failed after ${elapsed}ms`);
          console.error(`❌ [GATEWAY] Error: ${errorMsg}`);
          console.error(`❌ [GATEWAY] Stage: ${stage}`);
          
          // Show alert for critical errors (visible in Expo Go)
          if (Platform.OS !== 'web') {
            Alert.alert(
              'Transaction Failed',
              `Error: ${errorMsg}\n\nStage: ${stage}\n\nCheck the mesh screen for details.`,
              [{ text: 'OK' }]
            );
          }
        }
      } catch (parseErr) {
        console.warn("⚠️ [GATEWAY] Could not parse response:", parseErr);
      }
      
      const ackChunks = encodeMessageToChunks(apiResponse, { id, isAck: true });
      console.log(`📦 [GATEWAY] Encoded response into ${ackChunks.length} chunks`);

      const ackState: MessageState = {
        id,
        totalChunks: ackChunks.length,
        isComplete: true,
        isAck: true,
        chunks: new Map(ackChunks.map((chunk, i) => [i + 1, chunk])),
        fullMessage: apiResponse,
      };
      masterStateRef.current.set(id, ackState);
      forceUpdate();

      console.log(`📡 [GATEWAY] Broadcasting response back through mesh network...`);
      addToBroadcastQueue(id, ackChunks);
      console.log(`✅ [GATEWAY] Response queued for broadcast`);
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      console.error(`❌ [GATEWAY] API handling error after ${elapsed}ms:`, err);
      console.error(`❌ [GATEWAY] Error message:`, err?.message || String(err));
      console.error(`❌ [GATEWAY] Error stack:`, err?.stack);
      
      // Create error response
      const errorResponse = JSON.stringify({
        success: false,
        error: err?.message || "Gateway processing failed",
        timestamp: Date.now(),
        stage: "gateway_processing",
      });
      
      try {
        const errorChunks = encodeMessageToChunks(errorResponse, { id, isAck: true });
        const errorState: MessageState = {
          id,
          totalChunks: errorChunks.length,
          isComplete: true,
          isAck: true,
          chunks: new Map(errorChunks.map((chunk, i) => [i + 1, chunk])),
          fullMessage: errorResponse,
        };
        masterStateRef.current.set(id, errorState);
        forceUpdate();
        addToBroadcastQueue(id, errorChunks);
        console.log(`📡 [GATEWAY] Error response queued for broadcast`);
      } catch (encodeErr) {
        console.error(`❌ [GATEWAY] Failed to encode error response:`, encodeErr);
      }
    }
  };

  // Add chunks to broadcast queue
  const addToBroadcastQueue = (id: number, chunks: Uint8Array[]) => {
    broadcastQueueRef.current.set(id, chunks);
    if (!masterIntervalRef.current) {
      startMasterBroadcastLoop();
    }
  };

  // Start the master broadcast loop
  const startMasterBroadcastLoop = () => {
    setIsBroadcasting(true);
    if (masterIntervalRef.current) clearInterval(masterIntervalRef.current);

    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };

    masterIntervalRef.current = setInterval(() => {
      const entries = Array.from(broadcastQueueRef.current.entries());
      if (entries.length === 0) {
        stopMasterBroadcastLoop();
        return;
      }

      let { queueIndex, chunkIndex } = broadcastCursorRef.current;
      if (queueIndex >= entries.length) queueIndex = 0;

      const [currentId, chunksToBroadcast] = entries[queueIndex]!;
      if (!chunksToBroadcast || chunksToBroadcast.length === 0) {
        broadcastQueueRef.current.delete(currentId);
        broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };
        return;
      }

      if (chunkIndex >= chunksToBroadcast.length) chunkIndex = 0;

      try {
        broadcastOverBle(chunksToBroadcast[chunkIndex]);
      } catch (e) {
        console.error("broadcast error", e);
      }

      chunkIndex++;
      if (chunkIndex >= chunksToBroadcast.length) {
        chunkIndex = 0;
        queueIndex++;
        if (queueIndex >= entries.length) queueIndex = 0;
      }

      broadcastCursorRef.current = { queueIndex, chunkIndex };
      forceUpdate();
    }, 250);
  };

  // Stop the master broadcast loop
  const stopMasterBroadcastLoop = () => {
    if (masterIntervalRef.current) {
      clearInterval(masterIntervalRef.current);
      masterIntervalRef.current = null;
    }
    stopBleBroadcast();
    setIsBroadcasting(false);
    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };
    forceUpdate();
  };

  // Broadcast a new message
  const broadcastMessage = async (message: string) => {
    try {
      const chunks = encodeMessageToChunks(message, { isAck: false });
      const id = decodeSingleChunk(chunks[0])!.id;

      const newState: MessageState = {
        id,
        totalChunks: chunks.length,
        isComplete: true,
        isAck: false,
        chunks: new Map(chunks.map((c, i) => [i + 1, c])),
        fullMessage: message,
      };

      masterStateRef.current.set(id, newState);
      forceUpdate();
      addToBroadcastQueue(id, chunks);
    } catch (err) {
      throw err;
    }
  };

  // Get current broadcast info for UI
  const getCurrentBroadcastInfo = (): { id?: number; text?: string } => {
    const entries = Array.from(broadcastQueueRef.current.entries());
    if (entries.length === 0) return {};
    let idx = broadcastCursorRef.current.queueIndex;
    if (idx >= entries.length) idx = 0;
    const [id] = entries[idx];
    const state = masterStateRef.current.get(id);
    if (!state) {
      const chunks = entries[idx][1];
      try {
        const maybe = decodeSingleChunk(chunks[0]) as any;
        return {
          id,
          text: maybe?.decodedData?.slice(0, 120) ?? "Broadcasting...",
        };
      } catch {
        return { id, text: "Broadcasting..." };
      }
    }
    const maxLen = 60;
    const text =
      state.fullMessage.length > maxLen
        ? `${state.fullMessage.slice(0, maxLen)}...`
        : state.fullMessage;
    return { id: state.id, text };
  };

  // Get progress for a message state
  const getProgressFor = (state: MessageState) => {
    const received = state.chunks.size;
    const total = state.totalChunks || 1;
    const percent = Math.round((received / total) * 100);
    return { received, total, percent };
  };

  // Clear everything and stop all operations
  const clearAllAndStop = async () => {
    // Skip if BLE not supported
    if (!isBleSupported()) {
      return;
    }

    // Stop all current operations
    if (stopScannerRef.current) {
      stopScannerRef.current();
      stopScannerRef.current = null;
    }
    if (masterIntervalRef.current) {
      clearInterval(masterIntervalRef.current);
      masterIntervalRef.current = null;
    }
    await stopBleBroadcast();

    // Destroy the BleManager instance to clear the native cache
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }

    // Clear all application-level state
    masterStateRef.current.clear();
    broadcastQueueRef.current.clear();
    setIsBroadcasting(false);
    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };

    // Force a UI update to reflect the cleared state
    forceUpdate();

    // Re-initialize and restart the scanner after a short delay
    setTimeout(() => {
      // Skip if BLE not supported
      if (!isBleSupported()) {
        return;
      }

      try {
        // Create a new BleManager instance
        managerRef.current = new BleManager();
        // Start listening again
        stopScannerRef.current = listenOverBle(
          managerRef.current,
          handleIncomingChunk
        );
        console.log("BLE stack reset and scanner restarted.");
      } catch (e) {
        console.error("Failed to restart scanner after clear:", e);
      }
    }, 500);
  };

  // Initialize BLE on mount
  useEffect(() => {
    // Skip BLE initialization if not supported
    if (!isBleSupported()) {
      return;
    }

    managerRef.current = new BleManager();
    if (Platform.OS === "android") {
      try {
        if (BleAdvertiser && (BleAdvertiser as any).setCompanyId) {
          (BleAdvertiser as any).setCompanyId(0xffff);
        }
      } catch (e) {
        console.error("BLE advertiser init error:", e);
      }
    }

    // Start listening for BLE messages - this runs continuously in the background
    stopScannerRef.current = listenOverBle(
      managerRef.current,
      handleIncomingChunk
    );

    return () => {
      try {
        stopScannerRef.current?.();
      } catch {}
      stopScannerRef.current = null;

      if (masterIntervalRef.current) {
        clearInterval(masterIntervalRef.current);
        masterIntervalRef.current = null;
      }
      try {
        managerRef.current?.destroy();
      } catch {}
      managerRef.current = null;
    };
  }, []);

  const contextValue: BleContextType = {
    // State
    isBroadcasting,
    hasInternet,
    masterState: masterStateRef.current,
    broadcastQueue: broadcastQueueRef.current,

    // Actions
    broadcastMessage,
    startBroadcasting: startMasterBroadcastLoop,
    stopBroadcasting: stopMasterBroadcastLoop,
    clearAllAndStop,

    // Utility functions
    getCurrentBroadcastInfo,
    getProgressFor,
    forceUpdate,
  };

  return (
    <BleContext.Provider value={contextValue}>{children}</BleContext.Provider>
  );
};

// Hook to use the BLE context
export const useBle = (): BleContextType => {
  const context = useContext(BleContext);
  if (context === undefined) {
    throw new Error("useBle must be used within a BleProvider");
  }
  return context;
};
