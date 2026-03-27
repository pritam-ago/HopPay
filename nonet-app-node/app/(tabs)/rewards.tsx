import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

// --- Theme Constants (Glassmorphism + Dark Mode) ---
const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.05)",
  glassBorder: "rgba(255, 255, 255, 0.1)",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  success: "#10B981",
  accent: "#F59E0B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

export default function RewardsScreen(): React.JSX.Element {
  // Mock data for hackathon
  const [packetsRelayed, setPacketsRelayed] = useState(14);
  const [meshPoints, setMeshPoints] = useState(1400); // 100 points per packet

  const handleRedeem = () => {
    // Mock redeem action
    setMeshPoints(0);
    alert("Successfully redeemed 1400 Mesh Points for ₹14.00 INR!");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Relay Rewards</Text>
          <Text style={styles.subtitle}>
            Earn points by keeping Hop Pay open in the background to relay packets for others.
          </Text>
        </View>

        {/* Central glowing stat card */}
        <BlurView intensity={40} tint="dark" style={styles.glowingCard}>
          <View style={styles.glowRing}>
            <Text style={styles.pointsText}>{meshPoints}</Text>
            <Text style={styles.pointsLabel}>MESH POINTS</Text>
          </View>
        </BlurView>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <BlurView intensity={20} tint="dark" style={styles.statBox}>
            <Feather name="radio" size={24} color={THEME.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{packetsRelayed}</Text>
            <Text style={styles.statTitle}>Packets Relayed</Text>
          </BlurView>

          <BlurView intensity={20} tint="dark" style={styles.statBox}>
            <Feather name="wifi" size={24} color={THEME.success} style={styles.statIcon} />
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statTitle}>Gateway Uploads</Text>
          </BlurView>
        </View>

        {/* Redeem Section */}
        <BlurView intensity={30} tint="dark" style={styles.redeemCard}>
          <View style={styles.redeemHeader}>
            <View>
              <Text style={styles.redeemTitle}>Convert to INR</Text>
              <Text style={styles.redeemSub}>100 Points = ₹1.00</Text>
            </View>
            <Text style={styles.convertValue}>₹{(meshPoints / 100).toFixed(2)}</Text>
          </View>

          <TouchableOpacity 
            style={[styles.redeemBtn, meshPoints === 0 && styles.redeemBtnDisabled]} 
            onPress={handleRedeem}
            disabled={meshPoints === 0}
          >
            <Text style={styles.redeemBtnText}>Redeem Points</Text>
            <Feather name="arrow-right" size={20} color="#FFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </BlurView>

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
    top: 100,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: THEME.accent,
    opacity: 0.15,
  },
  blob2: {
    position: "absolute",
    bottom: -50,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: THEME.secondary,
    opacity: 0.15,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  glowingCard: {
    borderRadius: 24,
    padding: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    marginBottom: 24,
    overflow: "hidden",
  },
  glowRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    borderColor: "rgba(245, 158, 11, 0.3)", // Amber glow
    justifyContent: "center",
    alignItems: "center",
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  pointsText: {
    fontSize: 48,
    fontWeight: "900",
    color: THEME.accent,
  },
  pointsLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.text,
    letterSpacing: 2,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
    marginHorizontal: 6,
    alignItems: "center",
  },
  statIcon: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.text,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: THEME.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  redeemCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: THEME.glassBg,
    borderColor: THEME.glassBorder,
    borderWidth: 1,
  },
  redeemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  redeemTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
  },
  redeemSub: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 4,
  },
  convertValue: {
    fontSize: 24,
    fontWeight: "800",
    color: THEME.success,
  },
  redeemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primary,
    padding: 16,
    borderRadius: 16,
  },
  redeemBtnDisabled: {
    backgroundColor: THEME.glassBorder,
    opacity: 0.5,
  },
  redeemBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  }
});
