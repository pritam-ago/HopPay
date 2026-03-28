import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#79D93E", success: "#10B981", danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

const DB_HISTORY = [
  { id: "1", type: "send", name: "Ravi Kumar", amount: "55", date: "Today, 10:24 AM", status: "Settled" },
  { id: "2", type: "receive", name: "Alice", amount: "120", date: "Yesterday, 3:15 PM", status: "Settled" },
  { id: "3", type: "send", name: "Coffee Shop", amount: "24", date: "Mar 22, 8:30 AM", status: "Settled" },
  { id: "4", type: "send", name: "David (Offline)", amount: "15", date: "Mar 21, 4:20 PM", status: "Relaying" },
  { id: "5", type: "receive", name: "Bob", amount: "200", date: "Mar 20, 11:10 AM", status: "Settled" },
  { id: "6", type: "send", name: "Grocery Store", amount: "340", date: "Mar 19, 7:45 PM", status: "Settled" },
  { id: "7", type: "receive", name: "Alice", amount: "50", date: "Mar 18, 2:00 PM", status: "Settled" },
];

export default function TransactionsHistoryScreen(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Sent" | "Received">("All");
  const [sortAscending, setSortAscending] = useState(false);

  const orderedData = DB_HISTORY.filter(tx => {
    if (activeFilter === "Sent" && tx.type !== "send") return false;
    if (activeFilter === "Received" && tx.type !== "receive") return false;
    if (searchQuery.trim() !== "") {
      return tx.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  }).sort((a,b) => {
    const vA = parseFloat(a.amount);
    const vB = parseFloat(b.amount);
    return sortAscending ? vA - vB : vB - vA;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchSection}>
        <BlurView intensity={90} tint="dark" style={styles.searchContainer}>
          <Feather name="search" size={20} color={THEME.textMuted} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search transactions..." 
            placeholderTextColor={THEME.textMuted} 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
          />
        </BlurView>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAscending(!sortAscending)}>
          <Feather name={sortAscending ? "arrow-up" : "arrow-down"} size={20} color={THEME.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {["All", "Sent", "Received"].map((f) => (
          <TouchableOpacity 
            key={f} 
            style={[styles.filterPill, activeFilter === f && styles.activePill]} 
            onPress={() => setActiveFilter(f as any)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.activeFilterText]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.transactionsList}>
          {orderedData.length === 0 ? (
            <Text style={{ color: THEME.textMuted, textAlign: "center", marginTop: 40 }}>No matching transactions found.</Text>
          ) : orderedData.map((tx) => (
            <BlurView intensity={80} tint="dark" key={tx.id} style={styles.txCard}>
              <View style={[styles.txIconBox, { backgroundColor: tx.type === 'send' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                <Feather name={tx.type === 'send' ? "arrow-up-right" : "arrow-down-left"} size={20} color={tx.type === 'send' ? THEME.danger : THEME.success} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txName}>{tx.name}</Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={styles.txAmount}>{tx.type === 'send' ? "-" : "+"} {tx.amount} HC</Text>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 60, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  searchSection: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 16 },
  searchContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 52 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: THEME.text, fontSize: 15 },
  sortBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", marginLeft: 12, borderWidth: 1, borderColor: THEME.glassBorder },
  filterRow: { flexDirection: "row", paddingHorizontal: 24, marginBottom: 24, paddingBottom: 8 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: THEME.glassBg, borderWidth: 1, borderColor: THEME.glassBorder, marginRight: 12 },
  activePill: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  filterText: { color: THEME.textMuted, fontWeight: "600", fontSize: 14 },
  activeFilterText: { color: "#FFF" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
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
