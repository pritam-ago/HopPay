import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.08)", glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#3B82F6", secondary: "#8B5CF6", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function AboutSettings(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>About Hop Pay</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.logomark}>
          <Feather name="radio" size={48} color="#FFF" />
        </View>
        <Text style={styles.appName}>HOP PAY</Text>
        <Text style={styles.version}>v1.0.0 (Hackathon Release)</Text>

        <BlurView intensity={70} tint="dark" style={styles.card}>
          <Text style={styles.sectionTitle}>What is this?</Text>
          <Text style={styles.paragraph}>Hop Pay is an offline-first digital payment system designed for scenarios where internet access is unavailable (festivals, flights, disasters).</Text>
          
          <Text style={styles.sectionTitle}>How does it work?</Text>
          <Text style={styles.paragraph}>Instead of establishing a TCP connection to a bank, your phone constructs a cryptographically signed "Voucher" and blasts it via Bluetooth Low Energy (BLE). Nearby phones catch this beacon and relay it further.</Text>

          <Text style={styles.sectionTitle}>How does the receiver get money?</Text>
          <Text style={styles.paragraph}>Once the relayed packet finally reaches any random device connected to the internet, that device acts as a Gateway and uploads the packet to our Node.js server. The server verifies the ECDSA signature and uses the Decentro API to deposit real fiat INR directly into the receiver's associated UPI Bank Account.</Text>

          <View style={styles.teamTag}>
            <Feather name="code" size={16} color={THEME.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: THEME.primary, fontWeight: "700" }}>Built with Expo & React Native</Text>
          </View>
        </BlurView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  content: { padding: 24, alignItems: "center" },
  logomark: { width: 100, height: 100, borderRadius: 50, backgroundColor: THEME.primary, justifyContent: "center", alignItems: "center", marginBottom: 16, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  appName: { fontSize: 32, fontWeight: "900", color: THEME.text, letterSpacing: 2 },
  version: { fontSize: 13, color: THEME.secondary, fontWeight: "700", marginBottom: 32, fontFamily: "monospace" },
  card: { width: "100%", borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  paragraph: { fontSize: 13, color: THEME.textMuted, lineHeight: 22, marginBottom: 24 },
  teamTag: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.15)", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }
});
