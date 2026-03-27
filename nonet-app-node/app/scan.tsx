import React, { useState } from "react";
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { BlurView } from "expo-blur";

const THEME = {
  bg: "#0F172A", glassBg: "rgba(255, 255, 255, 0.15)", glassBorder: "rgba(255, 255, 255, 0.25)",
  primary: "#3B82F6", text: "#F8FAFC", textMuted: "#94A3B8"
};

export default function QRScanner(): React.JSX.Element {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) return <SafeAreaView style={styles.container} />;
  
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Feather name="arrow-left" size={24} color={THEME.text} /></TouchableOpacity>
        </View>
        <View style={styles.permissionBox}>
          <Feather name="camera-off" size={48} color={THEME.textMuted} style={{ marginBottom: 16 }} />
          <Text style={styles.permissionText}>We need your permission to show the camera to scan Hop Pay URLs</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={{ color: "#FFF", fontWeight: "700" }}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = ({ type, data }: any) => {
    setScanned(true);
    // Deep route right to the transaction page pre-filled
    router.replace({ pathname: "/transaction", params: { initId: data } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      
      {/* HUD Overlay */}
      <View style={styles.overlay}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={THEME.text} />
          </TouchableOpacity>
          <BlurView intensity={80} tint="dark" style={styles.titlePill}>
            <Text style={styles.titleText}>Scan QR to Pay</Text>
          </BlurView>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.centerCrop}>
          <View style={styles.cropBorder} />
          <Text style={styles.cropText}>Align QR code inside frame</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { padding: 20, paddingTop: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: THEME.glassBorder },
  overlay: { flex: 1, justifyContent: "space-between", padding: 24, paddingTop: 60, paddingBottom: 60 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titlePill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: THEME.glassBorder, overflow: "hidden" },
  titleText: { color: THEME.text, fontWeight: "800" },
  centerCrop: { flex: 1, justifyContent: "center", alignItems: "center" },
  cropBorder: { width: 250, height: 250, borderWidth: 2, borderColor: THEME.primary, borderRadius: 24, backgroundColor: "rgba(59,130,246,0.1)" },
  cropText: { color: "#FFF", marginTop: 24, fontWeight: "600", letterSpacing: 1 },
  permissionBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  permissionText: { color: THEME.textMuted, textAlign: "center", marginBottom: 24 },
  permissionBtn: { backgroundColor: THEME.primary, padding: 16, borderRadius: 16 }
});
