/**
 * Demo Bank-Style SMS via Fast2SMS
 * Sends a realistic bank credit notification to the merchant's phone
 * after a HopPay transaction is confirmed.
 */
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || "";
const DEMO_MERCHANT_PHONE = process.env.DEMO_MERCHANT_PHONE || "";

/**
 * Extract a 10-digit Indian mobile number from a UPI ID.
 * Works for formats like: 9876543210@paytm, 9876543210@ybl, 9876543210@oksbi etc.
 * Returns null if the UPI ID doesn't start with a phone number.
 */
function extractPhoneFromUpi(upiId) {
  if (!upiId) return null;
  const match = upiId.match(/^([6-9]\d{9})@/); // Indian mobile: starts with 6-9, 10 digits
  return match ? match[1] : null;
}

/**
 * Send a bank-style credit SMS to the merchant's phone.
 * @param {string} phoneNumber - 10-digit Indian mobile number
 * @param {number} amountInr   - INR amount credited
 * @param {string} txRef       - Short transaction reference (e.g. "MeshT9A2F3")
 * @param {string} merchantName - Merchant name for the message
 */
async function sendCreditSms(phoneNumber, amountInr, txRef, merchantName = "Merchant") {
  if (!FAST2SMS_API_KEY) {
    console.log("[SMS] ⚠️ FAST2SMS_API_KEY not set — skipping SMS");
    return { success: false, reason: "No API key" };
  }

  const phone = phoneNumber || DEMO_MERCHANT_PHONE;
  if (!phone || phone === "9999999999") {
    console.log("[SMS] ⚠️ No merchant phone number provided — skipping SMS");
    return { success: false, reason: "No phone number" };
  }

  // Generate a realistic account/balance display
  const fakeBalance = (1000 + amountInr).toFixed(2);
  const shortRef = txRef.slice(0, 10).toUpperCase();
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear().toString().slice(2)}`;

  // Realistic bank SMS format
  const message =
    `Rs.${amountInr.toFixed(2)} credited to your a/c XXXXXX on ${dateStr}. ` +
    `Avl Bal Rs.${fakeBalance}. ` +
    `Ref:${shortRef} -HopPay`;

  try {
    console.log(`[SMS] 📱 Sending credit SMS to +91${phone}: "${message}"`);
    const res = await axios.get("https://www.fast2sms.com/dev/bulkV2", {
      params: {
        authorization: FAST2SMS_API_KEY,
        message,
        language: "english",
        route: "q",  // Quick transactional route
        numbers: phone,
      },
    });

    if (res.data?.return === true) {
      console.log(`[SMS] ✅ SMS sent! Request ID: ${res.data?.request_id}`);
      return { success: true, requestId: res.data?.request_id, message };
    } else {
      console.error("[SMS] ❌ Fast2SMS error:", res.data?.message);
      return { success: false, error: res.data?.message };
    }
  } catch (err) {
    const errMsg = err?.response?.data?.message || err?.message || "Unknown SMS error";
    console.error("[SMS] ❌ Error:", errMsg);
    return { success: false, error: errMsg };
  }
}

module.exports = { sendCreditSms, extractPhoneFromUpi };
