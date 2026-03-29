/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { sendCreditSms, extractPhoneFromUpi } = require("./sms.cjs");

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);
const RPC_URL = process.env.RPC_URL ?? "https://testnet.evm.nodes.onflow.org";
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ?? "0xd1Eb9CeAA265D4d2f13E4dDD815AA5fe7212fdA8";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY ?? "";
const TOKEN_NAME = process.env.TOKEN_NAME ?? "MESHT";
const TOKEN_VERSION = process.env.TOKEN_VERSION ?? "1";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 545);

// ─── Contract ABI (minimal) ───────────────────────────────────────────────────

const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "uint256", name: "validAfter", type: "uint256" },
      { internalType: "uint256", name: "validBefore", type: "uint256" },
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ─── Pending Queue ────────────────────────────────────────────────────────────
const pendingQueue = new Map();

// ─── Local Signature Verification ────────────────────────────────────────────
// Must match the contract's verification:
//   messageHash = keccak256(abi.encodePacked(from, to, value, validAfter, validBefore, nonce, address(this), block.chainid))
//   ECDSA.recover(keccak256("\x19Ethereum Signed Message:\n32" + messageHash), signature)

async function verifySignature(payload) {
  try {
    const { parameters, contractAddress } = payload;

    // EIP-712 domain — must match the deployed contract's domain separator
    const domain = {
      name: TOKEN_NAME,      // "MESHT"
      version: TOKEN_VERSION, // "1"
      chainId: CHAIN_ID,
      verifyingContract: contractAddress,
    };

    // EIP-3009 TransferWithAuthorization type
    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };

    const message = {
      from: parameters.from,
      to: parameters.to,
      value: BigInt(parameters.value),
      validAfter: BigInt(parameters.validAfter),
      validBefore: BigInt(parameters.validBefore),
      nonce: parameters.nonce,
    };

    // Recover signer using EIP-712 typed data
    const recovered = ethers.verifyTypedData(domain, types, message, parameters.signature);
    return recovered.toLowerCase() === parameters.from.toLowerCase();
  } catch {
    return false;
  }
}

// ─── Submit to Blockchain ─────────────────────────────────────────────────────

async function submitToBlockchain(payload) {
  if (!RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  const { parameters } = payload;

  console.log(`[BLOCKCHAIN] Submitting transferWithAuthorization…`);
  console.log(`  from: ${parameters.from}  to: ${parameters.to}`);
  console.log(`  value: ${ethers.formatUnits(parameters.value, 18)} MESHT`);

  const tx = await contract.transferWithAuthorization(
    parameters.from,
    parameters.to,
    parameters.value,
    parameters.validAfter,
    parameters.validBefore,
    parameters.nonce,
    parameters.signature
  );

  console.log(`[BLOCKCHAIN] Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[BLOCKCHAIN] Confirmed in block: ${receipt.blockNumber}`);
  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Log EVERY incoming request so we can see if the phone is reaching us
app.use((req, _res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.ip} | body keys: ${Object.keys(req.body || {}).join(', ') || 'none'}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    relayerAddress: RELAYER_PRIVATE_KEY
      ? new ethers.Wallet(RELAYER_PRIVATE_KEY).address
      : "not configured",
    queueSize: pendingQueue.size,
    network: RPC_URL,
    timestamp: Date.now(),
  });
});

app.get("/queue", (_req, res) => {
  const items = Array.from(pendingQueue.values()).map((item) => ({
    id: item.id,
    status: item.status,
    receivedAt: item.receivedAt,
    txHash: item.txHash,
    error: item.error,
  }));
  res.json({ count: items.length, items });
});

