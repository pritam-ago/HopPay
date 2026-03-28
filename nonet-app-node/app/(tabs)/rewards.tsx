import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useBle } from "@/contexts/BleContext";
import DynamicBackground from "@/components/DynamicBackground";

// --- Theme Constants (Glassmorphism + Dark Mode) ---
const THEME = {
  bg: "#0F172A",
  glassBg: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#79D93E",
  secondary: "#8B5CF6",
  success: "#10B981",
  accent: "#F59E0B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
};

export default function RewardsScreen(): React.JSX.Element {
  const bleContext = useBle() as any;
  const isRelayEnabled = bleContext.isRelayEnabled ?? true;
  const setIsRelayEnabled = bleContext.setIsRelayEnabled;

  const [packetsRelayed, setPacketsRelayed] = useState(14);
  const meshPoints = packetsRelayed * 0.001; // Dynamically multiply Hop Coins
  const [showSuccess, setShowSuccess] = useState(false);

  const handleRedeem = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setPacketsRelayed(0);
      setShowSuccess(false);
    }, 2500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <DynamicBackground />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Hop Rewards</Text>
        </View>

        {/* Central glowing stat card */}
        <View style={{ alignItems: "center", marginBottom: 40, marginTop: 16 }}>
          <View style={styles.glowRing}>
            <Text style={styles.pointsText}>{meshPoints}</Text>
            <Text style={styles.pointsLabel}>HOP COINS (HC)</Text>
          </View>
          <Text style={[styles.subtitle, { textAlign: "center", marginTop: 24, marginHorizontal: 20 }]}>
            Earn 0.001 HC for every single packet you securely relay in the background for offline users.
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <BlurView intensity={50} tint="dark" style={styles.statBox}>
            <Feather name="radio" size={24} color={THEME.primary} style={styles.statIcon} />
            <Text style={styles.statValue}>{packetsRelayed}</Text>
            <Text style={styles.statTitle}>Packets Relayed</Text>
          </BlurView>

          <BlurView intensity={50} tint="dark" style={styles.statBox}>
            <Feather name="wifi" size={24} color={THEME.success} style={styles.statIcon} />
            <Text style={styles.statValue}>2</Text>
            <Text style={styles.statTitle}>Gateway Uploads</Text>
          </BlurView>
        </View>

        {/* Network Participation Toggle */}
        <BlurView intensity={70} tint="dark" style={[styles.redeemCard, { marginBottom: 24 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={styles.redeemTitle}>Network Participation</Text>
            <Switch 
              value={isRelayEnabled} 
              onValueChange={(val) => setIsRelayEnabled && setIsRelayEnabled(val)}
              trackColor={{ false: "#333", true: THEME.success }}
              ios_backgroundColor="#333"
            />
          </View>
          <Text style={styles.redeemSub}>Keep this toggled ON to securely transfer packets in the background and earn HC rewards. Disable to save battery.</Text>
        </BlurView>

        {/* Redeem Section - Fixed Alignment */}
        <BlurView intensity={70} tint="dark" style={styles.redeemCard}>
          <View style={styles.redeemHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.redeemTitle}>Convert to INR</Text>
              <Text style={styles.redeemSub}>1 HC = ₹10.00</Text>
            </View>
            <Text style={styles.convertValue}>₹{(meshPoints * 10).toFixed(2)}</Text>
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

      {/* Success Animation Overlay */}
      {showSuccess && (
        <Animated.View 
          entering={FadeIn} 
          exiting={FadeOut} 
          style={StyleSheet.absoluteFillObject}
        >
          <BlurView intensity={90} tint="dark" style={styles.successOverlay}>
            <Animated.View entering={ZoomIn.springify()} exiting={ZoomOut} style={{ alignItems: "center" }}>
              <Feather name="check-circle" size={100} color={THEME.success} />
              <Text style={styles.successText}>₹{(meshPoints * 10).toFixed(2)} Settled!</Text>
              <Text style={styles.successSubtext}>Funds have been mapped to your UPI ID</Text>
            </Animated.View>
          </BlurView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 120, // Tab bar clearance
  },
  header: {
    marginBottom: 20,
    alignItems: "flex-start",
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
    lineHeight: 22,
    marginTop: 8,
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
    borderColor: "rgba(245, 158, 11, 0.4)", // Amber brighter glow
    justifyContent: "center",
    alignItems: "center",
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
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
    overflow: "hidden",
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
    fontSize: 28,
    fontWeight: "900",
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
    backgroundColor: "rgba(255,255,255,0.1)",
    opacity: 0.5,
  },
  redeemBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  successText: {
    fontSize: 32,
    fontWeight: "800",
    color: THEME.text,
    marginTop: 24,
  },
  successSubtext: {
    fontSize: 16,
    color: THEME.textMuted,
    marginTop: 8,
    fontWeight: "600",
  }
});
