import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", success: "#10B981", danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

const ONGOING_TX = [
  { id: "tx-24", name: "David (Offline)", to: "david@hoppay", amount: "15", time: "Just now", status: "Propagating via Mesh (Hop 2)", stage: "2" },
  { id: "tx-22", name: "Alice", to: "alice@hoppay", amount: "50", time: "4 mins ago", status: "Awaiting Gateway ACK", stage: "3" }
];

export default function OngoingTrackerScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Tracker</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Ongoing Transactions</Text>
        
        {ONGOING_TX.length === 0 ? (
          <Text style={{ color: THEME.textMuted, textAlign: "center", marginTop: 40 }}>No active mesh transactions.</Text>
        ) : (
          <View style={styles.listContainer}>
            {ONGOING_TX.map((tx) => (
              <TouchableOpacity 
                key={tx.id} 
                onPress={() => router.push({ pathname: "/mesh-progress", params: { to: tx.to, amt: tx.amount, currentStage: tx.stage } })}
              >
                <BlurView intensity={80} tint="dark" style={styles.txCard}>
                  <View style={styles.txIconBox}>
                    <Feather name="activity" size={20} color={THEME.primary} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName}>{tx.name}</Text>
                    <Text style={styles.txDate}>{tx.time} • {tx.amount} HC</Text>
                  </View>
                  <View style={styles.txRight}>
                    <Feather name="chevron-right" size={20} color={THEME.textMuted} />
                  </View>
                </BlurView>
                <View style={styles.statusFooter}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{tx.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { alignItems: "flex-start", paddingHorizontal: 24, paddingTop: 60, zIndex: 10, marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: THEME.text, letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 120 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: THEME.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 },
  listContainer: { gap: 24 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden" },
  txIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(59, 130, 246, 0.15)", justifyContent: "center", alignItems: "center", marginRight: 16 },
  txInfo: { flex: 1 },
  txName: { fontSize: 16, fontWeight: "700", color: THEME.text, marginBottom: 4 },
  txDate: { fontSize: 12, color: THEME.textMuted },
  txRight: { alignItems: "flex-end" },
  statusFooter: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.2)", paddingHorizontal: 16, paddingVertical: 10, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderTopWidth: 0, borderColor: THEME.glassBorder },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.primary, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: "600", color: THEME.primary }
});