// ─── Test SMS Endpoint ────────────────────────────────────────────────────────
// Test endpoint to verify Twilio credentials
app.get("/test-sms", async (req, res) => {
  console.log("[TEST-SMS] Testing Twilio configuration...");
  
  const testPhone = process.env.DEMO_MERCHANT_PHONE || "8220811320";
  const testAmount = 100;
  const testRef = "TEST123";
  
  console.log(`[TEST-SMS] Sending test SMS to ${testPhone}`);
  
  try {
    const result = await sendCreditSms(testPhone, testAmount, testRef, "Test Merchant");
    console.log("[TEST-SMS] Result:", result);
    
    res.json({
      success: result.success,
      phone: `+91${testPhone}`,
      result,
      credentials: {
        accountSid: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.slice(0, 10)}...` : "NOT SET",
        authToken: process.env.TWILIO_AUTH_TOKEN ? "SET (hidden)" : "NOT SET",
        fromNumber: process.env.TWILIO_FROM_NUMBER || "NOT SET",
      }
    });
  } catch (err) {
    console.error("[TEST-SMS] Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Standalone SMS notification endpoint ─────────────────────────────────────
// The app calls this AFTER a successful on-chain transaction to trigger
// the merchant SMS — no need for the full relay flow.
app.post("/send-sms", async (req, res) => {
  try {
    const { upiId, merchantPhone, amount, txHash, merchantName } = req.body;
    console.log(`[SMS-ENDPOINT] Request: upiId=${upiId} phone=${merchantPhone} amount=${amount} txHash=${txHash}`);

    let phone = null;
    let phoneSource = null;

    // Priority 1: Extract phone from UPI ID
    if (upiId) {
      const phoneFromUpi = extractPhoneFromUpi(upiId);
      if (phoneFromUpi) {
        phone = phoneFromUpi;
        phoneSource = `UPI ID "${upiId}"`;
        console.log(`[SMS-ENDPOINT] 📲 Extracted phone from UPI ID "${upiId}": ${phoneFromUpi}`);
      } else {
        console.warn(`[SMS-ENDPOINT] ⚠️ Could not extract phone from UPI ID "${upiId}" - UPI format may not contain phone number`);
      }
    }

    // Priority 2: Use provided merchant phone
    if (!phone && merchantPhone) {
      phone = merchantPhone;
      phoneSource = "provided merchant phone";
      console.log(`[SMS-ENDPOINT] 📱 Using provided merchant phone: ${merchantPhone}`);
    }

    // Priority 3: FALLBACK ONLY - Use DEMO_MERCHANT_PHONE if UPI ID exists but extraction failed
    if (!phone && upiId && process.env.DEMO_MERCHANT_PHONE) {
      phone = process.env.DEMO_MERCHANT_PHONE;
      phoneSource = "DEMO_MERCHANT_PHONE (fallback for UPI payment)";
      console.log(`[SMS-ENDPOINT] 📱 Using DEMO_MERCHANT_PHONE as fallback: ${process.env.DEMO_MERCHANT_PHONE}`);
    }

    if (!phone) {
      console.warn("[SMS-ENDPOINT] ⚠️ No phone number available - cannot send SMS");
      return res.status(400).json({ success: false, error: "No phone number available" });
    }

    const amountNum = parseFloat(amount) || 0;
    const shortRef = txHash ? `MeshT${txHash.slice(2, 8).toUpperCase()}` : `MeshT${Date.now().toString(36).toUpperCase()}`;

    console.log(`[SMS-ENDPOINT] 📤 Sending SMS to ${phone} (from ${phoneSource}) for amount ₹${amountNum} (ref: ${shortRef})`);
    const smsResult = await sendCreditSms(phone, amountNum, shortRef, merchantName || "Merchant");
    console.log(`[SMS-ENDPOINT] ✅ Result:`, smsResult);

    return res.json({
      success: smsResult.success,
      phone,
      phoneSource,
      smsResult,
    });
  } catch (err) {
    console.error("[SMS-ENDPOINT] ❌ Error:", err?.message);
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.post("/relay", async (req, res) => {
  const startTime = Date.now();
  try {
    const payload = req.body;

    if (payload.type !== "TRANSFER_WITH_AUTHORIZATION" || !payload.parameters || !payload.contractAddress) {
      return res.status(400).json({ success: false, error: "Invalid payload structure" });
    }

    const { parameters } = payload;
    const now = Math.floor(Date.now() / 1000);

    if (now < Number(parameters.validAfter))
      return res.status(400).json({ success: false, error: "Voucher not yet valid" });
    if (now > Number(parameters.validBefore))
      return res.status(400).json({ success: false, error: "Voucher has expired" });

    const sigValid = await verifySignature(payload);
    if (!sigValid)
      return res.status(400).json({ success: false, error: "Invalid EIP-712 signature" });

    console.log(`[RELAY] ✅ Signature verified`);

    const itemId = parameters.nonce;
    if (pendingQueue.has(itemId)) {
      const existing = pendingQueue.get(itemId);
      if (existing.status === "success")
        return res.json({ success: true, cached: true, txHash: existing.txHash });
    }

    const pendingItem = { id: itemId, payload, receivedAt: Date.now(), status: "pending" };
    pendingQueue.set(itemId, pendingItem);

    let txHash, blockNumber;
    try {
      ({ txHash, blockNumber } = await submitToBlockchain(payload));
      pendingItem.status = "success";
      pendingItem.txHash = txHash;
    } catch (chainErr) {
      pendingItem.status = "failed";
      pendingItem.error = chainErr?.message;
      pendingQueue.set(itemId, pendingItem);
      return res.status(500).json({ success: false, error: `Blockchain failed: ${chainErr?.message}` });
    }

    // ── SMS Notification ───────────────────────────────────────────────────────
    const upiId = payload.upiId ?? null;
    
    // Only attempt SMS if we have a UPI ID or merchant phone
    if (!upiId && !payload.merchantPhone) {
      console.log("[SMS] ⏭️  No UPI ID or merchant phone - skipping SMS notification");
    } else {
      let merchantPhone = null;
      let phoneSource = null;

      // Priority 1: Extract phone from UPI ID
      if (upiId) {
        const phoneFromUpi = extractPhoneFromUpi(upiId);
        if (phoneFromUpi) {
          merchantPhone = phoneFromUpi;
          phoneSource = `UPI ID "${upiId}"`;
          console.log(`[SMS] 📲 Extracted phone from UPI ID "${upiId}": ${phoneFromUpi}`);
        } else {
          console.warn(`[SMS] ⚠️ Could not extract phone from UPI ID "${upiId}"`);
        }
      }

      // Priority 2: Use provided merchant phone
      if (!merchantPhone && payload.merchantPhone) {
        merchantPhone = payload.merchantPhone;
        phoneSource = "provided merchant phone";
        console.log(`[SMS] 📱 Using provided merchant phone: ${payload.merchantPhone}`);
      }

      // Priority 3: FALLBACK ONLY - Use DEMO_MERCHANT_PHONE if UPI ID exists but extraction failed
      if (!merchantPhone && upiId && process.env.DEMO_MERCHANT_PHONE) {
        merchantPhone = process.env.DEMO_MERCHANT_PHONE;
        phoneSource = "DEMO_MERCHANT_PHONE (fallback)";
        console.log(`[SMS] 📱 Using DEMO_MERCHANT_PHONE as fallback: ${process.env.DEMO_MERCHANT_PHONE}`);
      }

      if (merchantPhone) {
        const shortRef = `MeshT${txHash.slice(2, 8).toUpperCase()}`;
        const amountInr = parseFloat(ethers.formatUnits(parameters.value, 18)) * 100; // Assuming 1 MESHT = ₹100
        console.log(`[SMS] 📤 Sending to ${merchantPhone} (from ${phoneSource}) for ₹${amountInr} (ref: ${shortRef})`);
        sendCreditSms(merchantPhone, amountInr, shortRef, payload.merchantName ?? "Merchant")
          .catch(e => console.error("[SMS] ❌ Failed:", e.message));
      } else {
        console.warn("[SMS] ⚠️ Could not determine phone number - skipping SMS");
      }
    }

    pendingQueue.set(itemId, pendingItem);
    const elapsed = Date.now() - startTime;
    console.log(`[RELAY] ✅ Done in ${elapsed}ms — TX: ${txHash}`);

    return res.json({
      success: true,
      transactionHash: txHash,
      blockNumber,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
      elapsed,
    });
  } catch (err) {
    console.error("[RELAY] ❌ Error:", err?.message);
    return res.status(500).json({ success: false, error: err?.message ?? "Unknown error" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MeshT Relayer running on http://0.0.0.0:${PORT}`);
  console.log(`   Accessible from phone at: http://172.16.41.80:${PORT}`);
  console.log(`   Network:  ${RPC_URL}`);
  console.log(`   Contract: ${CONTRACT_ADDRESS}`);
  if (RELAYER_PRIVATE_KEY) {
    console.log(`   Relayer:  ${new ethers.Wallet(RELAYER_PRIVATE_KEY).address}`);
  }
  console.log(`\n   POST http://172.16.41.80:${PORT}/relay`);
  console.log(`   GET  http://172.16.41.80:${PORT}/health\n`);
});

module.exports = app;
