import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import { router } from "expo-router";
import { Colors } from "@/constants/theme";
import { useWallet, ScannedAddress } from "@/contexts/WalletContext";
import { NeoBrutalismColors } from '@/constants/neoBrutalism';
import { useBle } from "@/contexts/BleContext";
import { CONTRACT_CONFIG } from "@/constants/contracts";
import { ethers } from "ethers";

// --- QR Parsing ---
export interface MerchantQRData {
  toAddress: string;
  merchantName?: string;
  upiId?: string;
  amount?: string;
  note?: string;
}

/**
 * Parse a QR code string into structured merchant data.
 * Supports:
 *  - Raw Ethereum address: 0x...
 *  - meshpay URI: meshpay://0xABC?name=Merchant&amount=100
 *  - UPI URI: upi://pay?pa=merchant@upi&pn=Name&am=100&tn=Note
 *  - JSON blob: {"address":"0x...","name":"Merchant"}
 */
export function parseMerchantQR(raw: string): MerchantQRData | null {
  const trimmed = raw.trim();

  // 1. Raw Ethereum address
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { toAddress: trimmed };
  }

  // 2. meshpay:// URI — meshpay://0xABC123?name=CafeBlue&amount=50&upi=cafe@upi
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

  // 3. UPI URI — upi://pay?pa=vpa@bank&pn=Name&am=100&tn=Note
  //    We map `pa` (UPI VPA) to upiId, and embed address lookup.
  //    Since UPI QRs don't carry a crypto address, we use the UPI VPA as
  //    the "toAddress" placeholder and flag it — the Relayer resolves payout.
  if (trimmed.startsWith("upi://")) {
    try {
      const url = new URL(trimmed.replace("upi://", "https://upi/"));
      const pa = url.searchParams.get("pa");
      const pn = url.searchParams.get("pn");
      const am = url.searchParams.get("am");
      const tn = url.searchParams.get("tn");
      if (!pa) return null;
      // Use UPI VPA as pseudo address — relayer maps this to payout
      // "Address" field will hold upiId; TransactionLoader knows how to handle
      // We pad it to look like a valid param for routing purposes
      return {
        toAddress: `upi:${pa}`, // special prefix — transaction screen shows differently
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

  // MeshT token balance
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Use wallet context
  const {
    userWalletAddress,
    isLoggedIn,
    scannedAddresses,
    addScannedAddress,
    clearScannedAddresses,
    removeScannedAddress,
  } = useWallet();

  // Fetch MeshT token balance from the contract
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
      // Show up to 4 decimal places, strip trailing zeros
      const display = parseFloat(formatted).toFixed(4).replace(/\.?0+$/, '');
      setTokenBalance(display);
    } catch (error) {
      console.error("Failed to fetch token balance:", error);
      setTokenBalance("—");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [userWalletAddress]);

  // Auto-refresh balance every 30 seconds
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

    // Store the resolved address (raw Eth or upi:vpa) in the scanned list
    addScannedAddress(parsed.toAddress);

    // Navigate with full merchant metadata
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
      <View style={styles.addressItem}>
        <View style={styles.addressInfo}>
          {isUpi && (
            <View style={styles.upiTag}>
              <Text style={styles.upiTagText}>UPI</Text>
            </View>
          )}
          <Text
            style={styles.addressText}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayAddr}
          </Text>
          <Text style={styles.timestampText}>
            {item.timestamp.toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => {
            router.push({
              pathname: "/transaction",
              params: { toAddress: item.address },
            });
          }}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Camera permissions are now handled at wallet creation level
  // If user reaches this screen, we assume permissions are granted

  if (isScanning) {
    return (
      <SafeAreaView style={styles.container}>
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
      <View style={styles.content}>
      <Text style={styles.title}>QR Code Scanner</Text>

      {/* MeshT Token Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>MESHT BALANCE</Text>
          <TouchableOpacity onPress={fetchTokenBalance} disabled={isLoadingBalance}>
            <Text style={styles.refreshText}>{isLoadingBalance ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>
        {!isLoggedIn ? (
          <Text style={styles.balanceNoWallet}>No wallet connected</Text>
        ) : isLoadingBalance && tokenBalance === null ? (
          <ActivityIndicator size="small" color={NeoBrutalismColors.primary} style={{ marginVertical: 8 }} />
        ) : (
          <View style={styles.balanceValueRow}>
            <Text style={styles.balanceValue}>{tokenBalance ?? '—'}</Text>
            <Text style={styles.balanceSymbol}>MESHT</Text>
          </View>
        )}
        <Text style={styles.balanceContract}>
          Flow EVM Testnet · {CONTRACT_CONFIG.CONTRACT_ADDRESS.slice(0,6)}...{CONTRACT_CONFIG.CONTRACT_ADDRESS.slice(-4)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.scanButton}
        onPress={() => setIsScanning(true)}
      >
        <Text style={styles.scanButtonText}>Start Scanning</Text>
      </TouchableOpacity>

      <View style={styles.addressesSection}>
        <View style={styles.addressesHeader}>
          <Text style={styles.addressesTitle}>
            Scanned Addresses ({scannedAddresses.length})
          </Text>
          {scannedAddresses.length > 0 && (
            <TouchableOpacity onPress={clearAddresses}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {scannedAddresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No addresses scanned yet</Text>
            <Text style={styles.emptySubText}>
              Tap "Start Scanning" to scan your first QR code
            </Text>
          </View>
        ) : (
          <FlatList
            data={scannedAddresses}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item.id}
            style={styles.addressesList}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NeoBrutalismColors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: NeoBrutalismColors.textPrimary,
    textAlign: "center",
    marginBottom: 24,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scanButton: {
    backgroundColor: NeoBrutalismColors.primary,
    borderColor: NeoBrutalismColors.primary,
    borderWidth: 4,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 32,
    shadowColor: NeoBrutalismColors.primary,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  scanButtonText: {
    color: NeoBrutalismColors.textInverse,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
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
  addressesSection: {
    flex: 1,
  },
  addressesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  addressesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NeoBrutalismColors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clearText: {
    color: NeoBrutalismColors.primary,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  addressesList: {
    flex: 1,
  },
  addressItem: {
    backgroundColor: NeoBrutalismColors.surface,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: NeoBrutalismColors.borderSubtle,
    shadowColor: NeoBrutalismColors.primary,
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 0,
    elevation: 4,
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
    color: NeoBrutalismColors.textPrimary,
    marginBottom: 5,
    fontWeight: "600",
  },
  sendButton: {
    backgroundColor: NeoBrutalismColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NeoBrutalismColors.primary,
  },
  sendButtonText: {
    color: NeoBrutalismColors.textInverse,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timestampText: {
    fontSize: 12,
    color: NeoBrutalismColors.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: NeoBrutalismColors.textSecondary,
    marginBottom: 8,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 14,
    color: NeoBrutalismColors.textTertiary,
    textAlign: "center",
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
    letterSpacing: 0.5,
  },

  // --- MeshT Token Balance Card ---
  balanceCard: {
    backgroundColor: NeoBrutalismColors.surface,
    borderWidth: 3,
    borderColor: NeoBrutalismColors.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: NeoBrutalismColors.primary,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 0,
    elevation: 6,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: NeoBrutalismColors.primary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  refreshText: {
    fontSize: 18,
  },
  balanceNoWallet: {
    fontSize: 14,
    color: NeoBrutalismColors.textTertiary,
    fontStyle: "italic",
    marginVertical: 4,
  },
  balanceValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: "900",
    color: NeoBrutalismColors.textPrimary,
    marginRight: 8,
  },
  balanceSymbol: {
    fontSize: 16,
    fontWeight: "700",
    color: NeoBrutalismColors.primary,
  },
  balanceContract: {
    fontSize: 11,
    color: NeoBrutalismColors.textTertiary,
    fontFamily: "monospace",
  },
});
