import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import {
  Text,
  Button,
  Card,
  Surface,
  Divider,
  Chip,
  useTheme,
} from "react-native-paper";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useBle } from "@/contexts/BleContext";
import { sendSmsDirect } from "@/utils/twilioSms";

export default function TransactionSuccessPage(): React.JSX.Element {
  const theme = useTheme();
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

  // SMS state
  const [smsStatus, setSmsStatus] = useState<"sending" | "sent" | "failed" | "none">("none");
  const [smsPhone, setSmsPhone] = useState<string>("");

  const handleGoHome = () => {
    router.replace("/");
  };

  const handleNewTransaction = () => {
    router.replace("/");
  };

  useEffect(() => {
    stopBroadcasting();
  }, [stopBroadcasting]);

  // ── Trigger SMS DIRECTLY via Twilio (no relayer needed) ────────────────────
  useEffect(() => {
    const triggerSms = async () => {
      setSmsStatus("sending");
      try {
        console.log("[SMS] Calling Twilio directly from phone...");
        const result = await sendSmsDirect({
          upiId: upiId || undefined,
          merchantPhone: merchantPhone || undefined,
          amount: amount || "0",
          txHash: txHash || "",
          merchantName: merchantName || "Merchant",
        });

        console.log("[SMS] Result:", result);

        if (result.success) {
          setSmsStatus("sent");
          setSmsPhone(result.phone || "");
        } else {
          setSmsStatus("failed");
        }
      } catch (err) {
        console.error("[SMS] Error:", err);
        setSmsStatus("failed");
      }
    };

    triggerSms();
  }, [upiId, merchantPhone, amount, txHash, merchantName]);

  const generateSignatureString = (hash: string): string => {
    if (!hash) return "Generating signature...";
    return `0x${hash.slice(2, 34)}...${hash.slice(-32)}`;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <Text style={styles.successIcon}>✅</Text>
          <Text
            variant="headlineMedium"
            style={[styles.successTitle, { color: theme.colors.onBackground }]}
          >
            Transaction Sent!
          </Text>
        </View>

        {/* SMS Status Card */}
        {smsStatus !== "none" && (
          <Card style={[
            styles.smsCard,
            smsStatus === "sent" ? styles.smsCardSuccess :
            smsStatus === "failed" ? styles.smsCardFailed :
            styles.smsCardSending
          ]} elevation={2}>
            <Card.Content style={styles.smsContent}>
              <Text style={styles.smsIcon}>
                {smsStatus === "sending" ? "📱" : smsStatus === "sent" ? "✅" : "❌"}
              </Text>
              <View style={styles.smsTextContainer}>
                <Text variant="titleSmall" style={styles.smsTitle}>
                  {smsStatus === "sending" ? "Sending SMS notification..."
                   : smsStatus === "sent" ? "SMS Sent to Merchant!"
                   : "SMS notification failed"}
                </Text>
                {smsStatus === "sent" && smsPhone ? (
                  <Text variant="bodySmall" style={styles.smsPhone}>
                    Sent to +91{smsPhone}
                  </Text>
                ) : null}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* QR Code Section */}
        <Card style={styles.qrCard} elevation={4}>
          <Card.Content style={styles.qrContent}>
            <Text variant="titleLarge" style={styles.qrTitle}>
              Transaction QR Code
            </Text>
            <View style={styles.qrContainer}>
              {txHash ? (
                <QRCode
                  value={txHash}
                  size={200}
                  backgroundColor="white"
                  color="black"
                />
              ) : (
                <View style={styles.qrPlaceholder}>
                  <Text>Generating QR...</Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Transaction Hash */}
        <Card style={styles.hashCard} elevation={2}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.hashTitle}>
              Transaction Hash
            </Text>
            <Surface style={styles.hashSurface} elevation={1}>
              <Text variant="bodyMedium" style={styles.hashText} selectable>
                {txHash || "Generating hash..."}
              </Text>
            </Surface>
          </Card.Content>
        </Card>

        {/* Hash Signature */}
        <Card style={styles.signatureCard} elevation={2}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.signatureTitle}>
              Hash Signature
            </Text>
            <Surface style={styles.signatureSurface} elevation={1}>
              <Text variant="bodyMedium" style={styles.signatureText} selectable>
                {generateSignatureString(txHash || "")}
              </Text>
            </Surface>
          </Card.Content>
        </Card>

        {/* Full Message Response */}
        {fullMessage ? (
          <Card style={styles.responseCard} elevation={2}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.responseTitle}>
                Network Response
              </Text>
              <Surface style={styles.responseSurface} elevation={1}>
                <ScrollView style={styles.responseScroll} nestedScrollEnabled>
                  <Text variant="bodySmall" style={styles.responseText} selectable>
                    {fullMessage}
                  </Text>
                </ScrollView>
              </Surface>
            </Card.Content>
          </Card>
        ) : null}

        {/* Primary Action */}
        <Button
          mode="contained"
          onPress={handleGoHome}
          style={styles.homeButton}
          contentStyle={styles.homeButtonContent}
        >
          Go to Home
        </Button>

        {/* Transaction Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.detailsTitle}>
              Transaction Details
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.detailLabel}>Amount</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>{amount} {currency}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.detailLabel}>Network</Text>
              <Chip mode="outlined" style={styles.chainChip}>{chain}</Chip>
            </View>

            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.detailLabel}>To Address</Text>
              <Text variant="bodySmall" style={styles.addressText}>
                {toAddress ? `${toAddress.slice(0, 8)}...${toAddress.slice(-8)}` : "Unknown"}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text variant="labelMedium" style={styles.detailLabel}>Time</Text>
              <Text variant="bodyMedium" style={styles.detailValue}>
                {timestamp ? new Date(parseInt(timestamp)).toLocaleString() : "Just now"}
              </Text>
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="outlined"
          onPress={handleNewTransaction}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
        >
          Send Another Transaction
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  successHeader: { alignItems: "center", marginBottom: 24, marginTop: 16 },
  successIcon: { fontSize: 48, marginBottom: 16 },
  successTitle: { textAlign: "center", fontWeight: "700" },

  // SMS Status Card
  smsCard: { marginBottom: 20, borderRadius: 12 },
  smsCardSending: { backgroundColor: "#FFF9C4" },
  smsCardSuccess: { backgroundColor: "#E8F5E9", borderLeftWidth: 4, borderLeftColor: "#4CAF50" },
  smsCardFailed: { backgroundColor: "#FFEBEE", borderLeftWidth: 4, borderLeftColor: "#F44336" },
  smsContent: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  smsIcon: { fontSize: 28, marginRight: 12 },
  smsTextContainer: { flex: 1 },
  smsTitle: { fontWeight: "700", color: "#333" },
  smsPhone: { color: "#666", marginTop: 2 },

  // QR Code
  qrCard: { marginBottom: 24, backgroundColor: "#FFFFFF" },
  qrContent: { alignItems: "center", paddingVertical: 24 },
  qrTitle: { fontWeight: "700", marginBottom: 20, textAlign: "center", color: "#333" },
  qrContainer: {
    padding: 16, backgroundColor: "#FFFFFF", borderRadius: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  qrPlaceholder: {
    width: 200, height: 200, justifyContent: "center",
    alignItems: "center", backgroundColor: "#F5F5F5", borderRadius: 8,
  },

  // Transaction Hash
  hashCard: { marginBottom: 20, backgroundColor: "#FFFFFF" },
  hashTitle: { fontWeight: "600", marginBottom: 12, color: "#333" },
  hashSurface: { padding: 16, borderRadius: 8, backgroundColor: "#F8F9FA" },
  hashText: { fontFamily: "monospace", fontSize: 14, color: "#333", textAlign: "center" },

  // Signature
  signatureCard: { marginBottom: 24, backgroundColor: "#FFFFFF" },
  signatureTitle: { fontWeight: "600", marginBottom: 12, color: "#333" },
  signatureSurface: { padding: 16, borderRadius: 8, backgroundColor: "#F8F9FA" },
  signatureText: { fontFamily: "monospace", fontSize: 14, color: "#333", textAlign: "center" },

  // Network Response
  responseCard: { marginBottom: 20, backgroundColor: "#FFFFFF" },
  responseTitle: { fontWeight: "600", marginBottom: 12, color: "#333" },
  responseSurface: { padding: 16, borderRadius: 8, backgroundColor: "#F8F9FA", maxHeight: 150 },
  responseScroll: { maxHeight: 120 },
  responseText: { fontFamily: "monospace", fontSize: 12, color: "#333", lineHeight: 18 },

  // Buttons
  homeButton: { marginBottom: 32, backgroundColor: "#007AFF" },
  homeButtonContent: { paddingVertical: 16 },
  detailsCard: { marginBottom: 20, backgroundColor: "#FFFFFF" },
  detailsTitle: { fontWeight: "600", marginBottom: 16, color: "#333" },
  divider: { marginBottom: 16 },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12, paddingVertical: 4,
  },
  detailLabel: { textTransform: "uppercase", color: "#666", flex: 1 },
  detailValue: { fontWeight: "600", color: "#333", flex: 2, textAlign: "right" },
  chainChip: { backgroundColor: "#E3F2FD" },
  addressText: { fontFamily: "monospace", color: "#666", flex: 2, textAlign: "right" },
  secondaryButton: { marginBottom: 16 },
  buttonContent: { paddingVertical: 12 },
});
