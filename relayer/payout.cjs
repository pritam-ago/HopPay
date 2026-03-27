"use strict";
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const CLIENT_ID = process.env.DECENTRO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DECENTRO_CLIENT_SECRET || "";
const MODULE_SECRET = process.env.DECENTRO_MODULE_SECRET || "";
const PROVIDER_SECRET = process.env.DECENTRO_PROVIDER_SECRET || "";
const IS_STAGING = (process.env.DECENTRO_ENV ?? "STAGING") === "STAGING";
const BASE_URL = IS_STAGING
  ? "https://in.staging.decentro.tech"
  : "https://in.decentro.tech";

const MESHT_TO_INR_RATE = 100;

function meshtToInr(amountInWei) {
  const amountInMesht = Number(BigInt(amountInWei)) / 1e18;
  return Math.round(amountInMesht * MESHT_TO_INR_RATE * 100) / 100;
}

async function triggerInrPayout(toUpiId, amountInr, txHash, merchantName = "Merchant") {
  if (!CLIENT_ID || !CLIENT_SECRET || !MODULE_SECRET) {
    console.log(`[PAYOUT] 🟡 MOCK — ₹${amountInr} to ${toUpiId}`);
    return {
      success: true,
      referenceId: `MOCK_${txHash.slice(2, 12).toUpperCase()}`,
      utrNumber: `UTR${Date.now()}`,
      message: `Mock payout of ₹${amountInr} to ${toUpiId}`,
    };
  }

  const referenceId = `MESHT${txHash.slice(2, 17).toUpperCase()}`;
  try {
    console.log(`[PAYOUT] 🚀 ₹${amountInr} UPI payout to ${toUpiId}`);
    const response = await axios.post(
      `${BASE_URL}/v2/payments/upi/transaction`,
      {
        reference_id: referenceId,
        payee_referenceid: referenceId,
        type: "UPI",
        bank_account: toUpiId,
        amount: amountInr.toFixed(2),
        purpose_code: "P2P",
        generate_qr: 0,
        send_sms: 0,
        send_email: 0,
        beneficiary_details: [{ name: merchantName }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          module_secret: MODULE_SECRET,
          provider_secret: PROVIDER_SECRET,
        },
      }
    );

    const { status, message, data } = response.data;
    if (status === "SUCCESS") {
      return { success: true, referenceId, transactionId: data?.decentroTxnId, utrNumber: data?.utrNumber, message: `₹${amountInr} sent to ${toUpiId}` };
    } else {
      return { success: false, referenceId, error: `Decentro: ${message}` };
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || "Unknown error";
    return { success: false, referenceId, error: msg };
  }
}

module.exports = { meshtToInr, triggerInrPayout };
