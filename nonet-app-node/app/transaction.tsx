import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import { CONTRACT_CONFIG } from "@/constants/contracts";

// --- Theme Constants (Glassmorphism + Dark Mode) ---
const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  success: "#10B981",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

// Mock Mapping DB for @hoppay addresses string -> 0x Address
const MOCK_DB: Record<string, string> = {
  "alice@hoppay": "0x1234567890abcdef1234567890abcdef12345678",
  "bob@hoppay": "0xabcdef1234567890abcdef1234567890abcdef12",
  "merchant@icici": "0x9999999999abcdef9999999999abcdef99999999"
};

const SWIPE_WIDTH = 280;
const KNOB_WIDTH = 60;

export default function TransactionPage(): React.JSX.Element {
  const { signTransaction, userWalletAddress } = useWallet();
  const { broadcastMessage, hasInternet } = useBle();

  const [step, setStep] = useState<1 | 2>(1);
  const [receiverId, setReceiverId] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [amount, setAmount] = useState<string>("0");
  const [isProcessing, setIsProcessing] = useState(false);

  // Swipe Animation
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_WIDTH - KNOB_WIDTH],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const bgFill = pan.x.interpolate({
    inputRange: [0, SWIPE_WIDTH - KNOB_WIDTH],
    outputRange: ["transparent", THEME.success],
    extrapolate: "clamp"
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([
        null, { dx: pan.x }
      ], { useNativeDriver: false }), // Native driver must be false for bgColor interpolation
      onPanResponderRelease: (e, gesture) => {
        if (gesture.dx > (SWIPE_WIDTH - KNOB_WIDTH) * 0.8) {
          // Success Swipe
          Animated.spring(pan, {
            toValue: { x: SWIPE_WIDTH - KNOB_WIDTH, y: 0 },
            useNativeDriver: false,
          }).start(() => {
            handleSendTransaction();
          });
        } else {
          // Revert Swipe
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: 0 });
        pan.setValue({ x: 0, y: 0 });
      }
    })
  ).current;

  const handleNextStep = () => {
    Keyboard.dismiss();
    const cleanId = receiverId.trim().toLowerCase();
    const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;

    if (ethAddressPattern.test(cleanId)) {
      setResolvedAddress(cleanId);
      setStep(2);
    } else if (MOCK_DB[cleanId]) {
      setResolvedAddress(MOCK_DB[cleanId]);
      setStep(2);
    } else if (cleanId.includes("@")) {
      // Allow it anyway for mock purposes, generate dummy address
      const dummy = "0x" + Math.random().toString(16).slice(2).padStart(40, "0");
      setResolvedAddress(dummy);
      setStep(2);
    } else {
      Alert.alert("Invalid ID", "Please enter a valid @hoppay ID or 0x address.");
    }
  };

  const handleKeypad = (num: string) => {
    if (amount === "0") {
      setAmount(num);
    } else {
      setAmount(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
  };

  const handleSendTransaction = async () => {
    try {
      if (amount === "0" || !resolvedAddress) return;
      setIsProcessing(true);

      const amountVal = parseFloat(amount);
      if (isNaN(amountVal) || amountVal <= 0) throw new Error("Invalid amount");

      // In real app, standard 18 decimal shift. Here we convert INR back to MESHT equivalent
      // 1 MESHT = 100 INR. So if user sends 200 INR, that is 2 MESHT.
      const meshtAmount = amountVal / 100;
      const valueInWei = (meshtAmount * 1e18).toLocaleString('fullwide', {useGrouping:false}).replace('.', '');

      const payloadUrl = {
        type: "TRANSFER_WITH_AUTHORIZATION",
        contractAddress: CONTRACT_CONFIG.CONTRACT_ADDRESS,
        parameters: {
          from: userWalletAddress,
          to: resolvedAddress,
          value: valueInWei,
          validAfter: 0,
          validBefore: Math.floor(Date.now() / 1000) + 3600, // 1 hr validity
          nonce: "0x" + Math.random().toString(16).slice(2).padEnd(64, '0'), // Fake nonce bytes32
          signature: "0x..." // Mock signature string replacement happens inside WalletContext in real
        }
      };

      // 1. Sign
      // For the hackathon sim, if the hook actually signs it, cool. Otherwise mock it.
      const signedPayload = JSON.stringify(payloadUrl); // Mock string payload
      
      console.log("📝 Created Payload to Broadcast:", signedPayload);

      // 2. Broadcast Offline
      await broadcastMessage(signedPayload);

      // Optional: Add some delay to make the UX feel "weighty"
      setTimeout(() => {
        setIsProcessing(false);
        router.push("/(tabs)/mesh"); // Jump to radar tracking
      }, 700);

    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to initiate transaction");
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 ? setStep(1) : router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Money</Text>
        <View style={{ width: 44 }} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          {step === 1 ? (
            <BlurView intensity={30} tint="dark" style={styles.glassCard}>
              <Text style={styles.sectionTitle}>Who are you paying?</Text>
              <View style={styles.inputContainer}>
                <Feather name="at-sign" size={20} color={THEME.textMuted} style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@hoppay or 0x..."
                  placeholderTextColor={THEME.textMuted}
                  value={receiverId}
                  onChangeText={setReceiverId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity style={styles.scanBtn}>
                <Feather name="maximize" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
                <Text style={styles.scanText}>Scan QR Code</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep}>
                <Text style={styles.primaryButtonText}>Next</Text>
                <Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </BlurView>
          ) : (
            <View style={styles.step2Container}>
              <Text style={styles.payingToText}>Paying <Text style={{ color: THEME.primary }}>{receiverId}</Text></Text>
              
              {/* Amount Display */}
              <View style={styles.amountDisplay}>
                <Text style={styles.currencySymbol}>₹</Text>
                <Text style={styles.amountText}>{amount}</Text>
              </View>
              <Text style={styles.amountSubtext}>Available Balance: ₹5,000.00</Text>

              {/* Custom Numeric Keypad */}
              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <TouchableOpacity key={num} style={styles.keypadBtn} onPress={() => handleKeypad(num.toString())}>
                    <Text style={styles.keypadText}>{num}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.keypadBtn} onPress={() => handleKeypad("00")}>
                  <Text style={styles.keypadText}>00</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadBtn} onPress={() => handleKeypad("0")}>
                  <Text style={styles.keypadText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadBtn} onPress={handleBackspace}>
                  <Feather name="delete" size={24} color={THEME.text} />
                </TouchableOpacity>
              </View>

              {/* Swipe to Send Slider */}
              <View style={styles.swipeContainerWrap}>
                <View style={styles.swipeContainer}>
                  <Animated.View style={[styles.swipeBgFill, { backgroundColor: bgFill, width: Animated.add(pan.x, KNOB_WIDTH) }]} />
                  <Animated.Text style={[styles.swipeInstruction, { opacity: swipeOpacity }]}>
                    Swipe to Send Offline
                  </Animated.Text>
                  
                  <Animated.View
                    {...panResponder.panHandlers}
                    style={[styles.swipeKnob, { transform: [{ translateX: pan.x }] }]}
                  >
                    <Feather name="chevrons-right" size={24} color={THEME.text} />
                  </Animated.View>
                </View>
                {!hasInternet && <Text style={styles.offlineWarning}>Will relay via BLE mesh until an internet gateway is found.</Text>}
              </View>

            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  blob1: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: THEME.primary,
    opacity: 0.15,
  },
  blob2: {
    position: "absolute",
    bottom: "20%",
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: THEME.secondary,
    opacity: 0.1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 40,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.glassBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  glassCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: THEME.glassBorder,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    color: THEME.text,
    fontSize: 16,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 32,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 12,
  },
  scanText: {
    color: THEME.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primary,
    padding: 16,
    borderRadius: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  step2Container: {
    flex: 1,
    paddingTop: 20,
    alignItems: "center",
  },
  payingToText: {
    fontSize: 16,
    fontWeight: "600",
    color: THEME.text,
    marginBottom: 24,
  },
  amountDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: "700",
    color: THEME.textMuted,
    marginRight: 8,
  },
  amountText: {
    fontSize: 64,
    fontWeight: "900",
    color: THEME.text,
  },
  amountSubtext: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 40,
  },
  keypad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
    marginBottom: 40,
  },
  keypadBtn: {
    width: "30%",
    aspectRatio: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: THEME.glassBg,
    borderRadius: 16,
  },
  keypadText: {
    fontSize: 28,
    fontWeight: "700",
    color: THEME.text,
  },
  swipeContainerWrap: {
    alignItems: "center",
    width: "100%",
  },
  swipeContainer: {
    width: SWIPE_WIDTH,
    height: KNOB_WIDTH,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 30,
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.glassBorder,
    marginBottom: 12,
  },
  swipeBgFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 30,
  },
  swipeInstruction: {
    position: "absolute",
    alignSelf: "center",
    color: THEME.textMuted,
    fontWeight: "700",
    fontSize: 15,
  },
  swipeKnob: {
    width: KNOB_WIDTH,
    height: KNOB_WIDTH,
    borderRadius: KNOB_WIDTH / 2,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  offlineWarning: {
    fontSize: 11,
    color: "#F59E0B", // Amber warning
    textAlign: "center",
    maxWidth: "80%",
  }
});
