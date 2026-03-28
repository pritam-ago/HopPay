import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import { verifyGhostVoucher, VerificationResult } from "@/lib/signatureVerifier";
import { TransactionPayload } from "@/constants/contracts";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

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

export default function ReceiveScreen() {
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
      } catch {
        return;
      }

      processedIds.current.add(String(id));
      handleIncomingVoucher(state.fullMessage, payload, String(id));
    });
  }, [masterState]);

  useEffect(() => {
    if (hasInternet) {
      const pending = vouchers.filter((v) => !v.relayed && v.verification.valid);
      if (pending.length > 0) {
        relayPendingVouchers(pending);
      }
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
          prev.map((v) => (v.id === voucher.id ? { ...v, relayed: true, relayTxHash: result.transactionHash } : v))
        );
      }
    } catch (err) {
      console.warn("Relay failed, will retry:", err);
    } finally {
      setIsRelaying(false);
    }
  };

  const relayPendingVouchers = async (pending: ReceivedVoucher[]) => {
    for (const v of pending) await relayVoucher(v);
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

  if (!isLoggedIn || !userWalletAddress) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyCenter}>
          <Feather name="lock" size={48} color="#4B5563" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>No Wallet</Text>
          <Text style={styles.emptySubtext}>Create a wallet first to receive payments.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Liquid Glass Background Orbs */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.headerTitle}>RECEIVE</Text>
          </View>
          <BlurView tint="dark" intensity={50} style={[styles.statusBadge, hasInternet ? styles.badgeOnline : styles.badgeOffline]}>
            <Text style={[styles.statusBadgeText, { color: hasInternet ? '#FBBF24' : '#F59E0B' }]}>
              {hasInternet ? "🌐 ONLINE" : "📡 MESH MODE"}
            </Text>
          </BlurView>
        </View>

        <BlurView tint="dark" intensity={60} style={styles.glassContainer}>
          <Text style={styles.sectionLabel}>YOUR PAYMENT QR</Text>
          <BlurView tint="light" intensity={30} style={styles.qrWrapper}>
            <QRCode value={userWalletAddress} size={180} color="#000000" backgroundColor="transparent" />
          </BlurView>
          <BlurView tint="dark" intensity={50} style={styles.addressBox}>
            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">{userWalletAddress}</Text>
          </BlurView>
        </BlurView>

        <BlurView tint="dark" intensity={50} style={styles.listeningSection}>
          <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulseAnim }], backgroundColor: isListening ? '#FBBF24' : '#4B5563' }]} />
          <Text style={styles.listeningText}>
            {isListening ? "Listening for BLE payments…" : "Paused"}
          </Text>
          <TouchableOpacity
            style={[styles.toggleButton, !isListening && styles.toggleButtonPaused]}
            onPress={() => setIsListening((v) => !v)}
          >
            <Text style={[styles.toggleButtonText, !isListening && { color: '#9CA3AF' }]}>
              {isListening ? "PAUSE" : "RESUME"}
            </Text>
          </TouchableOpacity>
        </BlurView>

        {latestVoucher && (
          <BlurView tint="dark" intensity={80} style={[styles.bannerCard, latestVoucher.verification.valid ? styles.bannerCardSuccess : styles.bannerCardError]}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerIconWrapper}>
                <Feather name={latestVoucher.verification.valid ? "check-circle" : "x-circle"} size={28} color={latestVoucher.verification.valid ? "#FBBF24" : "#EF4444"} />
              </View>
              <View style={styles.bannerDetails}>
                <Text style={styles.bannerTitle}>
                  {latestVoucher.verification.valid ? "Payment Received" : "Invalid Voucher"}
                </Text>
                {latestVoucher.verification.valid ? (
                  <>
                    <Text style={styles.bannerAmount}>{latestVoucher.verification.amountFormatted} MESHT</Text>
                    <Text style={styles.bannerFrom}>From: {latestVoucher.verification.from?.slice(0, 8)}...{latestVoucher.verification.from?.slice(-6)}</Text>
                    {latestVoucher.relayed ? (
                      <View style={styles.tagRow}><Feather name="check" size={14} color="#FBBF24" /><Text style={styles.settledTag}> Settled on-chain</Text></View>
                    ) : (
                      <View style={styles.tagRow}><Feather name="clock" size={14} color="#F59E0B" /><Text style={styles.pendingTag}> Pending relay{hasInternet ? " (relaying…)" : " (awaiting signal)"}</Text></View>
                    )}
                  </>
                ) : (
                  <Text style={styles.bannerError}>{latestVoucher.verification.error}</Text>
                )}
              </View>
            </View>
          </BlurView>
        )}

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionLabel}>VOUCHER HISTORY ({vouchers.length})</Text>
            {vouchers.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {vouchers.length === 0 && !latestVoucher ? (
            <BlurView tint="dark" intensity={40} style={styles.emptyHistoryBox}>
              <Feather name="inbox" size={32} color="#4B5563" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyHistoryText}>No vouchers received yet.{"\n"}Ask a customer to scan your QR.</Text>
            </BlurView>
          ) : (
            vouchers.map((v) => (
              <BlurView tint="dark" intensity={40} key={v.id} style={[styles.historyItem, v.verification.valid ? styles.hiValid : styles.hiInvalid]}>
                <View style={styles.historyItemLeft}>
                  <Text style={[styles.historyAmount, !v.verification.valid && { color: '#EF4444' }]}>
                    {v.verification.valid ? `${v.verification.amountFormatted} MESHT` : "INVALID"}
                  </Text>
                  <Text style={styles.historyTime}>{new Date(v.receivedAt).toLocaleTimeString()}</Text>
                  {v.relayTxHash && <Text style={styles.historyTxHash} numberOfLines={1}>Tx: {v.relayTxHash.slice(0, 14)}…</Text>}
                </View>
                <View style={[styles.hiStatusPill, v.relayed ? styles.hiPillSettled : v.verification.valid ? styles.hiPillPending : styles.hiPillInvalid]}>
                  <Text style={[styles.hiStatusText, v.relayed ? styles.hiTextSettled : v.verification.valid ? styles.hiTextPending : styles.hiTextInvalid]}>
                    {v.relayed ? "SETTLED" : v.verification.valid ? "PENDING" : "INVALID"}
                  </Text>
                </View>
              </BlurView>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080A',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -150, left: -50,
    width: 350, height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(251, 191, 36, 0.4)',
    transform: [{ scaleX: 1.5 }],
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100, right: -50,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    transform: [{ scaleY: 1.2 }],
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  badgeOnline: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' },
  badgeOffline: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  glassContainer: {
    marginHorizontal: 20,
    padding: 24,
    backgroundColor: 'rgba(20, 20, 20, 1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addressBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#D1D5DB',
  },
  listeningSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(20, 20, 20, 1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  listeningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  toggleButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  toggleButtonPaused: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toggleButtonText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  bannerCardSuccess: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  bannerCardError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bannerIconWrapper: {
    marginRight: 16,
  },
  bannerDetails: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F3F4F6',
    marginBottom: 8,
  },
  bannerAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FBBF24',
    marginBottom: 4,
  },
  bannerFrom: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  bannerError: {
    fontSize: 13,
    color: '#EF4444',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settledTag: { fontSize: 13, fontWeight: '700', color: '#FBBF24' },
  pendingTag: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  historySection: {
    paddingHorizontal: 20,
    marginTop: 32,
    paddingBottom: 40,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  hiValid: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  hiInvalid: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  historyItemLeft: { flex: 1 },
  historyAmount: { fontSize: 16, fontWeight: '800', color: '#F3F4F6' },
  historyTime: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  historyTxHash: { fontSize: 11, fontFamily: 'monospace', color: '#6B7280', marginTop: 4 },
  hiStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  hiPillSettled: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' },
  hiPillPending: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
  hiPillInvalid: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
  hiStatusText: { fontSize: 11, fontWeight: '800' },
  hiTextSettled: { color: '#FBBF24' },
  hiTextPending: { color: '#F59E0B' },
  hiTextInvalid: { color: '#EF4444' },
  emptyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(28, 30, 31, 0.5)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  emptyHistoryText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
});
