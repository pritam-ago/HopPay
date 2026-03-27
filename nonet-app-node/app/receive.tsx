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
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import { NeoBrutalismColors } from "@/constants/neoBrutalism";
import { verifyGhostVoucher, VerificationResult } from "@/lib/signatureVerifier";
import { TransactionPayload } from "@/constants/contracts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceivedVoucher {
  id: string;
  payload: TransactionPayload;
  rawJson: string;
  verification: VerificationResult;
  receivedAt: number; // unix ms
  relayed: boolean;
  relayTxHash?: string;
}

const PENDING_QUEUE_KEY = "meshT_pending_vouchers";
const RELAYER_URL = "http://localhost:3001/relay"; // Replace with your deployed relayer URL

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReceiveScreen(): React.JSX.Element {
  const { userWalletAddress, isLoggedIn } = useWallet();
  const { masterState, hasInternet } = useBle();

  const [vouchers, setVouchers] = useState<ReceivedVoucher[]>([]);
  const [isListening, setIsListening] = useState(true);
  const [latestVoucher, setLatestVoucher] = useState<ReceivedVoucher | null>(null);
  const [isRelaying, setIsRelaying] = useState(false);

  // Pulse animation for the "listening" indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const processedIds = useRef(new Set<string>());

  // ─── Pulse Loop ──────────────────────────────────────────────────────────
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

  // ─── Load persisted queue on mount ───────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(PENDING_QUEUE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved: ReceivedVoucher[] = JSON.parse(raw);
          setVouchers(saved);
        } catch {/* ignore */}
      }
    });
  }, []);

  // ─── Persist queue whenever it changes ───────────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(vouchers));
  }, [vouchers]);

  // ─── Watch BLE MasterState for new incoming payloads ─────────────────────
  useEffect(() => {
    masterState.forEach((state, id) => {
      // Only process complete, non-ACK messages (those are incoming vouchers from senders)
      if (!state.isComplete || state.isAck) return;
      if (processedIds.current.has(String(id))) return;

      let payload: TransactionPayload;
      try {
        payload = JSON.parse(state.fullMessage);
        if (payload.type !== "TRANSFER_WITH_AUTHORIZATION") return;
      } catch {
        return;
      }

      processedIds.current.add(String(id));
      handleIncomingVoucher(state.fullMessage, payload, String(id));
    });
  }, [masterState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── When internet comes back, auto-relay pending vouchers ───────────────
  useEffect(() => {
    if (hasInternet) {
      const pending = vouchers.filter((v) => !v.relayed && v.verification.valid);
      if (pending.length > 0) {
        relayPendingVouchers(pending);
      }
    }
  }, [hasInternet]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handle an incoming BLE voucher ──────────────────────────────────────
  const handleIncomingVoucher = useCallback(
    async (rawJson: string, payload: TransactionPayload, id: string) => {
      // Local EIP-712 verification — pure cryptography, zero network calls
      const verification = await verifyGhostVoucher(rawJson);

      const voucher: ReceivedVoucher = {
        id,
        payload,
        rawJson,
        verification,
        receivedAt: Date.now(),
        relayed: false,
      };

      setVouchers((prev) => [voucher, ...prev]);
      setLatestVoucher(voucher);

      if (verification.valid) {
        // Immediately try to relay if we have internet
        if (hasInternet) {
          relayVoucher(voucher);
        }
      }
    },
    [hasInternet] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Relay a single voucher to the Node.js relayer ───────────────────────
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
          prev.map((v) =>
            v.id === voucher.id
              ? { ...v, relayed: true, relayTxHash: result.transactionHash }
              : v
          )
        );
      }
    } catch (err) {
      console.warn("Relay failed, will retry when online:", err);
    } finally {
      setIsRelaying(false);
    }
  };

  // ─── Relay all pending vouchers ───────────────────────────────────────────
  const relayPendingVouchers = async (pending: ReceivedVoucher[]) => {
    for (const v of pending) {
      await relayVoucher(v);
    }
  };

  const clearHistory = () => {
    Alert.alert("Clear History", "Remove all received vouchers?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setVouchers([]);
          setLatestVoucher(null);
          processedIds.current.clear();
        },
      },
    ]);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!isLoggedIn || !userWalletAddress) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>No Wallet</Text>
          <Text style={styles.emptySubtext}>
            Create a wallet first to receive payments.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>RECEIVE</Text>
          <View style={[styles.statusBadge, hasInternet ? styles.onlineBadge : styles.offlineBadge]}>
            <Text style={styles.statusBadgeText}>
              {hasInternet ? "🌐 ONLINE" : "📡 MESH MODE"}
            </Text>
          </View>
        </View>

        {/* QR Code — Merchant shows this to customers to scan */}
        <View style={styles.qrSection}>
          <Text style={styles.sectionLabel}>YOUR PAYMENT QR</Text>
          <View style={styles.qrWrapper}>
            <QRCode
              value={userWalletAddress}
              size={180}
              color="#000000"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {userWalletAddress}
          </Text>
        </View>

        {/* Listening Indicator */}
        <View style={styles.listeningSection}>
          <Animated.View
            style={[styles.pulseDot, { transform: [{ scale: pulseAnim }] }]}
          />
          <Text style={styles.listeningText}>
            {isListening ? "Listening for BLE payments…" : "Paused"}
          </Text>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsListening((v) => !v)}
          >
            <Text style={styles.toggleButtonText}>
              {isListening ? "PAUSE" : "RESUME"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Latest Payment Banner */}
        {latestVoucher && (
          <View
            style={[
              styles.latestBanner,
              latestVoucher.verification.valid
                ? styles.successBanner
                : styles.errorBanner,
            ]}
          >
            <Text style={styles.bannerIcon}>
              {latestVoucher.verification.valid ? "✅" : "❌"}
            </Text>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>
                {latestVoucher.verification.valid
                  ? "Payment Received (Offline)"
                  : "Invalid Voucher"}
              </Text>
              {latestVoucher.verification.valid ? (
                <>
                  <Text style={styles.bannerAmount}>
                    {latestVoucher.verification.amountFormatted} MESHT
                  </Text>
                  <Text style={styles.bannerFrom}>
                    From: {latestVoucher.verification.from?.slice(0, 8)}…
                    {latestVoucher.verification.from?.slice(-6)}
                  </Text>
                  {latestVoucher.relayed ? (
                    <Text style={styles.relayedTag}>✓ Settled on-chain</Text>
                  ) : (
                    <Text style={styles.pendingTag}>
                      ⏳ Pending relay{hasInternet ? " (relaying…)" : " (awaiting signal)"}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.bannerError}>
                  {latestVoucher.verification.error}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Voucher History */}
        {vouchers.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionLabel}>VOUCHER HISTORY ({vouchers.length})</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {vouchers.map((v) => (
              <View
                key={v.id}
                style={[
                  styles.historyItem,
                  v.verification.valid ? styles.validItem : styles.invalidItem,
                ]}
              >
                <View style={styles.historyItemLeft}>
                  <Text style={styles.historyAmount}>
                    {v.verification.valid
                      ? `${v.verification.amountFormatted} MESHT`
                      : "INVALID"}
                  </Text>
                  <Text style={styles.historyTime}>
                    {new Date(v.receivedAt).toLocaleTimeString()}
                  </Text>
                  {v.relayTxHash && (
                    <Text style={styles.historyTxHash} numberOfLines={1}>
                      Tx: {v.relayTxHash.slice(0, 14)}…
                    </Text>
                  )}
                </View>
                <View style={styles.historyItemRight}>
                  <Text
                    style={[
                      styles.historyStatus,
                      v.relayed
                        ? styles.statusSettled
                        : v.verification.valid
                        ? styles.statusPending
                        : styles.statusInvalid,
                    ]}
                  >
                    {v.relayed ? "SETTLED" : v.verification.valid ? "PENDING" : "INVALID"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {vouchers.length === 0 && !latestVoucher && (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryText}>
              No vouchers received yet.{"\n"}Ask a customer to scan your QR and pay.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NeoBrutalismColors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: NeoBrutalismColors.textPrimary,
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
  },
  onlineBadge: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
  },
  offlineBadge: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: NeoBrutalismColors.textSecondary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  qrSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 3,
    borderColor: NeoBrutalismColors.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 6,
  },
  addressText: {
    fontSize: 12,
    fontFamily: "monospace",
    color: NeoBrutalismColors.textSecondary,
    maxWidth: 280,
  },
  listeningSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: NeoBrutalismColors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: NeoBrutalismColors.border,
    marginTop: 16,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    marginRight: 10,
  },
  listeningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: NeoBrutalismColors.textPrimary,
  },
  toggleButton: {
    backgroundColor: NeoBrutalismColors.primary,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  latestBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 3,
  },
  successBanner: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  bannerIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: NeoBrutalismColors.textPrimary,
    marginBottom: 4,
  },
  bannerAmount: {
    fontSize: 22,
    fontWeight: "900",
    color: "#047857",
    marginBottom: 2,
  },
  bannerFrom: {
    fontSize: 12,
    fontFamily: "monospace",
    color: NeoBrutalismColors.textSecondary,
    marginBottom: 6,
  },
  bannerError: {
    fontSize: 13,
    color: "#B91C1C",
  },
  relayedTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  pendingTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
  },
  historySection: {
    paddingHorizontal: 16,
    marginTop: 20,
    paddingBottom: 30,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
    color: NeoBrutalismColors.primary,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: 10,
  },
  validItem: {
    backgroundColor: NeoBrutalismColors.surface,
    borderColor: NeoBrutalismColors.border,
  },
  invalidItem: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  historyItemLeft: {
    flex: 1,
  },
  historyItemRight: {},
  historyAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: NeoBrutalismColors.textPrimary,
  },
  historyTime: {
    fontSize: 11,
    color: NeoBrutalismColors.textSecondary,
    marginTop: 2,
  },
  historyTxHash: {
    fontSize: 10,
    fontFamily: "monospace",
    color: NeoBrutalismColors.textTertiary,
    marginTop: 2,
  },
  historyStatus: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  statusSettled: {
    backgroundColor: "#D1FAE5",
    color: "#047857",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
    color: "#B45309",
  },
  statusInvalid: {
    backgroundColor: "#FEE2E2",
    color: "#B91C1C",
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: NeoBrutalismColors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: NeoBrutalismColors.textSecondary,
    textAlign: "center",
  },
  emptyHistory: {
    padding: 24,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 13,
    color: NeoBrutalismColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
