/**
 * INR Payout via Cashfree Payout API
 *
 * After a Ghost Voucher is confirmed on-chain, this module releases
 * real INR to the merchant's UPI ID using Cashfree's Payout APIs.
 *
 * Docs: https://docs.cashfree.com/docs/payout-apis
 *
 * Set CASHFREE_ENV=TEST to use sandbox (no real money moves).
 */
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const IS_SANDBOX = (process.env.CASHFREE_ENV ?? "TEST") === "TEST";

const BASE_URL = IS_SANDBOX
  ? "https://payout-gamma.cashfree.com"
  : "https://payout-api.cashfree.com";

// MESHT token to INR exchange rate (placeholder — use real oracle/price feed in production)
const MESHT_TO_INR_RATE = 100; // 1 MESHT = ₹100

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayoutResult {
  success: boolean;
  referenceId?: string;
  utrNumber?: string; // UTR from NEFT/IMPS
  message?: string;
  error?: string;
}

// ─── Cashfree Auth Token ──────────────────────────────────────────────────────

async function getCashfreeAuthToken(): Promise<string> {
  const response = await axios.post(
    `${BASE_URL}/payout/v1/authorize`,
    {},
    {
      headers: {
        "X-Client-Id": CASHFREE_APP_ID,
        "X-Client-Secret": CASHFREE_SECRET_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  const { status, subCode, data } = response.data;
  if (status !== "SUCCESS" || subCode !== "200") {
    throw new Error(`Cashfree auth failed: ${JSON.stringify(response.data)}`);
  }

  return data.token;
}

// ─── Helper: Convert MESHT to INR ─────────────────────────────────────────────

export function meshtToInr(amountInWei: string): number {
  // amountInWei is the raw 18-decimal token value
  const amountInMesht = Number(BigInt(amountInWei)) / 1e18;
  return Math.round(amountInMesht * MESHT_TO_INR_RATE * 100) / 100; // 2 dp
}

// ─── Core Payout Function ─────────────────────────────────────────────────────

/**
 * Trigger an INR payout to the merchant's UPI ID.
 *
 * @param toUpiId     e.g. "merchant@okicici"
 * @param amountInr   INR amount to transfer (e.g. 250.00)
 * @param txHash      On-chain tx hash (used as reference ID)
 * @param merchantName Optional display name
 */
export async function triggerInrPayout(
  toUpiId: string,
  amountInr: number,
  txHash: string,
  merchantName: string = "Merchant"
): Promise<PayoutResult> {
  // Sandbox/mock mode — just simulate success if no real keys provided
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.log(`[PAYOUT] 🟡 MOCK MODE — Simulating ₹${amountInr} payout to ${toUpiId}`);
    return {
      success: true,
      referenceId: `MOCK_${txHash.slice(2, 12).toUpperCase()}`,
      utrNumber: `UTR${Date.now()}`,
      message: `Mock payout of ₹${amountInr} to ${toUpiId} would succeed in production`,
    };
  }

  try {
    console.log(`[PAYOUT] 🚀 Initiating ₹${amountInr} payout to UPI: ${toUpiId}`);

    // 1. Get auth token
    const token = await getCashfreeAuthToken();

    // 2. Create a beneficiary (idempotent — safe to call multiple times)
    const beneId = `BENE_${toUpiId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
    try {
      await axios.post(
        `${BASE_URL}/payout/v1/addBeneficiary`,
        {
          beneId,
          name: merchantName,
          email: "merchant@mesht.xyz",
          phone: "9999999999",
          bankAccount: toUpiId, // UPI VPA goes in bankAccount for UPI transfers
          ifsc: "CASHFREE",   // Cashfree uses this sentinel for UPI
          address1: "India",
          city: "India",
          state: "India",
          pincode: "110001",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`[PAYOUT] ✅ Beneficiary created/verified: ${beneId}`);
    } catch (beneErr: any) {
      // Beneficiary may already exist — that's fine
      if (!beneErr?.response?.data?.subCode?.includes("409")) {
        console.warn("[PAYOUT] Beneficiary creation warning:", beneErr?.message);
      }
    }

    // 3. Request transfer
    const referenceId = `MESHT_${txHash.slice(2, 18).toUpperCase()}`;
    const transferResponse = await axios.post(
      `${BASE_URL}/payout/v1/requestTransfer`,
      {
        beneId,
        amount: amountInr.toFixed(2),
        transferId: referenceId,
        transferMode: "UPI", // Use UPI (near-instant)
        remarks: `MeshT payment settlement — Tx: ${txHash.slice(0, 16)}`,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { status, subCode, data } = transferResponse.data;
    if (status === "SUCCESS") {
      console.log(`[PAYOUT] ✅ Transfer initiated: ${referenceId}`);
      return {
        success: true,
        referenceId,
        utrNumber: data?.utr,
        message: `₹${amountInr} sent to ${toUpiId} via UPI`,
      };
    } else {
      return {
        success: false,
        referenceId,
        error: `Cashfree transfer failed: ${subCode} — ${JSON.stringify(data)}`,
      };
    }
  } catch (err: any) {
    console.error("[PAYOUT] ❌ Error:", err?.message);
    return {
      success: false,
      error: err?.message || "Unknown payout error",
    };
  }
}
