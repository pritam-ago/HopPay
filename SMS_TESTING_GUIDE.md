# 📱 Twilio SMS Testing Guide

## Overview
The relayer automatically sends bank-style SMS notifications via **Twilio** when transactions are successful. The SMS goes to the merchant (recipient) to simulate a "payment received" notification.

---

## 🎯 How SMS Works in the System

### 1. **Automatic SMS (via `/relay` endpoint)**
When you send a transaction through the mobile app:
- Transaction is submitted to blockchain ✅
- **SMS is sent to merchant via Twilio** 📱

### 2. **Phone Number Detection** (Priority Order):
1. **From UPI ID**: Extracts phone from formats like `9344790864@paytm`
2. **From App Payload**: `merchantPhone` field in transaction
3. **Fallback**: `DEMO_MERCHANT_PHONE` from `.env`

### 3. **SMS Message Format**:
```
HopPay: You received Rs.10.00. Ref MESHTA1B2C3. Thank you!
```

---

## ✅ Your Current Configuration

**From `relayer/.env`:**
```env
TWILIO_ACCOUNT_SID=ACb28d0e95d59f17661e5cde2b6e84c2be
TWILIO_AUTH_TOKEN=69ce53ce04f886bb61e5e1a22be61740
TWILIO_FROM_NUMBER=+12604002537
DEMO_MERCHANT_PHONE=8220811320
```

**Status:** ✅ Fully configured - SMS will be sent automatically!

---

## 🧪 Testing Methods

### **Method 1: Send a Real Transaction** (Recommended - End-to-End Test)

**Prerequisites:**
- ✅ Relayer running on port 3001
- ✅ Mobile app APK installed
- ✅ Sufficient testnet tokens in wallet

**Steps:**
1. **Start the relayer** (if not already running):
   ```bash
   cd E:\devshouse26\HopPay\relayer
   npm run dev
   ```

2. **Open mobile app** and scan a UPI QR code that contains a phone number:
   - Example: `upi://pay?pa=8220811320@paytm&pn=TestMerchant&am=10`
   - Or use any Paytm/PhonePe QR with phone-based UPI ID

3. **Send 10 tokens** and watch the relayer logs:
   ```
   [SMS] 📱 Sending to +918220811320: "HopPay: You received Rs.10.00..."
   [SMS] 🟣 Trying Twilio → +918220811320
   [SMS] ✅ Twilio sent! SID: SMxxxxxxxxxxxxxxxxx
   ```

4. **Check your phone** (8220811320) for SMS!

---

### **Method 2: Direct SMS Endpoint Test** (Quick Test Without Transaction)

Test SMS without doing a blockchain transaction:

**Using cURL:**
```bash
curl -X POST http://localhost:3001/send-sms \
  -H "Content-Type: application/json" \
  -d "{
    \"upiId\": \"8220811320@paytm\",
    \"amount\": \"10\",
    \"txHash\": \"0xabc123def456\",
    \"merchantName\": \"Test Merchant\"
  }"
```

**Using PowerShell:**
```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/send-sms" `
  -ContentType "application/json" `
  -Body '{"upiId":"8220811320@paytm","amount":"10","txHash":"0xabc123def456","merchantName":"Test Merchant"}'
```

**Expected Response:**
```json
{
  "success": true,
  "phone": "8220811320",
  "smsResult": {
    "success": true,
    "provider": "twilio",
    "sid": "SMxxxxxxxxxxxxxxxxx",
    "message": "HopPay: You received Rs.10.00. Ref MESHTABC123. Thank you!"
  }
}
```

---

### **Method 3: Test with Different Phone Numbers**

**Test with explicit phone number:**
```bash
curl -X POST http://localhost:3001/send-sms \
  -H "Content-Type: application/json" \
  -d "{
    \"merchantPhone\": \"9876543210\",
    \"amount\": \"25.50\",
    \"txHash\": \"0x123abc\",
    \"merchantName\": \"Coffee Shop\"
  }"
```

**Test with UPI ID that doesn't contain phone:**
```bash
curl -X POST http://localhost:3001/send-sms \
  -H "Content-Type: application/json" \
  -d "{
    \"upiId\": \"merchant@oksbi\",
    \"amount\": \"100\",
    \"merchantName\": \"Generic Store\"
  }"
```
*This will use DEMO_MERCHANT_PHONE (8220811320) as fallback*

---

## 🔍 Monitoring & Debugging

### **Watch Relayer Logs**
When SMS is sent, you'll see detailed logs:

