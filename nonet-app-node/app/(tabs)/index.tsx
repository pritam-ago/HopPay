import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, RefreshControl, TextInput, ActivityIndicator, LayoutAnimation } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWallet } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import DynamicBackground from "@/components/DynamicBackground";
import { CONTRACT_CONFIG } from "@/constants/contracts";
import { ethers } from "ethers";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#79D93E", secondary: "#8B5CF6", success: "#10B981", text: "#F8FAFC", textMuted: "#94A3B8", danger: "#EF4444"
};

const MOCK_TRANSACTIONS = [
  { id: "1", type: "send", name: "Ravi Kumar", amount: "55", date: "Today, 10:24 AM", status: "Settled" },
  { id: "2", type: "receive", name: "Alice", amount: "120", date: "Yesterday", status: "Settled" },
  { id: "3", type: "send", name: "Coffee Shop", amount: "24", date: "Mar 22", status: "Settled" },
  { id: "4", type: "send", name: "David (Offline)", amount: "15", date: "Mar 21", status: "Relaying" },
];

const MOCK_PEOPLE = [
  { id: "alice@hoppay", name: "Alice", letter: "A", color: "#79D93E" },
  { id: "bob@hoppay", name: "Bob", letter: "B", color: "#8B5CF6" },
  { id: "merchant@icici", name: "Merchant", letter: "M", color: "#10B981" },
  { id: "david@hoppay", name: "David", letter: "D", color: "#F59E0B" },
  { id: "emma@hoppay", name: "Emma", letter: "E", color: "#EF4444" },
  { id: "frank@hoppay", name: "Frank", letter: "F", color: "#3B82F6" },
  { id: "grace@hoppay", name: "Grace", letter: "G", color: "#8B5CF6" },
  { id: "harry@hoppay", name: "Harry", letter: "H", color: "#10B981" },
];

