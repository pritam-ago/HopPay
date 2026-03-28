// ─── Direct Twilio SMS (calls Twilio API from the phone) ──────────────────────
// For hackathon demo only — in production, credentials should be on a server.

const TWILIO_ACCOUNT_SID = "ACbf7b97ba684ac820aec4eb5c3092924c";
const TWILIO_AUTH_TOKEN = "ab7c01b507b9d38a9f163a5e784e6ac0";
const TWILIO_FROM_NUMBER = "+14788126802";
const DEMO_MERCHANT_PHONE = "9344790864";

/**
 * Extract a 10-digit Indian mobile number from a UPI ID.
 * e.g. "9344790864@ybl" → "9344790864"
 */
export function extractPhoneFromUpi(upiId?: string): string | null {
  if (!upiId) return null;
  const local = upiId.split("@")[0]; // e.g. "9344790864"
  const digits = local.replace(/\D/g, "");
  // Indian mobile: 10 digits starting with 6-9
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

/**
 * Send an SMS via Twilio's REST API directly from the phone.
 * Returns { success, sid, phone, error }
 */
export async function sendSmsDirect(params: {
  upiId?: string;
  merchantPhone?: string;
  amount: string;
  txHash?: string;
  merchantName?: string;
}): Promise<{
  success: boolean;
  sid?: string;
  phone?: string;
  error?: string;
}> {
  const { upiId, merchantPhone, amount, txHash, merchantName } = params;

  // 1. Determine the phone number
  const phoneFromUpi = extractPhoneFromUpi(upiId);
  const phone = phoneFromUpi || merchantPhone || DEMO_MERCHANT_PHONE;

  if (!phone) {
    return { success: false, error: "No phone number available" };
  }

  // 2. Build the message
  const amountNum = parseFloat(amount) || 0;
  const ref = txHash
    ? `MeshT${txHash.slice(2, 8).toUpperCase()}`
    : `MeshT${Date.now().toString(36).toUpperCase()}`;
  const message = `HopPay: You received Rs.${amountNum.toFixed(2)}. Ref ${ref}. Thank you!`;

  // 3. Format the "To" number with country code
  const toNumber = phone.startsWith("+") ? phone : `+91${phone}`;

  // 4. Call Twilio REST API
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  // Twilio expects x-www-form-urlencoded, NOT JSON
  const body = new URLSearchParams({
    To: toNumber,
    From: TWILIO_FROM_NUMBER,
    Body: message,
  });

  // Basic auth: base64(SID:Token) — manual encode since RN may not have btoa()
  const base64Encode = (str: string): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    const bytes = Array.from(str).map((c) => c.charCodeAt(0));
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i], b2 = bytes[i + 1] ?? 0, b3 = bytes[i + 2] ?? 0;
      result += chars[b1 >> 2];
      result += chars[((b1 & 3) << 4) | (b2 >> 4)];
      result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : "=";
      result += i + 2 < bytes.length ? chars[b3 & 63] : "=";
    }
    return result;
  };
  const authString = base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  console.log(`[TWILIO-DIRECT] 📱 Sending SMS to ${toNumber}: "${message}"`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${authString}`,
      },
      body: body.toString(),
    });

    const data = await res.json();

    if (res.ok && data.sid) {
      console.log(`[TWILIO-DIRECT] ✅ SMS sent! SID: ${data.sid}`);
      return { success: true, sid: data.sid, phone };
    } else {
      console.error(`[TWILIO-DIRECT] ❌ Failed:`, data.message || data);
      return { success: false, error: data.message || "Twilio API error", phone };
    }
  } catch (err: any) {
    console.error(`[TWILIO-DIRECT] ❌ Network error:`, err?.message);
    return { success: false, error: err?.message || "Network error", phone };
  }
}
