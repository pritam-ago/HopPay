/**
 * Bank-Style SMS via Twilio
 *
 * Set credentials in relayer/.env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 */
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// ── Twilio credentials ───────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID  || "";
const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   || "";
const TWILIO_FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER  || ""; // e.g. +12345678900
const DEMO_MERCHANT_PHONE = process.env.DEMO_MERCHANT_PHONE || "";

/**
 * Extract a 10-digit Indian mobile number from a UPI ID.
 * Works for: 9876543210@paytm, 9876543210@ybl, 9876543210@oksbi etc.
 * Returns null if the UPI ID doesn't start with a phone number.
 */
function extractPhoneFromUpi(upiId) {
  if (!upiId) return null;
  const match = upiId.match(/^([6-9]\d{9})@/);
  return match ? match[1] : null;
}

/**
 * Build a simple payment received message.
 */
function buildBankMessage(amountInr, txRef) {
  const shortRef = txRef.slice(0, 10).toUpperCase();
  return `HopPay: You received Rs.${amountInr.toFixed(2)}. Ref ${shortRef}. Thank you!`;
}

// ── Twilio SMS Provider ───────────────────────────────────────────────────────

async function sendViaTwilio(phoneE164, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return null; // not configured — skip
  }

  console.log(`[SMS] 🟣 Trying Twilio → ${phoneE164}`);
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To:   phoneE164,
      From: TWILIO_FROM_NUMBER,
      Body: message,
    });

    const res = await axios.post(url, params.toString(), {
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (res.data?.sid) {
      console.log(`[SMS] ✅ Twilio sent! SID: ${res.data.sid}`);
      return { success: true, provider: "twilio", sid: res.data.sid, message };
    }
    console.error("[SMS] Twilio unexpected response:", res.data);
    return { success: false, provider: "twilio", error: "No SID in response" };
  } catch (err) {
    const errMsg =
      err?.response?.data?.message || err?.message || "Twilio error";
    console.error("[SMS] ❌ Twilio failed:", errMsg);
    return { success: false, provider: "twilio", error: errMsg };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Send a bank-style credit SMS to the merchant via Twilio.
 *
 * @param {string|null} phoneNumber  10-digit Indian mobile (no +91)
 * @param {number}      amountInr    INR amount credited
 * @param {string}      txRef        Short tx reference (e.g. "MeshT9A2F3")
 * @param {string}      merchantName Merchant display name
 */
async function sendCreditSms(phoneNumber, amountInr, txRef, merchantName = "Merchant") {
  const phone10 = phoneNumber || DEMO_MERCHANT_PHONE;

  if (!phone10) {
    console.log("[SMS] ⚠️  No phone number provided — skipping SMS");
    return { success: false, reason: "No phone number" };
  }

  const message    = buildBankMessage(amountInr, txRef);
  const phoneE164  = `+91${phone10}`; // Twilio needs E.164 format

  console.log(`[SMS] 📱 Sending to ${phoneE164}: "${message}"`);

  // ── Send via Twilio ────────────────────────────────────────────────────────
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    const result = await sendViaTwilio(phoneE164, message);
    if (result?.success) return result;
  }

  // ── No provider configured ─────────────────────────────────────────────────
  console.error("[SMS] ❌ Twilio not configured or SMS failed.");
  console.error("[SMS]    → Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER in .env");
  return { success: false, reason: "SMS provider not configured or failed" };
}

module.exports = { sendCreditSms, extractPhoneFromUpi };
