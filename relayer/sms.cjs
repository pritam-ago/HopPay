/**
 * Demo Bank-Style SMS — Multi-Provider
 *
 * Provider priority (first one with credentials wins):
 *   1. Twilio  — free $15 trial, works on Indian numbers, no recharge needed
 *   2. Fast2SMS — requires ₹100 wallet recharge before use
 *
 * Set credentials in relayer/.env
 */
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// ── Provider credentials ─────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID  || "";
const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   || "";
const TWILIO_FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER  || ""; // e.g. +12345678900

const FAST2SMS_API_KEY    = process.env.FAST2SMS_API_KEY    || "";
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

// ── Provider 1: Twilio ────────────────────────────────────────────────────────

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

// ── Provider 2: Fast2SMS ──────────────────────────────────────────────────────
// NOTE: Requires ₹100 wallet recharge at fast2sms.com before API access is granted.

async function sendViaFast2Sms(phone10, message) {
  if (!FAST2SMS_API_KEY) {
    return null; // not configured — skip
  }

  console.log(`[SMS] 🟡 Trying Fast2SMS → +91${phone10}`);
  console.log(`[SMS] API Key (first 10 chars): ${FAST2SMS_API_KEY.slice(0, 10)}...`);

  try {
    // Fast2SMS: ALL params go in query string (including authorization) — header auth returns 401
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(FAST2SMS_API_KEY)}&sender_id=FSTSMS&message=${encodeURIComponent(message)}&language=english&route=q&numbers=${phone10}`;

    console.log(`[SMS] Request URL: ${url.slice(0, 80)}...`);

    const res = await axios.get(url);

    console.log(`[SMS] Fast2SMS status: ${res.status}`);
    console.log("[SMS] Fast2SMS response:", JSON.stringify(res.data));

    if (res.data?.return === true) {
      console.log(`[SMS] ✅ Fast2SMS sent! Request ID: ${res.data.request_id}`);
      return { success: true, provider: "fast2sms", requestId: res.data.request_id, message };
    }

    const errMsg = Array.isArray(res.data?.message)
      ? res.data.message.join(", ")
      : res.data?.message || "Unknown error";
    console.error("[SMS] ❌ Fast2SMS rejected:", errMsg);
    return { success: false, provider: "fast2sms", error: errMsg };
  } catch (err) {
    console.error("[SMS] ❌ Fast2SMS HTTP status:", err?.response?.status);
    console.error("[SMS] ❌ Fast2SMS response body:", JSON.stringify(err?.response?.data));
    const errMsg =
      err?.response?.data?.message || err?.message || "Fast2SMS error";
    console.error("[SMS] ❌ Fast2SMS error:", errMsg);
    return { success: false, provider: "fast2sms", error: errMsg };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Send a bank-style credit SMS to the merchant.
 * Tries Twilio first, then Fast2SMS as fallback.
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

  // ── Try Twilio first (recommended) ─────────────────────────────────────────
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    const result = await sendViaTwilio(phoneE164, message);
    if (result?.success) return result;
    console.log("[SMS] Twilio failed — falling back to Fast2SMS");
  }

  // ── Fallback: Fast2SMS ──────────────────────────────────────────────────────
  if (FAST2SMS_API_KEY) {
    const result = await sendViaFast2Sms(phone10, message);
    if (result?.success) return result;
  }

  // ── No provider worked ──────────────────────────────────────────────────────
  console.error("[SMS] ❌ All SMS providers failed or unconfigured.");
  if (!TWILIO_ACCOUNT_SID && !FAST2SMS_API_KEY) {
    console.error("[SMS]    → Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER in .env");
    console.error("[SMS]    → OR recharge Fast2SMS wallet (₹100+) and set FAST2SMS_API_KEY");
  }
  return { success: false, reason: "All providers failed" };
}

module.exports = { sendCreditSms, extractPhoneFromUpi };
