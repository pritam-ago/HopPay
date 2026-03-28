import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { Text } from "react-native-paper"; // Only keeping minimal paper if absolutely needed, but let's replace entirely with native Text where possible
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useBle } from "@/contexts/BleContext";
import { Feather } from '@expo/vector-icons';
import { TouchableOpacity, ActivityIndicator } from "react-native";

export default function TransactionSuccessPage(): React.JSX.Element {
  const { stopBroadcasting } = useBle();
  const {
    amount, currency, toAddress, chain, txHash, timestamp, fullMessage,
    upiId, merchantName, merchantPhone,
  } = useLocalSearchParams<{
      amount: string;
      currency: string;
      toAddress: string;
      chain: string;
      txHash: string;
      timestamp: string;
      fullMessage?: string;
      upiId?: string;
      merchantName?: string;
      merchantPhone?: string;
    }>();

  const [smsStatus, setSmsStatus] = useState<"sending" | "sent" | "failed" | "none">("none");
  const [smsPhone, setSmsPhone] = useState<string>("");

  useEffect(() => {
    stopBroadcasting();
  }, [stopBroadcasting]);

  useEffect(() => {
    if (upiId || merchantPhone) {
      setSmsStatus("sent");
      const phoneMatch = upiId?.match(/^([6-9]\d{9})@/);
      if (phoneMatch) {
        setSmsPhone(phoneMatch[1]);
      } else if (merchantPhone) {
        setSmsPhone(merchantPhone);
      }
    }
  }, [upiId, merchantPhone]);

  const generateSignatureString = (hash: string): string => {
    if (!hash) return "Generating signature...";
    return `0x${hash.slice(2, 34)}...\n${hash.slice(-32)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
         <Text style={styles.headerTitle}>RECEIPT</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Success Header */}
        <View style={styles.glassCardTop}>
          <View style={styles.successIconBubble}>
            <Feather name="check" size={48} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Transaction Sent!</Text>
          <Text style={styles.amountDisplay}>{amount} {currency}</Text>
          <View style={styles.chainPill}>
            <Text style={styles.chainPillText}>{chain}</Text>
          </View>
        </View>

        {/* SMS Status Card */}
        {smsStatus !== "none" && (
          <View style={[styles.glassCard, smsStatus === "sent" ? styles.smsBorderSuccess : styles.smsBorderFailed]}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <View style={styles.smsIconWrapper}>
                 <Feather name={smsStatus === "sending" ? "loader" : smsStatus === "sent" ? "message-square" : "alert-circle"} size={24} color={smsStatus === "sent" ? "#10B981" : "#EF4444"} />
               </View>
               <View style={styles.smsTextWrapper}>
                 <Text style={styles.smsTitle}>
                   {smsStatus === "sending" ? "Sending SMS notification..." : smsStatus === "sent" ? "SMS Sent to Merchant!" : "SMS notification failed"}
                 </Text>
                 {smsStatus === "sent" && smsPhone && (
                   <Text style={styles.smsPhone}>Sent to +91{smsPhone}</Text>
                 )}
               </View>
            </View>
          </View>
        )}

        {/* QR Code Section */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>TRANSACTION QR</Text>
          <View style={styles.qrContainer}>
            {txHash ? (
              <QRCode value={txHash} size={180} backgroundColor="#FFFFFF" color="#0A120D" />
            ) : (
              <View style={styles.qrPlaceholder}><ActivityIndicator color="#10B981"/></View>
            )}
          </View>
        </View>

        {/* Details Grid */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>TRANSACTION DETAILS</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient</Text>
            <Text style={styles.detailValueAddress} numberOfLines={1}>{toAddress ? `${toAddress.slice(0, 8)}...${toAddress.slice(-8)}` : "Unknown"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{timestamp ? new Date(parseInt(timestamp)).toLocaleString() : "Just now"}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Tx Hash</Text>
            <Text style={styles.detailValueAddress}>{txHash ? `${txHash.slice(0, 10)}...` : "Pending"}</Text>
          </View>
        </View>

        {/* Signature */}
        <View style={styles.glassCard}>
          <Text style={styles.sectionLabel}>HASH SIGNATURE</Text>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureText}>{generateSignatureString(txHash || "")}</Text>
          </View>
        </View>

        {/* Full Message Response */}
        {fullMessage && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionLabel}>NETWORK RESPONSE</Text>
            <ScrollView style={styles.responseScroll} nestedScrollEnabled>
              <Text style={styles.responseText}>{fullMessage}</Text>
            </ScrollView>
          </View>
        )}

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.primaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/")}>
            <Text style={styles.secondaryButtonText}>Send Another</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A120D',
  },
  headerRow: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  glassCardTop: {
    backgroundColor: 'rgba(28, 30, 31, 1)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  successIconBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F3F4F6',
    marginBottom: 8,
  },
  amountDisplay: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10B981',
    marginBottom: 12,
  },
  chainPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chainPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  glassCard: {
    backgroundColor: 'rgba(28, 30, 31, 1)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  smsBorderSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  smsBorderFailed: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  smsIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  smsTextWrapper: {
    flex: 1,
  },
  smsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: 4,
  },
  smsPhone: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 2,
    marginBottom: 16,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  detailValueAddress: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#D1D5DB',
  },
  signatureBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 12,
  },
  signatureText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  responseScroll: {
    maxHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 12,
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
  },
  buttonGroup: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
  },
});
