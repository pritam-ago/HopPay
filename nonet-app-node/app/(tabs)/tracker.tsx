import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";
import { useBle } from "@/contexts/BleContext";
import { ethers } from "ethers";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#79D93E", success: "#10B981", danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function OngoingTrackerScreen(): React.JSX.Element {
  const { masterState } = useBle();

  // Show only real-time physical BLE states
  const liveList = React.useMemo(() => {
    return Array.from(masterState.entries())
      .filter(([id, state]) => !state.isAck) // Show transactions still waiting on grid
      .map(([id, state]) => {
        let to = "Unknown";
        let amt = "0";
        try {
          const payload = JSON.parse(state.fullMessage);
          to = payload.parameters?.to || "Unknown node";
          if (payload.parameters?.value) {
            amt = parseFloat(ethers.formatUnits(payload.parameters.value, 18)).toFixed(2).replace(/\.00$/, '');
          }
        } catch {}

        return {
          id: `live-${id}`,
          name: "Live Propagating Node",
          to: to,
          amount: amt,
          time: "Just now",
          status: `Propagating Packets (${state.chunks.size}/${state.totalChunks || "?"})`,
          stage: "2",
          viaInternet: "false"
        };
      });
  }, [masterState]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Tracker</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Ongoing Transactions</Text>
        
        {liveList.length === 0 ? (
          <Text style={{ color: THEME.textMuted, textAlign: "center", marginTop: 40 }}>No active mesh transactions.</Text>
        ) : (
          <View style={styles.listContainer}>
            {liveList.map((tx) => (
              <TouchableOpacity 
                key={tx.id} 
                onPress={() => router.push({ pathname: "/mesh-progress", params: { to: tx.to, amt: tx.amount, currentStage: tx.stage, viaInternet: tx.viaInternet, txId: tx.id } })}
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
