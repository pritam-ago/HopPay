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

  // 1. Raw Ethereum address
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { toAddress: trimmed };
  }

  // 2. meshpay:// URI
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
    } catch {
      return null;
    }
  }

  // 3. UPI URI
  if (trimmed.startsWith("upi://")) {
    try {
      const url = new URL(trimmed.replace("upi://", "https://upi/"));
      const pa = url.searchParams.get("pa");
      const pn = url.searchParams.get("pn");
      const am = url.searchParams.get("am");
      const tn = url.searchParams.get("tn");
      if (!pa) return null;
      return {
        toAddress: `upi:${pa}`,
        upiId: pa,
        merchantName: pn ?? undefined,
        amount: am ?? undefined,
        note: tn ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // 4. JSON blob
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
  } catch {
    // not JSON
  }

  return null;
}

export default function Scan(): React.JSX.Element {
  const [isScanning, setIsScanning] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");

  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

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
      const contract = new ethers.Contract(
        CONTRACT_CONFIG.CONTRACT_ADDRESS,
        balanceAbi,
        provider
      );
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
      Alert.alert(
        "Unrecognized QR Code",
        "Supported formats: Ethereum address (0x…), UPI QR, meshpay:// URI, or JSON with address field."
      );
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
    Alert.alert(
      "Clear All Addresses",
      "Are you sure you want to clear all scanned addresses?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearScannedAddresses(),
        },
      ]
    );
  };

  const renderAddressItem = ({ item }: { item: ScannedAddress }) => {
    const isUpi = item.address.startsWith("upi:");
    const displayAddr = isUpi ? item.address.replace("upi:", "UPI: ") : item.address;
    return (
      <View style={styles.addressItem} key={item.id}>
        <View style={styles.addressInfo}>
          {isUpi && (
            <View style={styles.upiTag}>
              <Text style={styles.upiTagText}>UPI</Text>
            </View>
          )}
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {displayAddr}
          </Text>
          <Text style={styles.timestampText}>
            {item.timestamp.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.sendItemButton}
          onPress={() => {
            router.push({
              pathname: "/transaction",
              params: { toAddress: item.address },
            });
          }}
        >
          <Text style={styles.sendItemText}>Send</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isScanning) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing={facing}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanInstruction}>
              Point your camera at a QR code containing a wallet address
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsScanning(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.relayPill}>
            <View style={styles.relayDot} />
            <Text style={styles.relayText}>Relay: ON</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#8A8A8E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search @hoppay ID to pay..."
            placeholderTextColor="#8A8A8E"
          />
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <TouchableOpacity onPress={fetchTokenBalance} disabled={isLoadingBalance}>
              {isLoadingBalance ? (
                <ActivityIndicator size="small" color="#A0A0A0" />
              ) : (
                <Feather name="eye" size={16} color="#A0A0A0" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.balanceValueRow}>
            <Text style={styles.balanceValue}>{tokenBalance ?? "0"}</Text>
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
              <Feather name="copy" size={14} color="#E0E0E0" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.actionCircleButton}
              onPress={() => setIsScanning(true)}
            >
              <Feather name="maximize" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Scan</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.actionCircleButton}
              onPress={() => router.push("/show")}
            >
              <Feather name="credit-card" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Wallet</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.actionCircleButton}
              onPress={() => router.push("/mesh")}
            >
              <Feather name="share-2" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Mesh</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={styles.actionCircleButton}
              onPress={() => router.push("/receive")}
            >
              <Feather name="arrow-down-left" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Receive</Text>
          </View>
        </View>

        {/* People Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>People</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.peopleScroll}>
          <View style={styles.avatarCol}>
            <View style={[styles.avatarCircle, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.avatarInitial}>A</Text>
            </View>
            <Text style={styles.avatarName}>Alice</Text>
          </View>
          <View style={styles.avatarCol}>
            <View style={[styles.avatarCircle, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.avatarInitial}>B</Text>
            </View>
            <Text style={styles.avatarName}>Bob</Text>
          </View>
          <View style={styles.avatarCol}>
            <View style={[styles.avatarCircle, { backgroundColor: '#10B981' }]}>
              <Text style={styles.avatarInitial}>M</Text>
            </View>
            <Text style={styles.avatarName}>Merchant</Text>
          </View>
          <View style={styles.avatarCol}>
            <View style={[styles.avatarCircle, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.avatarInitial}>D</Text>
            </View>
            <Text style={styles.avatarName}>David</Text>
          </View>
        </ScrollView>

        {/* Recent Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <TouchableOpacity onPress={scannedAddresses.length > 0 ? clearAddresses : undefined}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentContainer}>
          {scannedAddresses.length === 0 ? (
            <View style={styles.emptyRecent}>
              <View style={styles.emptyRecentBox} />
            </View>
          ) : (
            scannedAddresses.map((item) => renderAddressItem({ item }))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A120D", // Dark rich green/black
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  helloText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontWeight: "500",
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  relayPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  relayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  relayText: {
    color: "#F3F4F6",
    fontSize: 14,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  balanceCard: {
    backgroundColor: "rgba(28, 30, 31, 1)",
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  balanceLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginRight: 8,
  },
  balanceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -2,
    marginRight: 12,
  },
  balanceSymbol: {
    color: "#6B7280",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 10,
  },
  userBadgeRow: {
    alignItems: "center",
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  userBadgeText: {
    color: "#E0E0E0",
    fontSize: 14,
    fontWeight: "500",
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginBottom: 36,
  },
  actionCol: {
    alignItems: "center",
  },
  actionCircleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(25, 25, 25, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  actionLabel: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  seeAllText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
  peopleScroll: {
    marginBottom: 32,
    overflow: "visible",
  },
  avatarCol: {
    alignItems: "center",
    marginRight: 24,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarInitial: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
  },
  avatarName: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "500",
  },
  recentContainer: {
    minHeight: 80,
  },
  emptyRecent: {
    alignItems: "center",
  },
  emptyRecentBox: {
    width: "100%",
    height: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  addressItem: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressInfo: {
    flex: 1,
    marginRight: 10,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "monospace",
    color: "#D1D5DB",
    marginBottom: 5,
    fontWeight: "600",
  },
  timestampText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  upiTag: {
    backgroundColor: "#10B981",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  upiTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  sendItemButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendItemText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "white",
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  scanInstruction: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 30,
    paddingHorizontal: 20,
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
