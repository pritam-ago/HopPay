import React, { useEffect, useState } from "react";
import { View, StyleSheet, SafeAreaView, Alert } from "react-native";
import {
  Text,
  Button,
  Card,
  Surface,
  ActivityIndicator,
  useTheme,
} from "react-native-paper";
import { router } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { useWallet, WalletData } from "@/contexts/WalletContext";
import {
  NeoBrutalButton,
  NeoBrutalCard,
  NeoBrutalHeader,
  NeoBrutalBadge,
  NeoBrutalDivider,
} from "@/components/NeoBrutalismComponents";
import { NeoBrutalismColors } from "@/constants/neoBrutalism";
import { requestBluetoothPermissions } from "@/utils/permissions";

export default function WelcomePage(): React.JSX.Element {
  const { isLoggedIn, createWallet } = useWallet();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    // Check if user already has a wallet and redirect to tabs
    if (isLoggedIn) {
      router.replace("/(tabs)");
    }
  }, [isLoggedIn]);

  // Callback function that gets triggered after wallet is successfully created
  const onWalletCreated = async (walletData: WalletData): Promise<void> => {
    try {
      console.log(
        "🚀 Wallet creation callback triggered for address:",
        walletData.address
      );

      // TODO: Callback for wallet creation
    } catch (error) {
      console.error("❌ Error in wallet creation callback:", error);
      // Don't throw - let wallet creation succeed even if API calls fail
    }
  };

  const handleCreateWallet = async () => {
    try {
      setIsCreatingWallet(true);

      console.log("🔐 Starting wallet creation with permission requests...");

      // 1. Request Camera Permission - Native dialog with timeout
      console.log("📷 Requesting camera permission...");
      try {
        const cameraResult = await Promise.race([
          requestCameraPermission(),
          new Promise<any>((_, reject) =>
            setTimeout(
              () => reject(new Error("Camera permission timeout")),
              10000
            )
          ),
        ]);
        console.log("Camera permission result:", cameraResult.status);
      } catch (cameraError) {
        console.warn(
          "⚠️ Camera permission error (continuing anyway):",
          cameraError
        );
      }

      // 2. Request Bluetooth Permissions - Native dialogs with timeout
      console.log("📶 Requesting Bluetooth permissions...");
      try {
        const bluetoothGranted = await Promise.race([
          requestBluetoothPermissions(),
          new Promise<boolean>((_, reject) =>
            setTimeout(
              () => reject(new Error("Bluetooth permission timeout")),
              10000
            )
          ),
        ]);
        console.log("Bluetooth permission result:", bluetoothGranted);
      } catch (bluetoothError) {
        console.warn(
          "⚠️ Bluetooth permission error (continuing anyway):",
          bluetoothError
        );
      }

      // Create wallet regardless of permission results
      // App will work with limited functionality if permissions denied
      console.log("🔐 Creating wallet...");
      await createWallet(onWalletCreated);

      console.log("✅ Wallet created, navigating to app...");
      // Navigate to main app
      router.replace("/(tabs)");
    } catch (error) {
      console.error("❌ Error creating wallet:", error);
      Alert.alert("Error", "Failed to create wallet. Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🌐</Text>
          </View>
          <Text style={styles.appName}>NoNet</Text>
        </View>

        {/* Create Wallet Button */}
        <View style={styles.buttonSection}>
          <NeoBrutalButton
            title={isCreatingWallet ? "Creating Wallet..." : "Create Wallet"}
            onPress={handleCreateWallet}
            variant="primary"
            size="large"
            disabled={isCreatingWallet}
            style={styles.createButton}
          />

          {isCreatingWallet && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator
                size="small"
                color={NeoBrutalismColors.primary}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },

  // Logo Section
  logoSection: {
    alignItems: "center",
    marginBottom: 80,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: NeoBrutalismColors.surfaceAlt,
    borderWidth: 4,
    borderColor: NeoBrutalismColors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: NeoBrutalismColors.primary,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 60,
  },
  appName: {
    fontSize: 48,
    fontWeight: "900",
    color: NeoBrutalismColors.textPrimary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // Button Section
  buttonSection: {
    alignItems: "center",
    width: "100%",
  },
  createButton: {
    minWidth: 280,
    marginBottom: 16,
  },
  loadingIndicator: {
    marginTop: 16,
  },
});
