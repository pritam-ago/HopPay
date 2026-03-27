/**
 * INR Payout via Decentro Money Transfer API
 *
 * After a Ghost Voucher is confirmed on-chain, this module releases
 * real INR to the merchant's UPI ID using Decentro's Transfer API.
 *
 * Docs: https://docs.decentro.tech/docs/money-transfer-upi
 *
 * Set DECENTRO_ENV=STAGING to use sandbox (no real money moves).
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
  if (!CLIENT_ID || !CLIENT_SECRET || !MODULE_SECRET) {
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
        payee_referenceid: referenceId,
        type: "UPI",
        bank_account: toUpiId,         // UPI VPA goes here
        amount: amountInr.toFixed(2),
        purpose_code: "P2P",
        generate_qr: 0,
        send_sms: 0,
        send_email: 0,
        beneficiary_details: [
          {
            name: merchantName,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
      }
    );

    const { status, message, data } = response.data;

    if (status === "SUCCESS") {
      console.log(`[PAYOUT] ✅ UPI Transfer initiated: ${referenceId}`);
      return {
        success: true,
        referenceId,
        transactionId: data?.decentroTxnId,
        utrNumber: data?.utrNumber,
        message: `₹${amountInr} sent to ${toUpiId} via UPI`,
      };
    } else {
      console.error(`[PAYOUT] ❌ Decentro error: ${message}`);
      return {
        success: false,
        referenceId,
        error: `Decentro transfer failed: ${message}`,
      };
    }
  } catch (err: any) {
    const errMsg =
      err?.response?.data?.message || err?.message || "Unknown payout error";
    console.error("[PAYOUT] ❌ Error:", errMsg);
    return {
      success: false,
      referenceId,
      error: errMsg,
    };
  }
}

module.exports = { meshtToInr, triggerInrPayout };
