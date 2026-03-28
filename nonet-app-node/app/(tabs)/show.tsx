import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { useWallet } from '@/contexts/WalletContext';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function Show() {
  const { userWalletAddress, isLoggedIn, walletData } = useWallet();
  const [customAddress, setCustomAddress] = useState('');
  
  const displayAddress = userWalletAddress || customAddress || '0x742d35Cc6634C0532925a3b8D404d0C8b7b8E5c2';

  const generateRandomAddress = () => {
    const randomHex = () => Math.floor(Math.random() * 16).toString(16);
    const newAddress = '0x' + Array.from({ length: 40 }, () => randomHex()).join('');
    setCustomAddress(newAddress);
  };

  const copyPrivateKey = () => {
    if (!isLoggedIn || !walletData?.privateKey) {
      Alert.alert('Error', 'No private key available. Please create a wallet first.');
      return;
    }
    Alert.alert(
      'Private Key',
      `Your private key:\n\n${walletData.privateKey}\n\n⚠️ Keep this private key secure and never share it with anyone!`,
      [
        { text: 'Copy to Clipboard', onPress: () => Alert.alert('Copied', 'Private key copied to clipboard') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>WALLET</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BlurView tint="light" intensity={30} style={styles.qrContainer}>
          <QRCode
            value={displayAddress}
            size={220}
            color="#000000"
            backgroundColor="transparent"
          />
        </BlurView>

        <BlurView tint="dark" intensity={70} style={styles.statusContainer}>
          <View style={styles.statusBadgeRow}>
            <View style={isLoggedIn ? styles.dotActive : styles.dotInactive} />
            <Text style={styles.statusText}>
              {isLoggedIn ? "Wallet Connected" : "No Wallet"}
            </Text>
          </View>
          {walletData && (
            <Text style={styles.createdText}>
              Created: {walletData.createdAt.toLocaleDateString()}
            </Text>
          )}
        </BlurView>

        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>
            {isLoggedIn ? "YOUR WALLET ADDRESS" : "CUSTOM ADDRESS"}
          </Text>
          {isLoggedIn ? (
            <BlurView tint="dark" intensity={50} style={styles.walletAddressBox}>
              <Text style={styles.walletAddressText}>{userWalletAddress}</Text>
            </BlurView>
          ) : (
            <TextInput
              style={styles.addressInput}
              value={customAddress}
              onChangeText={setCustomAddress}
              placeholder="Enter custom wallet address"
              placeholderTextColor="#8A8A8E"
              multiline
            />
          )}
        </View>

        {!isLoggedIn && (
          <TouchableOpacity onPress={generateRandomAddress} style={{ width: '100%', marginBottom: 16 }}>
             <BlurView tint="dark" intensity={60} style={styles.actionButton}>
               <Text style={styles.actionButtonText}>Generate Random Address</Text>
             </BlurView>
          </TouchableOpacity>
        )}

        {isLoggedIn && (
          <TouchableOpacity onPress={copyPrivateKey} style={{ width: '100%' }}>
             <BlurView tint="dark" intensity={40} style={styles.actionButtonSecondary}>
               <Text style={styles.actionButtonSecondaryText}>Export Private Key</Text>
             </BlurView>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080A',
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  qrContainer: {
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    marginBottom: 32,
    marginTop: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  statusContainer: {
    marginBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    width: '100%',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
    marginRight: 8,
  },
  dotInactive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createdText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  addressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  walletAddressBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 60,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  walletAddressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#D1D5DB',
  },
  addressInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 60,
    fontSize: 14,
    color: '#FFFFFF',
    textAlignVertical: 'top',
  },
  actionButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonSecondary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  actionButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
