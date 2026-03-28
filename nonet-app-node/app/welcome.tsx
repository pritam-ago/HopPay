import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, TouchableOpacity } from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useCameraPermissions } from "expo-camera";
import { useWallet, WalletData } from "@/contexts/WalletContext";
import { requestBluetoothPermissions } from "@/utils/permissions";
import { Feather } from '@expo/vector-icons';

export default function WelcomePage(): React.JSX.Element {
  const { isLoggedIn, createWallet } = useWallet();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/(tabs)");
    }
  }, [isLoggedIn]);

  const onWalletCreated = async (walletData: WalletData): Promise<void> => {
    try {
      console.log("🚀 Wallet creation callback triggered for address:", walletData.address);
    } catch (error) {
      console.error("❌ Error in wallet creation callback:", error);
    }
  };

  const handleCreateWallet = async () => {
    try {
      setIsCreatingWallet(true);

      try {
        await Promise.race([
          requestCameraPermission(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Camera timeout")), 10000)),
        ]);
      } catch (e) {
        console.warn("Camera permission warning", e);
      }

      try {
        await Promise.race([
          requestBluetoothPermissions(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Bluetooth timeout")), 10000)),
        ]);
      } catch (e) {
        console.warn("Bluetooth permission warning", e);
      }

      await createWallet(onWalletCreated);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Error", "Failed to create wallet. Please try again.", [{ text: "OK" }]);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        
        <View style={styles.logoSection}>
          <View style={styles.logoContainerBubble}>
            <View style={styles.logoInner}>
              <Feather name="globe" size={64} color="#10B981" />
            </View>
          </View>
          <Text style={styles.appName}>NONET</Text>
          <Text style={styles.tagline}>The Offline Payment Mesh</Text>
        </View>

        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={[styles.createButton, isCreatingWallet && styles.createButtonDisabled]} 
            onPress={handleCreateWallet}
            disabled={isCreatingWallet}
          >
            {isCreatingWallet ? (
              <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 12 }} />
            ) : (
              <Feather name="plus" size={20} color="#FFF" style={{ marginRight: 12 }} />
            )}
            <Text style={styles.createButtonText}>
              {isCreatingWallet ? "Creating Wallet..." : "Create Wallet"}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A120D',
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'space-between',
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainerBubble: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  logoInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  appName: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 4,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: '#9CA3AF',
    letterSpacing: 1,
    fontWeight: '600',
  },
  bottomSection: {
    paddingBottom: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 20,
    borderRadius: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  createButtonDisabled: {
    backgroundColor: 'rgba(16, 185, 129, 0.5)',
    shadowOpacity: 0,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
