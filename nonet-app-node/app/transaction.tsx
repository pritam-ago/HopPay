import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from "react-native-paper"; // Keeps fallback if deeply tied, but converting UI mostly to React Native directly
import { useLocalSearchParams, router } from 'expo-router';
import { useWallet } from '@/contexts/WalletContext';
import { CHAINS, DEFAULT_CHAIN, Chain } from '@/constants/assets';
import { TransactionLoader } from '@/components/TransactionLoader';
import { CONTRACT_CONFIG } from '@/constants/contracts';
import { ethers } from 'ethers';
import { Feather } from '@expo/vector-icons';

export default function TransactionPage(): React.JSX.Element {
  const { toAddress, merchantName, upiId, merchantPhone, amount: qrAmount, note } =
    useLocalSearchParams<{
      toAddress: string;
      merchantName?: string;
      upiId?: string;
      merchantPhone?: string;
      amount?: string;
      note?: string;
    }>();
  const { userWalletAddress, isLoggedIn } = useWallet();

  const isUpiPayment = toAddress?.startsWith("upi:");
  const displayAddress = isUpiPayment ? toAddress.replace("upi:", "") : toAddress;

  const [amount, setAmount] = useState<string>(qrAmount ?? '');
  const [selectedChain, setSelectedChain] = useState<Chain>(DEFAULT_CHAIN);
  const [showChainModal, setShowChainModal] = useState(false);
  const [showTransactionLoader, setShowTransactionLoader] = useState(false);

  const handleSubmitTransaction = async () => {
    if (!isLoggedIn || !userWalletAddress) {
      Alert.alert('Error', 'Please create a wallet first');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!toAddress) {
      Alert.alert('Error', 'Recipient address is required');
      return;
    }
    setShowTransactionLoader(true);
  };

  const handleTransactionComplete = (fullMessage?: string) => {
    setShowTransactionLoader(false);
    if (fullMessage) {
      try {
        const response = JSON.parse(fullMessage);
        if (response.success && response.transactionHash) {
          router.replace({
            pathname: '/transaction-success',
            params: {
              amount,
              currency: selectedChain.symbol,
              toAddress: toAddress || '',
              fromAddress: userWalletAddress || '',
              chain: selectedChain.name,
              txHash: response.transactionHash,
              timestamp: Date.now().toString(),
              fullMessage: fullMessage || '',
              upiId: upiId || '',
              merchantName: merchantName || '',
              merchantPhone: merchantPhone || '',
            },
          });
          return;
        }
        const errorMsg = response.error || `Transaction failed at stage: ${response.stage || 'unknown'}`;
        Alert.alert('Transaction Failed', errorMsg, [{ text: 'OK' }]);
      } catch {
        Alert.alert('Transaction Failed', 'Received an invalid response from the network. Please try again.', [{ text: 'OK' }]);
      }
    } else {
      Alert.alert('Transaction Failed', 'No confirmation received from the blockchain. The transaction may not have been submitted.', [{ text: 'OK' }]);
    }
  };

  const handleTransactionCancel = () => {
    setShowTransactionLoader(false);
    Alert.alert('Transaction Cancelled', 'Your transaction has been cancelled.');
  };

  const renderChainItem = ({ item }: { item: Chain }) => (
    <TouchableOpacity
      style={styles.modalListItem}
      onPress={() => {
        setSelectedChain(item);
        setShowChainModal(false);
      }}
    >
      <View style={styles.imageContainer}>
        <Image source={item.imageUrl} style={styles.chainImage} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.modalItemTitle}>{item.name}</Text>
        <Text style={styles.modalItemDescription}>{item.symbol}</Text>
      </View>
      {selectedChain.id === item.id && <Feather name="check" size={20} color="#FBBF24" />}
    </TouchableOpacity>
  );

  if (showTransactionLoader) {
    return (
      <TransactionLoader
        onComplete={handleTransactionComplete}
        onCancel={handleTransactionCancel}
        transactionData={{
          amount,
          currency: selectedChain.symbol,
          toAddress: isUpiPayment ? (CONTRACT_CONFIG.RELAYER_PRIVATE_KEY ? new ethers.Wallet(CONTRACT_CONFIG.RELAYER_PRIVATE_KEY).address : toAddress || '') : (toAddress || ''),
          chain: selectedChain.name,
          chainId: selectedChain.chainId,
          upiId: upiId || undefined,
          merchantName: merchantName || undefined,
          merchantPhone: merchantPhone || undefined,
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SEND</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Merchant Info Card */}
        {(merchantName || upiId) && (
          <View style={[styles.glassCard, styles.merchantCard]}>
            <View style={styles.merchantHeader}>
              <View style={styles.merchantIcon}>
                <Feather name="shopping-bag" size={20} color="#FBBF24" />
              </View>
              <Text style={styles.merchantName}>{merchantName || 'Merchant Payment'}</Text>
            </View>
            {upiId && <Text style={styles.merchantUpi}>UPI: {upiId}</Text>}
            {note && <Text style={styles.merchantNote}>Note: {note}</Text>}
          </View>
        )}

        {/* Amount Input */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>AMOUNT</Text>
          <View style={styles.amountInputWrapper}>
            <Text style={styles.currencyPrefix}>{selectedChain.symbol}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* To Address */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>RECIPIENT</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressText}>
              {displayAddress ? (
                isUpiPayment ? `UPI: ${displayAddress}` : `${displayAddress.slice(0, 8)}...${displayAddress.slice(-8)}`
              ) : 'No address provided'}
            </Text>
          </View>
        </View>

        {/* Chain Selection */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>NETWORK</Text>
          <TouchableOpacity style={styles.chainSelector} onPress={() => setShowChainModal(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.imageContainerSmall}>
                <Image source={selectedChain.imageUrl} style={styles.chainImageSmall} />
              </View>
              <Text style={styles.chainName}>{selectedChain.name}</Text>
            </View>
            <Feather name="chevron-down" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* From Address */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>PAYING FROM</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressText}>
              {userWalletAddress ? `${userWalletAddress.slice(0, 8)}...${userWalletAddress.slice(-8)}` : 'No wallet connected'}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, (!isLoggedIn || !amount || parseFloat(amount) <= 0) && styles.submitButtonDisabled]}
          onPress={handleSubmitTransaction}
          disabled={!isLoggedIn || !amount || parseFloat(amount) <= 0}
        >
          <Text style={styles.submitButtonText}>Confirm & Send</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modern Chain Selection Modal */}
      <Modal visible={showChainModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Network</Text>
              <TouchableOpacity onPress={() => setShowChainModal(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CHAINS}
              renderItem={renderChainItem}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  glassCard: {
    backgroundColor: 'rgba(20, 20, 20, 1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  merchantCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FBBF24',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  merchantIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  merchantName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FBBF24',
  },
  merchantUpi: {
    fontSize: 14,
    color: '#D1D5DB',
    marginLeft: 44,
  },
  merchantNote: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 8,
    marginLeft: 44,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FBBF24',
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '900',
    color: '#FFF',
    paddingVertical: 16,
  },
  addressBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
  },
  addressText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#D1D5DB',
  },
  chainSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  imageContainerSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  chainImageSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  chainName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#FBBF24',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#374151',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#000000',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: '60%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
  },
  modalCloseButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  modalList: {
    flex: 1,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  chainImage: {
    width: 32,
    height: 32,
  },
  modalItemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: 4,
  },
  modalItemDescription: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
