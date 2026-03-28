import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from 'react-native-qrcode-svg';
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WALLET</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.qrContainer}>
          <QRCode
            value={displayAddress}
            size={220}
            color="#0A120D"
            backgroundColor="#FFFFFF"
          />
        </View>

        <View style={styles.statusContainer}>
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
        </View>

        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>
            {isLoggedIn ? "YOUR WALLET ADDRESS" : "CUSTOM ADDRESS"}
          </Text>
          {isLoggedIn ? (
            <View style={styles.walletAddressBox}>
              <Text style={styles.walletAddressText}>{userWalletAddress}</Text>
            </View>
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
          <TouchableOpacity style={styles.actionButton} onPress={generateRandomAddress}>
            <Text style={styles.actionButtonText}>Generate Random Address</Text>
          </TouchableOpacity>
        )}

        {isLoggedIn && (
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={copyPrivateKey}>
            <Text style={styles.actionButtonSecondaryText}>Export Private Key</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A120D',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  statusContainer: {
    marginBottom: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(28, 30, 31, 1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 60,
    justifyContent: 'center',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonSecondary: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonSecondaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
