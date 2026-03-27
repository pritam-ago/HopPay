import React from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DynamicBackground from "@/components/DynamicBackground";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.08)", glassBorder: "rgba(255, 255, 255, 0.2)",
  danger: "#EF4444", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function DeleteAccount(): React.JSX.Element {

  const handleDelete = () => {
    Alert.alert(
      "Confirm Wallet Wipe",
      "This will permanently delete your ECDSA private key from this device. Any un-relayed offline transactions will be lost. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Wipe Wallet", 
          style: "destructive", 
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace("/"); // Kicks router back to welcome via layout checking missing data
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <DynamicBackground />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Danger Zone</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.content}>
        
        <View style={styles.warnIconBox}>
          <Feather name="alert-triangle" size={64} color="#EF4444" />
        </View>

        <Text style={styles.warnText}>Wipe Crypto Wallet</Text>
        <Text style={styles.subtext}>
          Hop Pay is a non-custodial mesh network. Deleting your account will destroy your local ECDSA private key. 
          {"\n\n"}
          Unless you have written down your 12-word seed phrase, you will lose access to this identity forever.
        </Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Nevermind, keep my wallet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Feather name="trash-2" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>I Understand. Wipe My Wallet</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.glassBg, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  headerTitle: { fontSize: 20, fontWeight: "700", color: THEME.text },
  content: { flex: 1, padding: 24, alignItems: "center" },
  warnIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(239, 68, 68, 0.15)", justifyContent: "center", alignItems: "center", marginBottom: 24, borderWidth: 2, borderColor: THEME.danger },
  warnText: { fontSize: 28, fontWeight: "900", color: THEME.text, marginBottom: 16 },
  subtext: { fontSize: 14, color: THEME.textMuted, textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
  cancelBtn: { padding: 16, width: "100%", alignItems: "center", marginBottom: 16 },
  cancelBtnText: { color: THEME.textMuted, fontSize: 16, fontWeight: "700" },
  deleteBtn: { flexDirection: "row", width: "100%", padding: 18, borderRadius: 16, backgroundColor: THEME.danger, justifyContent: "center", alignItems: "center", shadowColor: THEME.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
  deleteBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
