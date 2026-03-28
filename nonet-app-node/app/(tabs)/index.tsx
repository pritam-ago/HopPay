import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useWallet, ScannedAddress } from "@/contexts/WalletContext";
import { useBle } from "@/contexts/BleContext";
import { CONTRACT_CONFIG } from "@/constants/contracts";
import { ethers } from "ethers";
import { Feather, Ionicons } from "@expo/vector-icons";

// --- QR Parsing ---
export interface MerchantQRData {
  toAddress: string;
  merchantName?: string;
  upiId?: string;
  amount?: string;
  note?: string;
}

export function parseMerchantQR(raw: string): MerchantQRData | null {
  const trimmed = raw.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return { toAddress: trimmed };
  if (trimmed.startsWith("meshpay://")) {
    try {
      const url = new URL(trimmed.replace("meshpay://", "https://meshpay/"));
      const address = url.pathname.replace(/^\//, "");
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
      return {
        toAddress: address,
        merchantName: url.searchParams.get("name") ?? undefined,
        amount: url.searchParams.get("amount") ?? undefined,
        upiId: url.searchParams.get("upi") ?? undefined,
        note: url.searchParams.get("note") ?? undefined,
      };
    } catch { return null; }
  }
  if (trimmed.startsWith("upi://")) {
    try {
      const url = new URL(trimmed.replace("upi://", "https://upi/"));
      const pa = url.searchParams.get("pa");
      if (!pa) return null;
      return {
        toAddress: `upi:${pa}`,
        upiId: pa,
        merchantName: url.searchParams.get("pn") ?? undefined,
        amount: url.searchParams.get("am") ?? undefined,
        note: url.searchParams.get("tn") ?? undefined,
      };
    } catch { return null; }
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.address && /^0x[a-fA-F0-9]{40}$/.test(parsed.address)) {
      return {
        toAddress: parsed.address,
        merchantName: parsed.name ?? parsed.merchantName,
        upiId: parsed.upiId ?? parsed.upi,
        amount: parsed.amount ? String(parsed.amount) : undefined,
        note: parsed.note,
      };
    }
  } catch {}
  return null;
}