**Successful SMS:**
```
[SMS] 📱 Sending to +918220811320: "HopPay: You received Rs.10.00..."
[SMS] 🟣 Trying Twilio → +918220811320
[SMS] ✅ Twilio sent! SID: SM1234567890abcdef
```

**Failed SMS:**
```
[SMS] 🟣 Trying Twilio → +918220811320
[SMS] ❌ Twilio failed: [Error 21211] Invalid 'To' Phone Number
[SMS] ❌ Twilio not configured or SMS failed.
```

### **Common Issues**

| Issue | Solution |
|-------|----------|
| `No phone number provided` | Add phone to UPI ID or set DEMO_MERCHANT_PHONE |
| `Invalid 'To' Phone Number` | Verify phone number format (10 digits, no +91) |
| `Authentication Error` | Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN |
| `Insufficient balance` | Add credits to Twilio account |

---

## 🎬 Live Testing Workflow

### **Complete End-to-End Test:**

1. **Terminal 1 - Start Relayer:**
   ```bash
   cd E:\devshouse26\HopPay\relayer
   npm run dev
   ```
   
   Wait for:
   ```
   🚀 MeshT Relayer running on http://0.0.0.0:3001
   ```

2. **Terminal 2 - Test SMS Endpoint (Optional):**
   ```bash
   curl -X POST http://localhost:3001/send-sms \
     -H "Content-Type: application/json" \
     -d "{\"upiId\":\"8220811320@paytm\",\"amount\":\"5\",\"merchantName\":\"Quick Test\"}"
   ```

3. **Mobile Phone - Send Real Transaction:**
   - Open HopPay app
   - Scan UPI QR: `upi://pay?pa=8220811320@paytm&pn=TestShop&am=10`
   - Send 10 tokens
   - Watch Terminal 1 for logs
   - Check phone 8220811320 for SMS!

---

## 📊 Expected Results

### **What You'll Receive on Phone 8220811320:**

**SMS from Twilio (+12604002537):**
```
HopPay: You received Rs.10.00. Ref MESHTF3A2B1. Thank you!
```

### **Relayer Console Output:**
```
[REQUEST] POST /relay from 172.16.40.120 | body keys: type, contractAddress, functionName...
[RELAY] ✅ Signature verified
[BLOCKCHAIN] ✅ Transaction successful: 0xabc...def
[SMS] 📲 Extracted phone from UPI ID "8220811320@paytm": 8220811320
[SMS] 📱 Sending to +918220811320: "HopPay: You received Rs.10.00..."
[SMS] 🟣 Trying Twilio → +918220811320
[SMS] ✅ Twilio sent! SID: SM1234567890abcdef1234567890abcdef
[RELAY] ✅ Done in 3456ms — TX: 0xabc...def
```

---

## 🚀 Quick Test Commands

**Restart Relayer:**
```bash
cd E:\devshouse26\HopPay\relayer && npm run dev
```

**Test SMS (cURL):**
```bash
curl -X POST http://localhost:3001/send-sms \
  -H "Content-Type: application/json" \
  -d "{\"upiId\":\"8220811320@paytm\",\"amount\":\"10\",\"merchantName\":\"Test\"}"
```

**Check Relayer Health:**
```bash
curl http://localhost:3001/health
```

**View Pending Queue:**
```bash
curl http://localhost:3001/queue
```

---

## ✅ Checklist Before Testing

- [ ] Relayer is running (`npm run dev`)
- [ ] Relayer shows no errors on startup
- [ ] `.env` has all Twilio credentials
- [ ] Phone number 8220811320 can receive SMS
- [ ] Twilio account has sufficient credits ($15 free trial)
- [ ] Mobile app is connected to same WiFi as PC
- [ ] **Phone number 8220811320 is verified in Twilio** (for trial accounts)

---

## 🎯 Success Criteria

✅ **SMS Test Passed** if you see:
1. Relayer logs: `✅ Twilio sent! SID: SM...`
2. SMS received on phone 8220811320
3. SMS contains correct amount and transaction reference

---

## 🔧 Troubleshooting

### **No SMS Received:**
1. Check relayer logs for `[SMS]` entries
2. Verify Twilio credentials in `.env`
3. Check Twilio console: https://console.twilio.com/us1/monitor/logs/sms
4. Ensure phone number is verified in Twilio (trial accounts)

### **Twilio Trial Restrictions:**
- Trial accounts can only send to **verified phone numbers**
- Verify 8220811320 at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified
- Add +918220811320 to verified numbers list
- Twilio will call and provide a verification code
- Upgrade to paid account for unrestricted sending

---

**Last Updated:** March 28, 2026  
**Your Configuration Status:** ✅ Ready to Test
