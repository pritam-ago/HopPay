import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity,
  Animated, PanResponder, Alert, Keyboard, TouchableWithoutFeedback, ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_CONFIG } from "@/constants/contracts";
import DynamicBackground from "@/components/DynamicBackground";
import { TransactionLoader } from "@/components/TransactionLoader";
import { ethers } from "ethers";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#79D93E", secondary: "#8B5CF6", success: "#10B981", text: "#F8FAFC", textMuted: "#94A3B8",
};

const MOCK_DB: Record<string, string> = {
  "alice@hoppay": "0x1234567890abcdef1234567890abcdef12345678",
  "bob@hoppay": "0xabcdef1234567890abcdef1234567890abcdef12",
  "merchant@icici": "0x9999999999abcdef9999999999abcdef99999999"
};

const RECENT_SENDS = [
  { id: "alice@hoppay", name: "Alice", letter: "A" },
  { id: "merchant@icici", name: "Merchant", letter: "M" },
  { id: "priya@hoppay", name: "Priya", letter: "P" },
  { id: "david@hoppay", name: "David", letter: "D" },
  { id: "bob@hoppay", name: "Bob", letter: "B" },
];

const SWIPE_WIDTH = 280;
const KNOB_WIDTH = 60;

export default function TransactionPage(): React.JSX.Element {
  const { userWalletAddress, isLoggedIn } = useWallet();
  const params = useLocalSearchParams<{
    initId?: string;
    toAddress?: string;
    merchantName?: string;
    upiId?: string;
    amount?: string;
    note?: string;
  }>();

  // If we came from the scanner with `toAddress`, initialize step 2 immediately
  const initialReceiver = params.toAddress || params.initId || "";
  const initialStep = (params.toAddress || params.initId) ? 2 : 1;

  const [step, setStep] = useState<1 | 2>(initialStep);
  const [receiverId, setReceiverId] = useState(initialReceiver);
  const [resolvedAddress, setResolvedAddress] = useState(params.toAddress || "");
  const [amount, setAmount] = useState<string>(params.amount || "0");
  const [message, setMessage] = useState(params.note || "");
  const [showAllRecent, setShowAllRecent] = useState(false);

  // SMS branch loader state
  const [showTransactionLoader, setShowTransactionLoader] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const swipeOpacity = pan.x.interpolate({ inputRange: [0, SWIPE_WIDTH - KNOB_WIDTH], outputRange: [1, 0], extrapolate: "clamp" });
  const bgFill = pan.x.interpolate({ inputRange: [0, SWIPE_WIDTH - KNOB_WIDTH], outputRange: ["transparent", THEME.success], extrapolate: "clamp" });

  const handleSendRef = useRef<any>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }), 
      onPanResponderRelease: (e, gesture) => {
        if (gesture.dx > (SWIPE_WIDTH - KNOB_WIDTH) * 0.8) {
          Animated.spring(pan, { toValue: { x: SWIPE_WIDTH - KNOB_WIDTH, y: 0 }, useNativeDriver: false }).start(() => { 
            if (handleSendRef.current) handleSendRef.current(); 
          });
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
      onPanResponderGrant: () => { pan.setOffset({ x: (pan.x as any)._value, y: 0 }); pan.setValue({ x: 0, y: 0 }); }
    })
  ).current;

  // Attempt to resolve known aliases if we entered via initId in step 1
  useEffect(() => { 
    if (params.initId && step === 1) handleNextStep(); 
  }, [params.initId]);

  const handleNextStep = () => {
    Keyboard.dismiss();
    const cleanId = receiverId.trim().toLowerCase();
    
    // Check if it's already a valid eth address or upi
    if (/^0x[a-fA-F0-9]{40}$/.test(cleanId) || cleanId.startsWith("upi:")) {
      setResolvedAddress(cleanId);
      setStep(2);
    } 
    else if (MOCK_DB[cleanId]) { 
      setResolvedAddress(MOCK_DB[cleanId]); 
      setStep(2); 
    } 
    else if (cleanId.includes("@")) { 
      setResolvedAddress("0x" + Math.random().toString(16).slice(2).padStart(40, "0")); 
      setStep(2); 
    } 
    else { 
      Alert.alert("Invalid ID", "Please enter a valid @hoppay ID, UPI Id, or 0x address."); 
    }
  };

  const handleSend = async () => {
    if (!isLoggedIn || !userWalletAddress) {
      Alert.alert('Error', 'Please create a wallet first');
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      return;
    }

    if (amount === "0" || parseFloat(amount) <= 0 || !resolvedAddress) {
      Alert.alert("Invalid Transfer", "Enter an amount and select a valid recipient before swiping.");
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      return;
    }

    // Hand over control to TransactionLoader which signs & broadcasts
    setShowTransactionLoader(true);
  };

  handleSendRef.current = handleSend;

  const handleTransactionComplete = (fullMessage?: string) => {
    setShowTransactionLoader(false);
    
    if (fullMessage) {
      try {
        const response = JSON.parse(fullMessage);

        if (response.success || response.simulated) {
          // Both actual network success and offline "simulated" relay success
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          router.replace({ 
            pathname: "/mesh-success", 
            params: { payload: fullMessage, to: receiverId, amt: amount } 
          });
          return;
        }

        // Transaction was NOT successful 
        const errorMsg = response.error || `Transaction failed at stage: ${response.stage || 'unknown'}`;
        Alert.alert('Transaction Failed', errorMsg, [{ text: 'OK' }]);
      } catch {
        Alert.alert('Transaction Failed', 'Received an invalid response from the network.', [{ text: 'OK' }]);
      }
    } else {
      Alert.alert('Transaction Failed', 'No confirmation received from the blockchain.', [{ text: 'OK' }]);
    }
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };

  const handleTransactionCancel = () => {
    setShowTransactionLoader(false);
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };

  const isUpiPayment = resolvedAddress.startsWith("upi:") || !!params.upiId;

  // Show loader if transaction is being processed
  if (showTransactionLoader) {
    const finalToAddress = isUpiPayment
      ? (CONTRACT_CONFIG.RELAYER_PRIVATE_KEY 
          ? new ethers.Wallet(CONTRACT_CONFIG.RELAYER_PRIVATE_KEY).address 
          : resolvedAddress)
      : resolvedAddress;

    return (
      <View style={{ flex: 1, backgroundColor: THEME.bg }}>
        <DynamicBackground />
        <TransactionLoader
          onComplete={handleTransactionComplete}
          onCancel={handleTransactionCancel}
          transactionData={{
            amount,
            currency: "MESHT",
            toAddress: finalToAddress,
            chain: "Flow EVM",
            chainId: 545,
            upiId: params.upiId || undefined,
            merchantName: params.merchantName || undefined,
          }}
        />
      </View>
    );
  }

  const visibleRecents = showAllRecent ? RECENT_SENDS.slice(0, 12) : RECENT_SENDS.slice(0, 4);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 && !params.toAddress ? setStep(1) : router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Tokens</Text>
        <View style={{ width: 44 }} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.content}>
          
          {params.merchantName && (
             <BlurView intensity={90} tint="dark" style={[styles.glassCard, { marginBottom: 16, borderColor: THEME.success }]}>
               <Text style={{ color: THEME.success, fontWeight: '800' }}>Paying {params.merchantName}</Text>
               {params.upiId && <Text style={{ color: THEME.textMuted, marginTop: 4 }}>UPI: {params.upiId}</Text>}
             </BlurView>
          )}

          {step === 1 ? (
            <>
              <BlurView intensity={90} tint="dark" style={[styles.glassCard, { marginBottom: 24 }]}>
                <Text style={styles.sectionTitle}>Who are you paying?</Text>
                <View style={styles.inputContainer}>
                  <Feather name="at-sign" size={20} color={THEME.textMuted} style={{ marginRight: 12 }} />
                  <TextInput style={styles.textInput} placeholder="@hoppay, Wallet ID, or UPI" placeholderTextColor={THEME.textMuted} value={receiverId} onChangeText={setReceiverId} autoCapitalize="none" autoCorrect={false} />
                </View>
                <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/scan")}>
                  <Feather name="maximize" size={20} color={THEME.text} style={{ marginRight: 8 }} />
                  <Text style={styles.scanText}>Open Camera to Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={handleNextStep}>
                  <Text style={styles.primaryButtonText}>Next</Text>
                  <Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </BlurView>

              <BlurView intensity={90} tint="dark" style={styles.glassCard}>
                <View style={styles.recentHeader}>
                  <Text style={{ color: THEME.text, fontWeight: "800", fontSize: 16 }}>Recently Sent</Text>
                </View>
                
                {RECENT_SENDS.length === 0 ? (
                  <Text style={{ textAlign: "center", color: THEME.textMuted, marginVertical: 32 }}>No recent transactions.</Text>
                ) : (
                  <>
                    <View style={styles.gridContainer}>
                      {visibleRecents.map((person) => (
                        <TouchableOpacity key={person.id} style={styles.gridItem} onPress={() => { setReceiverId(person.id); handleNextStep(); }}>
                          <View style={styles.recentAvatar}><Text style={styles.recentInitial}>{person.letter}</Text></View>
                          <Text style={styles.recentName} numberOfLines={1}>{person.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {RECENT_SENDS.length > 4 && (
                      <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setShowAllRecent(!showAllRecent)}>
                        <Text style={styles.viewMoreText}>{showAllRecent ? "Show Less" : "View More"}</Text>
                        <Feather name={showAllRecent ? "chevron-up" : "chevron-down"} size={16} color={THEME.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </BlurView>
            </>
          ) : (
            <BlurView intensity={90} tint="dark" style={[styles.glassCard, { flex: 0, paddingBottom: 40 }]}>
              {/* Payment details */}
              <Text style={styles.payingToText}>Paying <Text style={{ color: isUpiPayment ? THEME.success : THEME.primary }}>{params.merchantName || receiverId}</Text></Text>
              
              <View style={styles.amountDisplay}>
                <Text style={styles.amountText}>{amount}</Text>
                <Text style={styles.currencySymbol}>MESHT</Text>
              </View>

              {/* Optional Message Field */}
              <View style={styles.messageRow}>
                <Feather name="message-circle" size={16} color={THEME.textMuted} style={{ marginRight: 8 }} />
                <TextInput 
                  style={styles.messageInput} 
                  placeholder="Add a note (optional)" 
                  placeholderTextColor={THEME.textMuted}
                  value={message}
                  onChangeText={setMessage}
                  maxLength={40}
                />
              </View>
              
              <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <TouchableOpacity key={num} style={styles.keypadBtn} onPress={() => setAmount(prev => prev === "0" ? num.toString() : prev + num)}>
                    <Text style={styles.keypadText}>{num}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.keypadBtn} onPress={() => setAmount(prev => prev === "0" ? "00" : prev + "00")}><Text style={styles.keypadText}>00</Text></TouchableOpacity>
                <TouchableOpacity style={styles.keypadBtn} onPress={() => setAmount(prev => prev === "0" ? "0" : prev + "0")}><Text style={styles.keypadText}>0</Text></TouchableOpacity>
                <TouchableOpacity style={styles.keypadBtn} onPress={() => setAmount(prev => prev.length > 1 ? prev.slice(0,-1) : "0")}><Feather name="delete" size={24} color={THEME.text} /></TouchableOpacity>
              </View>
              <View style={styles.swipeContainerWrap}>
                <View style={styles.swipeContainer}>
                  <Animated.View style={[styles.swipeBgFill, { backgroundColor: bgFill, width: Animated.add(pan.x, KNOB_WIDTH) }]} />
                  <Animated.Text style={[styles.swipeInstruction, { opacity: swipeOpacity }]}>Swipe to Send Offline</Animated.Text>
                  <Animated.View {...panResponder.panHandlers} style={[styles.swipeKnob, { transform: [{ translateX: pan.x }] }]}><Feather name="chevrons-right" size={24} color={THEME.text} /></Animated.View>
                </View>
              </View>
            </BlurView>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 40, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  content: { paddingVertical: 24, paddingHorizontal: 24, justifyContent: "center" },
  glassCard: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 24, fontWeight: "800", color: THEME.text, marginBottom: 24 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, paddingHorizontal: 16, height: 60, borderWidth: 1, borderColor: THEME.glassBorder, marginBottom: 16 },
  textInput: { flex: 1, color: THEME.text, fontSize: 13 },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, marginBottom: 24, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, borderWidth: 1, borderColor: THEME.glassBorder },
  scanText: { color: THEME.text, fontWeight: "700", fontSize: 14 },
  recentHeader: { marginBottom: 20 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  gridItem: { width: "25%", paddingHorizontal: 8, alignItems: "center", marginBottom: 20 },
  recentAvatar: { width: 48, height: 48, borderRadius: 24,backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: THEME.glassBorder },
  recentInitial: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  recentName: { fontSize: 12, color: THEME.textMuted },
  viewMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  viewMoreText: { color: THEME.primary, fontWeight: "600", marginRight: 8 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: THEME.primary, padding: 16, borderRadius: 16 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  payingToText: { fontSize: 16, fontWeight: "600", color: THEME.text, marginBottom: 12, alignSelf: "center"},
  amountDisplay: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: 4 },
  currencySymbol: { fontSize: 28, fontWeight: "700", color: THEME.textMuted, marginLeft: 12 },
  amountText: { fontSize: 56, fontWeight: "900", color: THEME.text },
  amountSubtext: { fontSize: 13, color: THEME.textMuted, marginBottom: 16, alignSelf: "center" },
  messageRow: { flexDirection: "row", alignItems: "center", alignSelf: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: THEME.glassBorder, marginBottom: 24, width: "100%", maxWidth: 320 },
  messageInput: { flex: 1, color: THEME.text, fontSize: 14 },
  keypad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", width: "100%", maxWidth: 320, alignSelf:"center", marginBottom: 24 },
  keypadBtn: { width: "30%", aspectRatio: 1.5, justifyContent: "center", alignItems: "center", marginBottom: 12, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 16, borderColor: THEME.glassBorder, borderWidth: 1 },
  keypadText: { fontSize: 28, fontWeight: "700", color: THEME.text },
  swipeContainerWrap: { alignItems: "center", width: "100%" },
  swipeContainer: { width: SWIPE_WIDTH, height: KNOB_WIDTH, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 30, justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: THEME.glassBorder, marginBottom: 8 },
  swipeBgFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 30 },
  swipeInstruction: { position: "absolute", alignSelf: "center", color: THEME.textMuted, fontWeight: "700", fontSize: 15 },
  swipeKnob: { width: KNOB_WIDTH, height: KNOB_WIDTH, borderRadius: KNOB_WIDTH / 2, backgroundColor: THEME.primary, justifyContent: "center", alignItems: "center" }
});
