import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  danger: "#EF4444"
};

// Mock Recent Transactions Data
const MOCK_TRANSACTIONS = [
  { id: "1", type: "send", name: "Ravi Kumar", amount: "550", date: "Today, 10:24 AM", status: "Settled" },
  { id: "2", type: "receive", name: "Alice", amount: "1,200", date: "Yesterday", status: "Settled" },
  { id: "3", type: "send", name: "Coffee Shop", amount: "240", date: "Mar 22", status: "Settled" },
  { id: "4", type: "send", name: "David (Offline)", amount: "150", date: "Mar 21", status: "Relaying" },
];

export default function HomeDashboard(): React.JSX.Element {
  const { userWalletAddress } = useWallet();
  const { hasInternet } = useBle(); // NetInfo wrapped in BleContext
  
  const [profile, setProfile] = useState<{ realUpiId: string; hopHandle: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await AsyncStorage.getItem("@user_profile");
      if (p) setProfile(JSON.parse(p));
    } catch {}
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleAction = (route: any) => {
    if(route === "mesh") {
      router.push("/(tabs)/mesh");
    } else if (route === "send") {
      router.push("/transaction");
    } else if (route === "receive") {
      router.push("/receive"); // Assuming receive is outside tabs or update routing
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />}
      >
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.handleText}>{profile?.hopHandle || "user@hoppay"}</Text>
          </View>
          <View style={[styles.networkBadge, hasInternet ? styles.badgeOnline : styles.badgeOffline]}>
            <View style={[styles.statusDot, { backgroundColor: hasInternet ? THEME.success : "#F59E0B" }]} />
            <Text style={styles.networkText}>{hasInternet ? "Online" : "Mesh Mode"}</Text>
          </View>
        </View>

        {/* Balance Card (Glassmorphism) */}
        <BlurView intensity={30} tint="dark" style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>₹5,000<Text style={styles.decimals}>.00</Text></Text>
          <View style={styles.walletIdRow}>
            <Text style={styles.walletIdText} numberOfLines={1} ellipsizeMode="middle">
              {userWalletAddress || "0x..."}
            </Text>
            <Feather name="copy" size={14} color={THEME.textMuted} />
          </View>
        </BlurView>

        {/* Quick Actions Row */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("send")}>
            <View style={[styles.actionButton, { backgroundColor: THEME.primary }]}>
              <Feather name="arrow-up-right" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("receive")}>
            <View style={[styles.actionButton, { backgroundColor: THEME.secondary }]}>
              <Feather name="arrow-down-left" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Feather name="maximize" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("mesh")}>
            <View style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Feather name="radio" size={24} color="#FFF" />
            </View>
            <Text style={styles.actionLabel}>Mesh</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsList}>
          {MOCK_TRANSACTIONS.map((tx) => (
            <BlurView intensity={20} tint="dark" key={tx.id} style={styles.txCard}>
              <View style={[styles.txIconBox, { backgroundColor: tx.type === 'send' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                <Feather 
                  name={tx.type === 'send' ? "arrow-up-right" : "arrow-down-left"} 
                  size={20} 
                  color={tx.type === 'send' ? THEME.danger : THEME.success} 
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txName}>{tx.name}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>
                  {tx.type === 'send' ? "-" : "+"}₹{tx.amount}
                </Text>
                <Text style={[styles.txStatus, { color: tx.status === 'Settled' ? THEME.success : "#F59E0B" }]}>
                  {tx.status}
                </Text>
              </View>
            </BlurView>
          ))}
        </View>
      </ScrollView>
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
    top: 0,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: THEME.primary,
    opacity: 0.25,
    transform: [{ scaleX: 1.2 }, { scaleY: 1.5 }],
  },
  blob2: {
    position: "absolute",
    top: 250,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: THEME.secondary,
    opacity: 0.2,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  greeting: {
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: "600",
  },
  handleText: {
    fontSize: 20,
    color: THEME.text,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  badgeOffline: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  networkText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.text,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    marginBottom: 32,
  },
  balanceLabel: {
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "900",
    color: THEME.text,
    letterSpacing: -1,
  },
  decimals: {
    fontSize: 28,
    color: THEME.textMuted,
  },
  walletIdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
  },
  walletIdText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontFamily: "monospace",
    maxWidth: 150,
    marginRight: 8,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  actionItem: {
    alignItems: "center",
    flex: 1,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: THEME.glassBorder,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: THEME.text,
  },
  transactionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.primary,
  },
  transactionsList: {
    gap: 12,
    paddingBottom: 40,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  txIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.text,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 2,
  },
  txStatus: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
