import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Animated,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { Stack, router } from "expo-router";

import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import { verifyGhostVoucher, VerificationResult } from "@/lib/signatureVerifier";
import { TransactionPayload } from "@/constants/contracts";
import DynamicBackground from "@/components/DynamicBackground";

// --- Theme Constants (Glassmorphism + Dark Mode) ---
const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  success: "#10B981",
  danger: "#EF4444",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

interface ReceivedVoucher {
  id: string;
  payload: TransactionPayload;
  rawJson: string;
  verification: VerificationResult;
  receivedAt: number;
  relayed: boolean;
  relayTxHash?: string;
}

const PENDING_QUEUE_KEY = "meshT_pending_vouchers";
const RELAYER_URL = "http://localhost:3001/relay"; 

export default function ReceiveScreen(): React.JSX.Element {
  const { userWalletAddress, isLoggedIn } = useWallet();
  const { masterState, hasInternet } = useBle();

  const [vouchers, setVouchers] = useState<ReceivedVoucher[]>([]);
  const [isListening, setIsListening] = useState(true);
  const [latestVoucher, setLatestVoucher] = useState<ReceivedVoucher | null>(null);
  const [isRelaying, setIsRelaying] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isListening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulseAnim]);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_QUEUE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved: ReceivedVoucher[] = JSON.parse(raw);
          setVouchers(saved);
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(vouchers));
  }, [vouchers]);

  useEffect(() => {
    masterState.forEach((state, id) => {
      if (!state.isComplete || state.isAck) return;
      if (processedIds.current.has(String(id))) return;

      let payload: TransactionPayload;
      try {
        payload = JSON.parse(state.fullMessage);
        if (payload.type !== "TRANSFER_WITH_AUTHORIZATION") return;
      } catch { return; }

      processedIds.current.add(String(id));
      handleIncomingVoucher(state.fullMessage, payload, String(id));
    });
  }, [masterState]);

  useEffect(() => {
    if (hasInternet) {
      const pending = vouchers.filter((v) => !v.relayed && v.verification.valid);
      if (pending.length > 0) relayPendingVouchers(pending);
    }
  }, [hasInternet]);

  const handleIncomingVoucher = useCallback(
    async (rawJson: string, payload: TransactionPayload, id: string) => {
      const verification = await verifyGhostVoucher(rawJson);
      const voucher: ReceivedVoucher = { id, payload, rawJson, verification, receivedAt: Date.now(), relayed: false };

      setVouchers((prev) => [voucher, ...prev]);
      setLatestVoucher(voucher);

      if (verification.valid && hasInternet) relayVoucher(voucher);
    },
    [hasInternet]
  );

  const relayVoucher = async (voucher: ReceivedVoucher) => {
    try {
      setIsRelaying(true);
      const response = await fetch(RELAYER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: voucher.rawJson,
      });
      const result = await response.json();

      if (result.success) {
        setVouchers((prev) =>
          prev.map((v) => v.id === voucher.id ? { ...v, relayed: true, relayTxHash: result.transactionHash } : v)
        );
      }
    } catch (err) { } finally { setIsRelaying(false); }
  };

  const relayPendingVouchers = async (pending: ReceivedVoucher[]) => {
    for (const v of pending) await relayVoucher(v);
  };

  const clearHistory = () => {
    Alert.alert("Clear History", "Remove all received vouchers?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear", style: "destructive", onPress: () => {
          setVouchers([]); setLatestVoucher(null); processedIds.current.clear();
        },
      },
    ]);
  };

  if (!isLoggedIn || !userWalletAddress) {
    return (
      <SafeAreaView style={styles.container}>
        <DynamicBackground />
        <View style={styles.emptyCenter}>
          <Feather name="lock" size={48} color={THEME.textMuted} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>No Wallet</Text>
          <Text style={styles.emptySubtext}>Create a wallet first to receive payments.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receive</Text>
          <View style={[styles.networkBadge, hasInternet ? styles.badgeOnline : styles.badgeOffline]}>
            <View style={[styles.statusDot, { backgroundColor: hasInternet ? THEME.success : "#F59E0B" }]} />
            <Text style={styles.networkText}>{hasInternet ? "Online" : "Mesh"}</Text>
          </View>
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <BlurView intensity={70} tint="dark" style={styles.qrCard}>
            <Text style={styles.sectionLabel}>YOUR PAYMENT QR</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={userWalletAddress} size={200} color="#000" backgroundColor="#FFF" />
            </View>
            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
              {userWalletAddress}
            </Text>
          </BlurView>
        </View>

        {/* Listening Indicator */}
        <BlurView intensity={50} tint="dark" style={styles.listeningSection}>
          <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }], backgroundColor: isListening ? THEME.success : THEME.danger }]} />
          <Text style={styles.listeningText}>{isListening ? "Listening for BLE payments…" : "Paused"}</Text>
          <TouchableOpacity style={styles.toggleButton} onPress={() => setIsListening((v) => !v)}>
            <Text style={styles.toggleButtonText}>{isListening ? "PAUSE" : "RESUME"}</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Latest Payment Banner */}
        {latestVoucher && (
          <BlurView intensity={70} tint="dark" style={[styles.latestBanner, latestVoucher.verification.valid ? styles.successBanner : styles.errorBanner]}>
            <Feather name={latestVoucher.verification.valid ? "check-circle" : "x-circle"} size={32} color={latestVoucher.verification.valid ? THEME.success : THEME.danger} style={{ marginRight: 16 }} />
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{latestVoucher.verification.valid ? "Payment Received" : "Invalid Voucher"}</Text>
              {latestVoucher.verification.valid ? (
                <>
                  <Text style={styles.bannerAmount}>+{latestVoucher.verification.amountFormatted} MESHT</Text>
                  <Text style={styles.bannerFrom}>Fr: {latestVoucher.verification.from?.slice(0, 8)}…{latestVoucher.verification.from?.slice(-6)}</Text>
                  {latestVoucher.relayed ? (
                    <Text style={styles.relayedTag}>✓ Settled on-chain</Text>
                  ) : (
                    <Text style={styles.pendingTag}>⏳ Pending relay{hasInternet ? " (relaying…)" : ""}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.bannerError}>{latestVoucher.verification.error}</Text>
              )}
            </View>
          </BlurView>
        )}

        {/* Voucher History */}
        {vouchers.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>Voucher History</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {vouchers.map((v) => (
              <BlurView intensity={50} tint="dark" key={v.id} style={[styles.historyItem, v.verification.valid ? styles.validItem : styles.invalidItem]}>
                <View style={styles.historyItemLeft}>
                  <Text style={styles.historyAmount}>{v.verification.valid ? `+${v.verification.amountFormatted} MESHT` : "INVALID"}</Text>
                  <Text style={styles.historyTime}>{new Date(v.receivedAt).toLocaleTimeString()}</Text>
                  {v.relayTxHash && (
                    <Text style={styles.historyTxHash} numberOfLines={1}>Tx: {v.relayTxHash.slice(0, 14)}…</Text>
                  )}
                </View>
                <View style={styles.historyItemRight}>
                  <Text style={[styles.historyStatus, v.relayed ? styles.statusSettled : v.verification.valid ? styles.statusPending : styles.statusInvalid]}>
                    {v.relayed ? "SETTLED" : v.verification.valid ? "PENDING" : "INVALID"}
                  </Text>
                </View>
              </BlurView>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 40, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  networkBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  badgeOnline: { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)" },
  badgeOffline: { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.4)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  networkText: { fontSize: 12, fontWeight: "700", color: THEME.text },
  qrSection: { alignItems: "center", paddingTop: 16, paddingHorizontal: 24 },
  qrCard: { width: "100%", borderRadius: 24, padding: 32, alignItems: "center", backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  sectionLabel: { fontSize: 12, fontWeight: "800", color: THEME.textMuted, letterSpacing: 2, marginBottom: 24, textTransform: "uppercase" },
  qrWrapper: { padding: 16, backgroundColor: "#FFF", borderRadius: 24, marginBottom: 24 },
  addressText: { fontSize: 12, fontFamily: "monospace", color: THEME.textMuted, paddingHorizontal: 16, textAlign: "center" },
  listeningSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, marginHorizontal: 24, borderRadius: 16, borderWidth: 1, borderColor: THEME.glassBorder, marginTop: 24, overflow: "hidden" },
  pulseDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  listeningText: { flex: 1, fontSize: 14, fontWeight: "600", color: THEME.text },
  toggleButton: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  toggleButtonText: { color: "#FFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  latestBanner: { flexDirection: "row", marginHorizontal: 24, marginTop: 24, padding: 20, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  successBanner: { borderColor: "rgba(16, 185, 129, 0.5)", backgroundColor: "rgba(16, 185, 129, 0.1)" },
  errorBanner: { borderColor: "rgba(239, 68, 68, 0.5)", backgroundColor: "rgba(239, 68, 68, 0.1)" },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  bannerAmount: { fontSize: 24, fontWeight: "900", color: THEME.success, marginBottom: 4 },
  bannerFrom: { fontSize: 13, fontFamily: "monospace", color: THEME.textMuted, marginBottom: 8 },
  bannerError: { fontSize: 14, color: THEME.danger },
  relayedTag: { fontSize: 12, fontWeight: "700", color: THEME.success },
  pendingTag: { fontSize: 12, fontWeight: "700", color: "#F59E0B" },
  historySection: { paddingHorizontal: 24, marginTop: 32 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: THEME.text },
  clearText: { fontSize: 14, fontWeight: "600", color: THEME.primary },
  historyItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  validItem: { borderColor: THEME.glassBorder },
  invalidItem: { borderColor: "rgba(239, 68, 68, 0.4)" },
  historyItemLeft: { flex: 1 },
  historyItemRight: {},
  historyAmount: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 4 },
  historyTime: { fontSize: 12, color: THEME.textMuted, marginBottom: 4 },
  historyTxHash: { fontSize: 11, fontFamily: "monospace", color: THEME.textMuted },
  historyStatus: { fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: "hidden", letterSpacing: 0.5 },
  statusSettled: { backgroundColor: "rgba(16, 185, 129, 0.2)", color: THEME.success },
  statusPending: { backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#F59E0B" },
  statusInvalid: { backgroundColor: "rgba(239, 68, 68, 0.2)", color: THEME.danger },
  emptyCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 24, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  emptySubtext: { fontSize: 15, color: THEME.textMuted, textAlign: "center" },
});
