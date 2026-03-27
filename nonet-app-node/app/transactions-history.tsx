import React from "react";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  success: "#10B981",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  danger: "#EF4444"
};

// Expanded Mock Data
const MOCK_TRANSACTIONS = [
  { id: "1", type: "send", name: "Ravi Kumar", amount: "550", date: "Today, 10:24 AM", status: "Settled" },
  { id: "2", type: "receive", name: "Alice", amount: "1,200", date: "Yesterday, 8:00 PM", status: "Settled" },
  { id: "3", type: "send", name: "Coffee Shop", amount: "240", date: "Mar 22, 9:30 AM", status: "Settled" },
  { id: "4", type: "send", name: "David (Offline)", amount: "150", date: "Mar 21, 2:15 PM", status: "Relaying" },
  { id: "5", type: "receive", name: "Priya", amount: "3,000", date: "Mar 20, 11:45 AM", status: "Settled" },
  { id: "6", type: "send", name: "Groceries", amount: "1,850", date: "Mar 18, 5:20 PM", status: "Settled" },
  { id: "7", type: "send", name: "Movie Tickets", amount: "600", date: "Mar 15, 6:00 PM", status: "Settled" },
  { id: "8", type: "receive", name: "Refund", amount: "400", date: "Mar 12, 1:00 PM", status: "Settled" },
];

export default function TransactionsHistory(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.listContainer}>
        {MOCK_TRANSACTIONS.map((tx) => (
          <BlurView intensity={70} tint="dark" key={tx.id} style={styles.txCard}>
            <View style={[styles.txIconBox, { backgroundColor: tx.type === 'send' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
              <Feather 
                name={tx.type === 'send' ? "arrow-up-right" : "arrow-down-left"} 
                size={22} 
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 40,
    zIndex: 10,
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
  listContainer: {
    padding: 24,
    paddingBottom: 60,
    gap: 16,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    overflow: "hidden",
  },
  txIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    marginBottom: 4,
  },
  txDate: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 4,
  },
  txStatus: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
