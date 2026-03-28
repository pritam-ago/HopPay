/**
 * SMS via Twilio — sends payment notification to merchant
 *
 * Set credentials in relayer/.env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID  || "";
const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN   || "";
const TWILIO_FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER  || "";
const DEMO_MERCHANT_PHONE = process.env.DEMO_MERCHANT_PHONE || "";

/**
 * Extract a 10-digit Indian mobile number from a UPI ID.
 * e.g. "9344790864@ybl" → "9344790864"
 */
function extractPhoneFromUpi(upiId) {
  if (!upiId) return null;
  const match = upiId.match(/^([6-9]\d{9})@/);
  return match ? match[1] : null;
}

/**
 * Send SMS via Twilio REST API.
 */
async function sendCreditSms(phoneNumber, amountInr, txRef, merchantName = "Merchant") {
  const phone10 = phoneNumber || DEMO_MERCHANT_PHONE;

  if (!phone10) {
    console.log("[SMS] ⚠️  No phone number — skipping");
    return { success: false, reason: "No phone number" };
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.error("[SMS] ❌ Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env");
    return { success: false, reason: "Twilio not configured" };
  }

  const shortRef = txRef.slice(0, 10).toUpperCase();
  const message = `HopPay: You received Rs.${amountInr.toFixed(2)}. Ref ${shortRef}. Thank you!`;
  const phoneE164 = `+91${phone10}`;

  console.log(`[SMS] 📱 Sending to ${phoneE164}: "${message}"`);

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: phoneE164,
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

    console.error("[SMS] ❌ Unexpected response:", res.data);
    return { success: false, error: "No SID in response" };
  } catch (err) {
    const errMsg = err?.response?.data?.message || err?.message || "Twilio error";
    console.error("[SMS] ❌ Twilio failed:", errMsg);
    return { success: false, error: errMsg };
  }
}

module.exports = { sendCreditSms, extractPhoneFromUpi };
