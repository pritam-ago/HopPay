/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { triggerInrPayout, meshtToInr } = require("./payout");

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

// ─── Local EIP-712 Signature Verification ────────────────────────────────────

async function verifySignature(payload) {
  try {
    const { parameters, contractAddress } = payload;
    const domain = {
      name: TOKEN_NAME,
      version: TOKEN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: contractAddress,
    };
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
    const value = {
      from: parameters.from.toLowerCase(),
      to: parameters.to.toLowerCase(),
      value: BigInt(parameters.value),
      validAfter: BigInt(parameters.validAfter),
      validBefore: BigInt(parameters.validBefore),
      nonce: parameters.nonce,
    };
    const recovered = ethers.verifyTypedData(domain, types, value, parameters.signature);
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

    // Deduplicate by nonce
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

    // INR payout
    let payoutResult = null;
    const amountInr = meshtToInr(parameters.value);

    console.log(`[PAYOUT] Converting ${ethers.formatUnits(parameters.value, 18)} MESHT → ₹${amountInr}`);

    // If the "to" address is a UPI VPA (came from UPI QR scan), pay out to it.
    // Otherwise, attempt to pay the on-chain "to" address's registered UPI (future feature).
    const upiId = payload.upiId ?? null;

    if (upiId) {
      console.log(`[PAYOUT] ₹${amountInr} → ${upiId}`);
      payoutResult = await triggerInrPayout(upiId, amountInr, txHash, payload.merchantName ?? "Merchant");
      pendingItem.payoutResult = payoutResult;
      
      // Log transaction status from Decentro
      if (payoutResult?.transactionStatus) {
        console.log(`[PAYOUT] Decentro Transaction Status: ${payoutResult.transactionStatus}`);
        
        // Warn if transaction is pending (not immediately settled)
        if (payoutResult.transactionStatus === "pending") {
          console.warn(`[PAYOUT] ⚠️  Transaction is PENDING - settlement not immediate`);
        } else if (payoutResult.transactionStatus === "failure") {
          console.error(`[PAYOUT] ❌ Transaction FAILED at Decentro level`);
        } else if (payoutResult.transactionStatus === "success") {
          console.log(`[PAYOUT] ✅ Transaction SUCCESS at Decentro`);
        }
      }
    } else {
      console.log(`[PAYOUT] No UPI ID provided — skipping INR payout (crypto-only mode)`);
    }

    pendingQueue.set(itemId, pendingItem);
    const elapsed = Date.now() - startTime;
    console.log(`[RELAY] ✅ Done in ${elapsed}ms — TX: ${txHash}`);

    return res.json({
      success: true,
      transactionHash: txHash,
      blockNumber,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
      amountInr,
      payout: payoutResult,
      payoutStatus: payoutResult?.transactionStatus || "unknown",
      elapsed,
    });
  } catch (err) {
    console.error("[RELAY] ❌ Error:", err?.message);
    return res.status(500).json({ success: false, error: err?.message ?? "Unknown error" });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 MeshT Relayer running on http://localhost:${PORT}`);
  console.log(`   Network:  ${RPC_URL}`);
  console.log(`   Contract: ${CONTRACT_ADDRESS}`);
  if (RELAYER_PRIVATE_KEY) {
    console.log(`   Relayer:  ${new ethers.Wallet(RELAYER_PRIVATE_KEY).address}`);
  } else {
    console.warn(`   ⚠️  RELAYER_PRIVATE_KEY not set`);
  }
  console.log(`\n   POST http://localhost:${PORT}/relay`);
  console.log(`   GET  http://localhost:${PORT}/health\n`);
});

module.exports = app;
