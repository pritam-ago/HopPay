import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, Stack } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSpring } from "react-native-reanimated";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", success: "#10B981", danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

const STAGES = [
  { id: 1, title: "Signed & Encrypted Locally", desc: "Cryptographic signature attached" },
  { id: 2, title: "Transmitted to Mesh", desc: "Payload successfully hopped to nearby devices" },
  { id: 3, title: "Gateway Uplink", desc: "A node found an internet connection" },
  { id: 4, title: "Confirmed & Settled", desc: "Funds officially updated on the ledger" }
];

export default function MeshProgressScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const amt = params.amt as string || "15";
  const to = params.to as string || "david@hoppay";
  const initialCurrentStage = parseInt(params.currentStage as string || "2", 10);
  
  const [currentStage, setCurrentStage] = useState(initialCurrentStage);

  // Radar Animation
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(3, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);
  const radarStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withSpring((currentStage / STAGES.length) * 100);
    // Simulate progression if not settled
    if (currentStage < 4) {
      const t = setTimeout(() => { setCurrentStage(prev => Math.min(prev + 1, 4)); }, 6000);
      return () => clearTimeout(t);
    }
  }, [currentStage]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${barWidth.value}%` }));

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction State</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Radar Graphic */}
        <View style={styles.radarContainer}>
          {currentStage < 4 ? (
            <>
              <Animated.View style={[styles.radarCircle, radarStyle]} />
              <View style={styles.radarCore}><Feather name="activity" size={32} color={THEME.primary} /></View>
            </>
          ) : (
            <View style={[styles.radarCore, { borderColor: THEME.success }]}><Feather name="check" size={40} color={THEME.success} /></View>
          )}
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryAmt}>{amt} HC</Text>
          <Text style={styles.summaryTo}>to {to}</Text>
        </View>

        <BlurView intensity={70} tint="dark" style={styles.stagesCard}>
          <Text style={styles.stagesTitle}>Network Propagation</Text>
          
          {/* Progress Bar */}
          <View style={styles.barBg}>
            <Animated.View style={[styles.barFill, progressStyle, currentStage === 4 && { backgroundColor: THEME.success }]} />
          </View>
          
          <View style={styles.list}>
            {STAGES.map((stage) => {
              const isDone = currentStage >= stage.id;
              const isCurrent = currentStage === stage.id;
              return (
                <View key={stage.id} style={[styles.stageRow, !isDone && !isCurrent && { opacity: 0.4 }]}>
                  <View style={styles.stageIconCol}>
                    <View style={[styles.stageDot, isDone && { backgroundColor: THEME.success, borderColor: THEME.success }, isCurrent && { backgroundColor: THEME.primary, borderColor: THEME.primary }]} />
                    {stage.id !== 4 && <View style={[styles.stageLine, (isDone || isCurrent) && { backgroundColor: THEME.glassBorder }]} />}
                  </View>
                  <View style={styles.stageTextCol}>
                    <Text style={[styles.stageHeading, isCurrent && { color: THEME.primary }, isDone && { color: THEME.success }]}>{stage.title}</Text>
                    <Text style={styles.stageDesc}>{stage.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </BlurView>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 60, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
  radarContainer: { height: 160, justifyContent: "center", alignItems: "center", marginVertical: 16 },
  radarCircle: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.primary },
  radarCore: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.bg, borderColor: THEME.primary, borderWidth: 4, justifyContent: "center", alignItems: "center", zIndex: 10 },
  summaryBox: { alignItems: "center", marginBottom: 32 },
  summaryAmt: { fontSize: 40, fontWeight: "900", color: THEME.text },
  summaryTo: { fontSize: 16, fontWeight: "600", color: THEME.textMuted },
  stagesCard: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  stagesTitle: { fontSize: 18, fontWeight: "800", color: THEME.text, marginBottom: 16 },
  barBg: { height: 6, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 3, marginBottom: 24, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: THEME.primary, borderRadius: 3 },
  list: {},
  stageRow: { flexDirection: "row", marginBottom: 16 },
  stageIconCol: { alignItems: "center", width: 24, marginRight: 16 },
  stageDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: THEME.textMuted, backgroundColor: "transparent", zIndex: 2 },
  stageLine: { width: 2, height: 40, backgroundColor: "rgba(255,255,255,0.05)", position: "absolute", top: 16 },
  stageTextCol: { flex: 1 },
  stageHeading: { fontSize: 15, fontWeight: "700", color: THEME.text, marginBottom: 2 },
  stageDesc: { fontSize: 12, color: THEME.textMuted }
});
