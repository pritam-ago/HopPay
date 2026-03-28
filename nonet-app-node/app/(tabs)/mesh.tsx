import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useBle } from "@/contexts/BleContext";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", success: "#10B981", danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function PacketAdminScreen(): React.JSX.Element {
  const bleContext = useBle() as any;
  const isRelayEnabled = bleContext.isRelayEnabled ?? true;
  const setIsRelayEnabled = bleContext.setIsRelayEnabled;
  const masterState = bleContext.masterState;

  const packets = Array.from(masterState.values());

  return (
    <SafeAreaView style={styles.container}>
      <DynamicBackground />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relay Hop Radar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsRow}>
          <BlurView intensity={70} tint="dark" style={styles.statBox}>
            <Text style={styles.statValue}>{packets.length}</Text>
            <Text style={styles.statLabel}>Total Payloads</Text>
          </BlurView>
          <BlurView intensity={70} tint="dark" style={styles.statBox}>
            <Text style={[styles.statValue, { color: THEME.success }]}>{packets.filter((p: any) => p.isComplete).length}</Text>
            <Text style={styles.statLabel}>Fully Decoded</Text>
          </BlurView>
        </View>

        <Text style={[styles.headerSubtitle, { textAlign: 'center', marginHorizontal: 30, marginBottom: 32 }]}>
          Live view of encrypted packets crossing your device node
        </Text>

        <Text style={styles.logHeader}>Live Feed Logs</Text>

        {packets.length === 0 ? (
          <Text style={styles.emptyText}>No background packets relayed yet...</Text>
        ) : (
          packets.reverse().map((packet: any) => (
            <BlurView intensity={60} tint="dark" style={styles.packetCard} key={packet.id}>
              <View style={styles.packetRow}>
                <View style={styles.packetLeft}>
                  <Text style={styles.packetId}>ID: {Math.max(1000, packet.id).toString().slice(0,6)}</Text>
                  <Text style={styles.packetChunks}>Chunks: {packet.chunks.size}/{packet.totalChunks}</Text>
                </View>
                <View style={[styles.packetBadge, { backgroundColor: packet.isComplete ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)" }]}>
                  <Text style={[styles.packetBadgeText, { color: packet.isComplete ? THEME.success : "#F59E0B" }]}>
                    {packet.isComplete ? "Decoded" : "Receiving"}
                  </Text>
                </View>
              </View>
              {packet.isComplete && (
                <Text style={styles.packetData} numberOfLines={2}>
                  Payload: {packet.fullMessage}
                </Text>
              )}
            </BlurView>
          ))
        )}
      </ScrollView>

      {/* Re-broadcast Intercept Overlay */}
      {!isRelayEnabled && (
        <View style={styles.offlineOverlayWrapper}>
          <BlurView intensity={80} tint="dark" style={styles.overlayInner}>
            <View style={styles.overlayBox}>
              <Feather name="shield-off" size={60} color={THEME.textMuted} style={{ marginBottom: 16 }} />
              <Text style={styles.overlayTitle}>Relay Mode is Offline</Text>
              <Text style={styles.overlayDesc}>
                Your device is currently ignoring all incoming packets to conserve battery. You are not actively participating in the Hop Pay mesh.
              </Text>
              <TouchableOpacity style={styles.turnOnBtn} onPress={() => setIsRelayEnabled(true)}>
                <Text style={styles.turnOnText}>Turn On Relay</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { padding: 24, paddingTop: 60, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: THEME.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: THEME.textMuted, lineHeight: 18 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  statBox: { flex: 1, padding: 16, borderRadius: 16, alignItems: "center", marginHorizontal: 4, borderWidth: 1, borderColor: THEME.glassBorder },
  statValue: { fontSize: 28, fontWeight: "900", color: THEME.text, marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: "700", color: THEME.textMuted, textTransform: "uppercase" },
  logHeader: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 16 },
  emptyText: { color: THEME.textMuted, textAlign: "center", marginTop: 40, fontStyle: "italic" },
  packetCard: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: THEME.glassBorder, marginBottom: 12 },
  packetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  packetLeft: { flex: 1 },
  packetId: { color: THEME.text, fontWeight: "700", fontSize: 14, marginBottom: 2 },
  packetChunks: { color: THEME.textMuted, fontSize: 12 },
  packetBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  packetBadgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  packetData: { marginTop: 12, color: THEME.primary, fontSize: 12, fontFamily: "monospace", padding: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 8, overflow: "hidden" },
  offlineOverlayWrapper: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  overlayInner: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  overlayBox: { width: "100%", padding: 32, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: THEME.glassBorder, alignItems: "center" },
  overlayTitle: { fontSize: 22, fontWeight: "800", color: THEME.text, marginBottom: 16 },
  overlayDesc: { fontSize: 14, color: THEME.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  turnOnBtn: { backgroundColor: THEME.success, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, width: "100%", alignItems: "center" },
  turnOnText: { color: "#FFF", fontSize: 16, fontWeight: "700" }
});
