import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.08)", glassBorder: "rgba(255, 255, 255, 0.2)",
  text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function PrivacySettings(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <BlurView intensity={70} tint="dark" style={styles.card}>
          <Feather name="shield" size={48} color="#10B981" style={{ alignSelf: "center", marginBottom: 24 }} />
          
          <Text style={styles.sectionTitle}>Zero-Knowledge Architecture</Text>
          <Text style={styles.paragraph}>Hop Pay operates on a fundamentally different paradigm. We never store your wallet's private seed phrase on any central server. Transactions are signed using ECDSA mathematics locally on your device's hardware enclave.</Text>
          
          <Text style={styles.sectionTitle}>Data Collection Policy</Text>
          <Text style={styles.paragraph}>We collect absolutely zero telemetry while you are offline. When a packet reaches our gateway API, we only process the cryptographic payload needed to trigger the Decentro UPI settlement.</Text>
          
          <Text style={styles.sectionTitle}>Biometric Authentication</Text>
          <Text style={styles.paragraph}>By default, Hop Pay uses FaceID / TouchID to decrypt your local keystore before authorizing a high-value offline relay. (Simulation mode active for hackathon).</Text>
          
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>
          <Text style={styles.paragraph}>1. You acknowledge that Hop Pay is an experimental Mesh Network.{"\n"}2. You agree not to spoof packet timestamps.{"\n"}3. Settlement SLA is dependent on the physical density of nearby relayers.</Text>
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
  content: { padding: 24 },
  card: { borderRadius: 24, padding: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: THEME.text, marginBottom: 8 },
  paragraph: { fontSize: 13, color: THEME.textMuted, lineHeight: 22, marginBottom: 24 }
});