export default function Scan(): React.JSX.Element {
  const [isScanning, setIsScanning] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  const {
    userWalletAddress,
    isLoggedIn,
    scannedAddresses,
    addScannedAddress,
    clearScannedAddresses,
  } = useWallet();

  const fetchTokenBalance = useCallback(async () => {
    if (!userWalletAddress) {
      setTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONTRACT_CONFIG.RPC_URL);
      const balanceAbi = ["function balanceOf(address owner) view returns (uint256)"];
      const contract = new ethers.Contract(CONTRACT_CONFIG.CONTRACT_ADDRESS, balanceAbi, provider);
      const balance = await contract.balanceOf(userWalletAddress) as bigint;
      const formatted = ethers.formatUnits(balance, 18);
      const display = parseFloat(formatted).toFixed(4).replace(/\.?0+$/, "");
      setTokenBalance(display);
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
      setTokenBalance("—");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [userWalletAddress]);

  useEffect(() => {
    fetchTokenBalance();
    const interval = setInterval(fetchTokenBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchTokenBalance]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    const parsed = parseMerchantQR(data);
    if (!parsed) {
      Alert.alert("Unrecognized QR Code", "Supported formats: Ethereum format or UPI QR");
      return;
    }
    setIsScanning(false);
    addScannedAddress(parsed.toAddress);
    router.push({
      pathname: "/transaction",
      params: {
        toAddress: parsed.toAddress,
        merchantName: parsed.merchantName ?? "",
        upiId: parsed.upiId ?? "",
        amount: parsed.amount ?? "",
        note: parsed.note ?? "",
      },
    });
  };

  const clearAddresses = () => {
    Alert.alert("Clear All", "Are you sure you want to clear history?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clearScannedAddresses() },
    ]);
  };

  const renderAddressItem = ({ item }: { item: ScannedAddress }) => {
    const isUpi = item.address.startsWith("upi:");
    const displayAddr = isUpi ? item.address.replace("upi:", "UPI: ") : item.address;
    return (
      <BlurView tint="dark" intensity={50} style={styles.addressItem} key={item.id}>
        <View style={styles.addressInfo}>
          {isUpi && <View style={styles.upiTag}><Text style={styles.upiTagText}>UPI</Text></View>}
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">{displayAddr}</Text>
          <Text style={styles.timestampText}>{item.timestamp.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.sendItemButton} onPress={() => router.push({ pathname: "/transaction", params: { toAddress: item.address } })}>
          <Text style={styles.sendItemText}>Send</Text>
        </TouchableOpacity>
      </BlurView>
    );
  };

  if (isScanning) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView 
          style={styles.camera} 
          facing={facing} 
          onBarcodeScanned={handleBarcodeScanned} 
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }} 
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame} />
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsScanning(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Liquid Glass Background Orbs */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <BlurView tint="dark" intensity={50} style={styles.relayPill}>
            <View style={styles.relayDot} />
            <Text style={styles.relayText}>Relay: ON</Text>
          </BlurView>
        </View>

        {/* Search */}
        <BlurView tint="dark" intensity={50} style={styles.searchContainer}>
          <Feather name="search" size={20} color="#FBBF24" />
          <TextInput style={styles.searchInput} placeholder="Search @hoppay ID to pay..." placeholderTextColor="#A0A0A0" />
        </BlurView>

        {/* Main Balance Card - Control Center Style */}
        <BlurView tint="dark" intensity={80} style={styles.balanceCard}>
          <LinearGradient
            colors={["rgba(251, 191, 36, 0.15)", "rgba(0,0,0,0.1)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          />
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <TouchableOpacity onPress={() => setIsBalanceHidden(!isBalanceHidden)} onLongPress={fetchTokenBalance} disabled={isLoadingBalance}>
              {isLoadingBalance ? <ActivityIndicator size="small" color="#FBBF24" /> : <Feather name={isBalanceHidden ? "eye-off" : "eye"} size={16} color="#FBBF24" />}
            </TouchableOpacity>
          </View>

          <View style={styles.balanceValueRow}>
            <Text style={styles.balanceValue}>{isBalanceHidden ? "••••" : (tokenBalance ?? "0")}</Text>
            <Text style={styles.balanceSymbol}>MESHT</Text>
          </View>

          <View style={styles.userBadgeRow}>
            <TouchableOpacity 
              style={styles.userBadge}
              onPress={async () => {
                if (userWalletAddress) {
                  await Clipboard.setStringAsync(userWalletAddress);
                  Alert.alert("Copied!", "Wallet address copied to clipboard.");
                }
              }}
            >
              <Text style={styles.userBadgeText}>
                {userWalletAddress ? `${userWalletAddress.slice(0, 6)}...${userWalletAddress.slice(-4)}` : "No Wallet"}
              </Text>
              <Feather name="copy" size={14} color="#FFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Action Buttons Row */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionCol}>
            <TouchableOpacity onPress={() => setIsScanning(true)}>
              <BlurView tint="dark" intensity={60} style={styles.actionCircleButton}>
                <Feather name="maximize" size={22} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Scan</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity onPress={() => router.push("/show")}>
              <BlurView tint="dark" intensity={60} style={styles.actionCircleButton}>
                <Feather name="credit-card" size={22} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Wallet</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity onPress={() => router.push("/mesh")}>
              <BlurView tint="dark" intensity={60} style={styles.actionCircleButton}>
                <Feather name="share-2" size={22} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Mesh</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity onPress={() => router.push("/receive")}>
              <BlurView tint="dark" intensity={60} style={styles.actionCircleButton}>
                <Feather name="arrow-down-left" size={22} color="#FFF" />
              </BlurView>
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Receive</Text>
          </View>
        </View>

        {/* People Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>See All</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.peopleScroll}>
          <View style={styles.avatarCol}>
             <BlurView tint="light" intensity={30} style={styles.avatarCircle}><Text style={styles.avatarInitial}>A</Text></BlurView>
             <Text style={styles.avatarName}>Alice</Text>
          </View>
          <View style={styles.avatarCol}>
             <BlurView tint="light" intensity={30} style={[styles.avatarCircle, {borderColor: '#8B5CF6'}]}><Text style={styles.avatarInitial}>B</Text></BlurView>
             <Text style={styles.avatarName}>Bob</Text>
          </View>
          <View style={styles.avatarCol}>
             <BlurView tint="light" intensity={30} style={styles.avatarCircle}><Text style={styles.avatarInitial}>M</Text></BlurView>
             <Text style={styles.avatarName}>Merchant</Text>
          </View>
        </ScrollView>

        {/* Recent Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={scannedAddresses.length > 0 ? clearAddresses : undefined}><Text style={styles.seeAllText}>See All</Text></TouchableOpacity>
        </View>
        <View style={styles.recentContainer}>
          {scannedAddresses.length === 0 ? (
            <BlurView tint="dark" intensity={40} style={styles.emptyRecentBox} />
          ) : (
            scannedAddresses.map((item) => renderAddressItem({ item }))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05080A" },
  bgGlowTop: {
    position: 'absolute',
    top: -150, left: -50,
    width: 350, height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(251, 191, 36, 0.4)',
    transform: [{ scaleX: 1.5 }],
    opacity: 0.6,
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -100, right: -50,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    transform: [{ scaleY: 1.2 }],
    opacity: 0.6,
  },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 24 },
  relayPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  relayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FBBF24", marginRight: 6 },
  relayText: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  searchContainer: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 18, paddingHorizontal: 16, height: 52,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 24, overflow: 'hidden',
  },
  searchInput: { flex: 1, marginLeft: 12, color: "#FFFFFF", fontSize: 16 },
  balanceCard: {
    borderRadius: 32, padding: 28, marginBottom: 32,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20,
  },
  balanceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  balanceLabel: { color: "#D1D5DB", fontSize: 13, fontWeight: "600", letterSpacing: 1.5, marginRight: 8 },
  balanceValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  balanceValue: { color: "#FFFFFF", fontSize: 64, fontWeight: "800", letterSpacing: -2, marginRight: 8 },
  balanceSymbol: { color: "rgba(255,255,255,0.6)", fontSize: 22, fontWeight: "600", marginBottom: 10 },
  userBadgeRow: { alignItems: "center" },
  userBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  userBadgeText: { color: "#E0E0E0", fontSize: 14, fontWeight: "500" },
  actionsContainer: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, marginBottom: 36 },
  actionCol: { alignItems: "center" },
  actionCircleButton: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", overflow: 'hidden',
  },
  actionLabel: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  seeAllText: { color: "#FBBF24", fontSize: 14, fontWeight: "600" },
  peopleScroll: { marginBottom: 32, overflow: "visible" },
  avatarCol: { alignItems: "center", marginRight: 24 },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center",
    marginBottom: 8, borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.4)", overflow: 'hidden',
  },
  avatarInitial: { color: "#FFF", fontSize: 24, fontWeight: "700" },
  avatarName: { color: "#E5E7EB", fontSize: 13, fontWeight: "500" },
  recentContainer: { minHeight: 80 },
  emptyRecentBox: { width: "100%", height: 60, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: 'hidden' },
  addressItem: {
    padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", overflow: 'hidden',
  },
  addressInfo: { flex: 1, marginRight: 10 },
  addressText: { fontSize: 14, fontFamily: "monospace", color: "#FFF", marginBottom: 5, fontWeight: "600" },
  timestampText: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  upiTag: { backgroundColor: "#FBBF24", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4 },
  upiTagText: { color: "#000", fontSize: 10, fontWeight: "800" },
  sendItemButton: { backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  sendItemText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFillObject },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  scanFrame: { width: 250, height: 250, borderWidth: 2, borderColor: "white", borderRadius: 20, backgroundColor: "transparent" },
  cancelButton: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, marginTop: 40 },
  cancelButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
