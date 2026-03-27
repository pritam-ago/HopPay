import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useBle } from "@/contexts/BleContext";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, KeyboardState } from "react-native-reanimated";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", success: "#10B981", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function MeshSuccessScreen(): React.JSX.Element {
  const { broadcastMessage } = useBle();
  const params = useLocalSearchParams();
  const amt = params.amt as string || "0";
  const to = params.to as string || "Recipient";
  const [message, setMessage] = useState("");
  const [sentMsg, setSentMsg] = useState(false);

  // Radar Animation
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    scale.value = withRepeat(withTiming(3, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);
  const radarStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  const handleSendMessage = async () => {
    if(!message.trim()) return;
    setSentMsg(true);
    await broadcastMessage(JSON.stringify({ type: "MESSAGE", body: message, to }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        <View style={styles.radarContainer}>
          <Animated.View style={[styles.radarCircle, radarStyle]} />
          <View style={styles.radarCore}>
            <Feather name="radio" size={32} color={THEME.primary} />
          </View>
        </View>

        <View style={styles.content}>
          <BlurView intensity={70} tint="dark" style={styles.glassCard}>
            <Text style={styles.successTitle}>Transfer Initiated!</Text>
            <Text style={styles.successSub}>
              <Text style={{ fontWeight: "800", color: THEME.text }}>{amt} HC</Text> is propagating across the offline mesh network towards <Text style={{ fontWeight: "800", color: THEME.primary }}>{to}</Text>. Look out for incoming gateway ACKs.
            </Text>

            <TouchableOpacity style={styles.doneBtn} onPress={() => router.push("/(tabs)")}>
              <Text style={styles.doneBtnText}>Return Home</Text>
            </TouchableOpacity>
          </BlurView>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  radarContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  radarCircle: { position: "absolute", width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.primary },
  radarCore: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.bg, borderColor: THEME.primary, borderWidth: 4, justifyContent: "center", alignItems: "center", zIndex: 10 },
  content: { padding: 24, paddingBottom: 60 },
  glassCard: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  successTitle: { fontSize: 24, fontWeight: "800", color: THEME.text, textAlign: "center", marginBottom: 12 },
  successSub: { fontSize: 14, color: THEME.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 32 },
  msgBox: { marginBottom: 24 },
  msgLabel: { fontSize: 12, fontWeight: "700", color: THEME.textMuted, marginBottom: 8, textTransform: "uppercase" },
  msgInputRow: { flexDirection: "row", alignItems: "center" },
  msgInput: { flex: 1, height: 50, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: THEME.glassBorder, borderRadius: 12, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0, paddingHorizontal: 16, color: THEME.text },
  msgSendBtn: { height: 50, paddingHorizontal: 20, backgroundColor: THEME.primary, justifyContent: "center", alignItems: "center", borderTopRightRadius: 12, borderBottomRightRadius: 12 },
  sentBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.3)" },
  doneBtn: { backgroundColor: "rgba(255,255,255,0.1)", padding: 16, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  doneBtnText: { color: THEME.text, fontWeight: "700", fontSize: 16 }
});