export default function HomeDashboard(): React.JSX.Element {
  const { userWalletAddress, isLoggedIn } = useWallet();
  const bleContext = useBle() as any;
  const isRelayEnabled = bleContext.isRelayEnabled ?? true;
  const setIsRelayEnabled = bleContext.setIsRelayEnabled;

  const [profile, setProfile] = useState<{ realUpiId: string; hopHandle: string; name?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);

  const toggleShowAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAllPeople(!showAllPeople);
  };

  const getFormattedName = (fullName: string) => {
    if (!fullName) return "User";
    const parts = fullName.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  // Fetch MeshT token balance from the contract (Integrated from SMS branch)
  const fetchTokenBalance = useCallback(async () => {
    if (!userWalletAddress) {
      setTokenBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.RPC_URL);
      const balanceAbi = ["function balanceOf(address owner) view returns (uint256)"];
      const contract = new ethers.Contract(
        CONTRACT_CONFIG.CONTRACT_ADDRESS,
        balanceAbi,
        provider
      );
      const balance = await contract.balanceOf(userWalletAddress) as bigint;
      const formatted = ethers.formatUnits(balance, 18);
      const display = parseFloat(formatted).toFixed(4).replace(/\.?0+$/, '');
      setTokenBalance(display);
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
      setTokenBalance("—");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [userWalletAddress]);

  useEffect(() => { 
    loadProfile(); 
    fetchTokenBalance();
    const interval = setInterval(fetchTokenBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchTokenBalance]);

  const loadProfile = async () => {
    try {
      const p = await AsyncStorage.getItem("@user_profile");
      if (p) setProfile(JSON.parse(p));
      else setProfile({ hopHandle: "user@hoppay", realUpiId: "user@icici", name: "Ravi Kumar" });
    } catch {}
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchTokenBalance().then(() => setRefreshing(false));
  }, [fetchTokenBalance]);

  const handleAction = (route: string) => {
    if(route === "mesh") router.push("/(tabs)/mesh");
    else if (route === "send") router.push("/transaction");
    else if (route === "scan") router.push("/scan"); 
    else if (route === "receive") router.push("/receive"); 
  };

  const handleToggleOffline = () => { if(setIsRelayEnabled) setIsRelayEnabled(!isRelayEnabled); };

  return (
    <SafeAreaView style={styles.container}>
      <DynamicBackground />
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.primary} />} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/show")}>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.handleText}>{getFormattedName(profile?.name || "Ravi Kumar")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.networkBadge, { borderColor: isRelayEnabled ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)" }]} onPress={handleToggleOffline}>
            <View style={[styles.statusDot, { backgroundColor: isRelayEnabled ? THEME.success : THEME.danger }]} />
            <Text style={styles.networkText}>{isRelayEnabled ? "Relay: ON" : "Relay: OFF"}</Text>
          </TouchableOpacity>
        </View>

        <BlurView intensity={90} tint="dark" style={styles.searchContainer}>
          <Feather name="search" size={20} color={THEME.textMuted} style={styles.searchIcon} />
          <TextInput style={styles.searchInput} placeholder="Search @hoppay ID to pay..." placeholderTextColor={THEME.textMuted} value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" onSubmitEditing={() => { if (searchQuery.trim()) router.push({ pathname: "/transaction", params: { initId: searchQuery } }); }}/>
        </BlurView>

        <BlurView intensity={100} tint="dark" style={styles.balanceCard}>
          <View style={styles.balanceHeaderRow}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <TouchableOpacity onPress={() => setIsBalanceVisible(!isBalanceVisible)} style={{ padding: 4 }}>
              <Feather name={isBalanceVisible ? "eye" : "eye-off"} size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 3 }}>
            {!isLoggedIn ? (
              <Text style={styles.balanceAmount}>---</Text>
            ) : isLoadingBalance && tokenBalance === null ? (
              <ActivityIndicator size="small" color={THEME.primary} />
            ) : (
              <Text style={styles.balanceAmount}>{isBalanceVisible ? tokenBalance ?? "0" : "***"}</Text>
            )}
            {isBalanceVisible && <Text style={styles.hcSymbol}> MESHT</Text>}
          </View>

          <TouchableOpacity style={styles.walletIdRow} onPress={() => Clipboard.setStringAsync(profile?.hopHandle || "user@hoppay")}>
            <Text style={styles.walletIdText} numberOfLines={1}>{profile?.hopHandle || "user@hoppay"}</Text>
            <Feather name="copy" size={14} color={THEME.textMuted} />
          </TouchableOpacity>
        </BlurView>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("send")}><BlurView intensity={100} tint="dark" style={styles.actionButton}><Feather name="arrow-up-right" size={24} color="#FFF" /></BlurView><Text style={styles.actionLabel}>Send</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("scan")}><BlurView intensity={100} tint="dark" style={styles.actionButton}><Feather name="maximize" size={24} color="#FFF" /></BlurView><Text style={styles.actionLabel}>Scan QR</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("receive")}><BlurView intensity={100} tint="dark" style={styles.actionButton}><Feather name="grid" size={24} color="#FFF" /></BlurView><Text style={styles.actionLabel}>My QR</Text></TouchableOpacity>
          <TouchableOpacity style={styles.actionItem} onPress={() => handleAction("mesh")}><BlurView intensity={100} tint="dark" style={styles.actionButton}><Feather name="radio" size={24} color="#FFF" /></BlurView><Text style={styles.actionLabel}>Radar</Text></TouchableOpacity>
        </View>

        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          <TouchableOpacity onPress={toggleShowAll}><Text style={styles.seeAll}>{showAllPeople ? "Show Less" : "See All"}</Text></TouchableOpacity>
        </View>
        <View style={styles.gridContainer}>
          {(showAllPeople ? MOCK_PEOPLE : MOCK_PEOPLE.slice(0, 4)).map((person) => (
            <TouchableOpacity key={person.id} style={styles.gridItem} onPress={() => router.push({ pathname: "/transaction", params: { initId: person.id } })}>
              <View style={[styles.personAvatar, { backgroundColor: person.color }]}><Text style={styles.personInitial}>{person.letter}</Text></View>
              <Text style={styles.personName}>{person.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.transactionsHeader, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={() => router.push("/history")}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
        </View>
        <View style={styles.transactionsList}>
          {MOCK_TRANSACTIONS.map((tx) => (
            <BlurView intensity={80} tint="dark" key={tx.id} style={styles.txCard}>
              <View style={[styles.txIconBox, { backgroundColor: tx.type === 'send' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}><Feather name={tx.type === 'send' ? "arrow-up-right" : "arrow-down-left"} size={20} color={tx.type === 'send' ? THEME.danger : THEME.success} /></View>
              <View style={styles.txInfo}><Text style={styles.txName}>{tx.name}</Text><Text style={styles.txDate}>{tx.date}</Text></View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>{tx.type === 'send' ? "-" : "+"} {isBalanceVisible ? `${tx.amount} MESHT` : "***"}</Text>
                <Text style={[styles.txStatus, { color: tx.status === 'Settled' ? THEME.success : "#F59E0B" }]}>{tx.status}</Text>
              </View>
            </BlurView>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  scrollContent: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting: { fontSize: 14, color: THEME.textMuted, fontWeight: "600" },
  handleText: { fontSize: 22, color: THEME.text, fontWeight: "800", letterSpacing: 0.5 },
  networkBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  networkText: { fontSize: 12, fontWeight: "700", color: THEME.text },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 52, marginBottom: 24, overflow: "hidden" },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 15 },
  balanceCard: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden", alignItems: "center", marginBottom: 16 },
  balanceHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  balanceLabel: { fontSize: 14, color: THEME.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginRight: 8 },
  balanceAmount: { fontSize: 56, fontWeight: "900", color: THEME.text, letterSpacing: -1, lineHeight: 60 },
  hcSymbol: { fontSize: 24, color: THEME.textMuted, fontWeight: "bold" },
  walletIdRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderColor: THEME.glassBorder, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginTop: 16 },
  walletIdText: { color: THEME.text, fontSize: 14, fontFamily: "monospace", fontWeight: "600", marginRight: 8 },
  actionsContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  actionItem: { alignItems: "center", flex: 1 },
  actionButton: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: THEME.glassBorder, overflow: "hidden" },
  actionLabel: { fontSize: 12, fontWeight: "600", color: THEME.textMuted },
  transactionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: THEME.text },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8, paddingBottom: 8 },
  gridItem: { width: "25%", paddingHorizontal: 8, alignItems: "center", marginBottom: 16 },
  personAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 2, borderColor: THEME.glassBorder },
  personInitial: { fontSize: 20, fontWeight: "800", color: "#FFF" },
  personName: { fontSize: 12, fontWeight: "600", color: THEME.textMuted },
  seeAll: { fontSize: 14, fontWeight: "600", color: THEME.primary },
  transactionsList: { gap: 12 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden" },
  txIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  txInfo: { flex: 1 },
  txName: { fontSize: 16, fontWeight: "700", color: THEME.text, marginBottom: 2 },
  txDate: { fontSize: 12, color: THEME.textMuted },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 2 },
  txStatus: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
});
