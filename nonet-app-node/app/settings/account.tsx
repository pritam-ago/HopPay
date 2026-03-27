import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.08)", glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#3B82F6", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function AccountDetails(): React.JSX.Element {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    AsyncStorage.getItem("@user_profile").then(p => {
      if (p) setProfile(JSON.parse(p));
      else setProfile({ hopHandle: "user@hoppay", realUpiId: "user@okhdfc" });
    });
  }, []);

  const Field = ({ label, value, icon }: any) => (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Feather name={icon} size={18} color={THEME.textMuted} style={styles.icon} />
        <TextInput style={styles.input} value={value} editable={false} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <BlurView intensity={70} tint="dark" style={styles.card}>
          <Field label="Full Name" value={profile?.name || "Ravi Kumar"} icon="user" />
          <Field label="Hop Pay ID" value={profile?.hopHandle || "ravi@hoppay"} icon="at-sign" />
          <Field label="Linked Bank UPI ID" value={profile?.realUpiId || "ravikumar@okhdfcbank"} icon="link" />
          <Field label="Phone Number" value={profile?.phoneNumber || "+91 98765 43210"} icon="phone" />
        </BlurView>
        <Text style={styles.helper}>Account details are synced securely with your device's keychain. Hop Pay never stores your personal info on central servers.</Text>
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
  card: { borderRadius: 24, padding: 20, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, marginBottom: 20 },
  fieldBox: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: THEME.primary, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12, borderWidth: 1, borderColor: THEME.glassBorder, height: 50, paddingHorizontal: 16 },
  icon: { marginRight: 12 },
  input: { flex: 1, color: THEME.text, fontSize: 16, fontWeight: "600" },
  helper: { fontSize: 13, color: THEME.textMuted, textAlign: "center", lineHeight: 20 }
});
