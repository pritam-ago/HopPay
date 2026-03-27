/**
 * INR Payout via Decentro Money Transfer API v3
 *
 * After a Ghost Voucher is confirmed on-chain, this module triggers
 * a virtual INR payout to the merchant's UPI ID using Decentro's v3 Payout API.
 *
 * API Docs: https://docs.decentro.tech/reference/payments_api-initiate-payout-v3
 *
 * STAGING Mode (no real money):
 * - Set DECENTRO_ENV=STAGING for virtual/test transactions
 * - Requires: client_id, client_secret, consumer_urn
 * - No module_secret or provider_secret needed for v3
 */
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.DECENTRO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DECENTRO_CLIENT_SECRET || "";
const CONSUMER_URN = process.env.DECENTRO_CONSUMER_URN || "";
const IS_STAGING = (process.env.DECENTRO_ENV ?? "STAGING") === "STAGING";
const BASE_URL = IS_STAGING
  ? "https://in.staging.decentro.tech"
  : "https://in.decentro.tech";

// MESHT token to INR exchange rate (placeholder — use a real oracle in production)
const MESHT_TO_INR_RATE = 100; // 1 MESHT = ₹100

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayoutResult {
  success: boolean;
  referenceId?: string;
  transactionId?: string;
  transactionStatus?: string; // "success" | "pending" | "failure" | "unknown"
  utrNumber?: string;
  message?: string;
  error?: string;
}

// ─── Helper: Convert MESHT to INR ────────────────────────────────────────────

export function meshtToInr(amountInWei: string): number {
  const amountInMesht = Number(BigInt(amountInWei)) / 1e18;
  return Math.round(amountInMesht * MESHT_TO_INR_RATE * 100) / 100;
}

// ─── Core Payout Function ─────────────────────────────────────────────────────

/**
 * Trigger an INR UPI payout to the merchant via Decentro.
 *
 * @param toUpiId      e.g. "merchant@okicici"
 * @param amountInr    INR amount to transfer (e.g. 250.00)
 * @param txHash       On-chain tx hash (used as reference ID)
 * @param merchantName Optional display name for the beneficiary
 */
export async function triggerInrPayout(
  toUpiId: string,
  amountInr: number,
  txHash: string,
  merchantName: string = "Merchant"
): Promise<PayoutResult> {
  // Mock mode — if no real keys, simulate success
  if (!CLIENT_ID || !CLIENT_SECRET || !CONSUMER_URN) {
    console.log(`[PAYOUT] 🟡 MOCK MODE — Simulating ₹${amountInr} payout to ${toUpiId}`);
    return {
      success: true,
      referenceId: `MOCK_${txHash.slice(2, 12).toUpperCase()}`,
      transactionStatus: "success",
      utrNumber: `UTR${Date.now()}`,
      message: `Mock payout of ₹${amountInr} to ${toUpiId}`,
    };
  }

  const referenceId = `MESHT${txHash.slice(2, 17).toUpperCase()}`;
  try {
    console.log(`[PAYOUT] 🚀 ₹${amountInr} UPI payout to ${toUpiId}`);
    const response = await axios.post(
      `${BASE_URL}/v3/core_banking/money_transfer/initiate`,
      {
        reference_id: referenceId,
        purpose_message: `MeshT payment settlement - Tx ${txHash.slice(0, 16)}`,
        consumer_urn: CONSUMER_URN,
        transfer_type: "UPI",
        transfer_amount: amountInr.toFixed(2),
        beneficiary_details: {
          to_upi: toUpiId,
          payee_name: merchantName,
          mobile_number: "9999999999",
          email_address: "merchant@mesht.xyz",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
      }
    );

    const { 
      decentro_txn_id, 
      api_status, 
      transaction_status,
      bank_reference_number,
      message, 
      response_key,
      data 
    } = response.data;

    console.log(`[PAYOUT] API Status: ${api_status}, Transaction Status: ${transaction_status}`);

    // v3 API returns lowercase statuses
    if (api_status === "success" || api_status === "SUCCESS") {
      console.log(`[PAYOUT] ✅ Payout initiated: ${referenceId} (${transaction_status})`);
      
      // Return actual transaction status, let caller decide
      // Possible values: "success", "pending", "failure", "unknown"
      return {
        success: true, // API call succeeded
        referenceId,
        transactionId: decentro_txn_id,
        transactionStatus: transaction_status?.toLowerCase(), // Normalize to lowercase
        utrNumber: bank_reference_number,
        message: `₹${amountInr} to ${toUpiId} - Status: ${transaction_status}`,
      };
    } else {
      // API call failed
      console.error(`[PAYOUT] ❌ Decentro API error: ${message || response_key}`);
      return {
        success: false,
        referenceId,
        transactionStatus: "failure",
        error: `Decentro API failed: ${message || response_key}`,
      };
    }
  } catch (err: any) {
    const errorData = err?.response?.data;
    const responseKey = errorData?.response_key;
    const errorMessage = errorData?.message;
    
    // Map common v3 response keys to user-friendly messages
    let friendlyError = errorMessage || err?.message || "Unknown payout error";
    
    if (responseKey) {
      const errorMap: Record<string, string> = {
        error_amount_below_minimum: "Amount below minimum (₹1)",
        error_amount_exceeded_upi: "Amount exceeds UPI limit (₹100,000)",
        error_invalid_format_upi: "Invalid UPI ID format",
        error_duplicate_reference_id: "Duplicate transaction reference ID",
        error_amount_exceeded: "Insufficient balance in source account",
        error_empty_consumer_urn: "Consumer URN is required",
        error_unsanitized_values: "Invalid characters in beneficiary details",
        error_provider_error: "Provider error - please retry",
      };
      
      friendlyError = errorMap[responseKey] || `${responseKey}: ${errorMessage}`;
    }
    
    console.error("[PAYOUT] ❌ Error:", friendlyError);
    console.error("[PAYOUT] Response Key:", responseKey);
    console.error("[PAYOUT] Full Error:", errorData || err.message);
    
    return {
      success: false,
      referenceId: `MESHT${txHash.slice(2, 17).toUpperCase()}`,
      transactionStatus: "failure",
      error: friendlyError,
    };
  }
}

module.exports = { meshtToInr, triggerInrPayout };
