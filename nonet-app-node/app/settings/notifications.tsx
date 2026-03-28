import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.08)", glassBorder: "rgba(255, 255, 255, 0.2)",
  primary: "#3B82F6", success: "#10B981", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function NotificationsSettings(): React.JSX.Element {
  const [push, setPush] = useState(true);
  const [txn, setTxn] = useState(true);
  const [mesh, setMesh] = useState(false);

  const ToggleRow = ({ icon, title, desc, value, onValueChange, color }: any) => (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Feather name={icon} size={20} color="#FFF" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#3f3f46", true: THEME.success }} thumbColor="#FFF" />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <BlurView intensity={70} tint="dark" style={styles.card}>
          <ToggleRow icon="bell" title="Push Notifications" desc="Allow Hop Pay to send you system alerts." value={push} onValueChange={setPush} color="rgba(59, 130, 246, 0.8)" />
          <View style={styles.divider} />
          <ToggleRow icon="dollar-sign" title="Transaction Alerts" desc="Get notified when money hits your bank." value={txn} onValueChange={setTxn} color="rgba(16, 185, 129, 0.8)" />
          <View style={styles.divider} />
          <ToggleRow icon="radio" title="Mesh Relay Alerts" desc="Ping me when I relay someone else's packet." value={mesh} onValueChange={setMesh} color="rgba(245, 158, 11, 0.8)" />
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
  card: { borderRadius: 24, backgroundColor: THEME.glassBg, borderColor: THEME.glassBorder, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 20 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  textWrap: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: "700", color: THEME.text, marginBottom: 4 },
  desc: { fontSize: 12, color: THEME.textMuted },
  divider: { height: 1, backgroundColor: THEME.glassBorder, marginLeft: 76 }
});
