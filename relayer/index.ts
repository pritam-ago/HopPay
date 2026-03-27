/**
 * MeshT Ghost Voucher Relayer — Express Server
 *
 * Accepts signed EIP-3009 "Ghost Vouchers" from merchant devices,
 * submits them to the Flow EVM blockchain, and triggers an INR payout
 * to the merchant's UPI ID via Cashfree.
 *
 * Endpoints:
 *   POST /relay        — Submit a Ghost Voucher payload for on-chain settlement
 *   GET  /health       — Health check
 *   GET  /queue        — View pending relays (for debugging)
 */
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { triggerInrPayout, meshtToInr } from "./payout.js";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransactionParameters {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
}

interface TransactionPayload {
  type: "TRANSFER_WITH_AUTHORIZATION";
  contractAddress: string;
  functionName: string;
  parameters: TransactionParameters;
  // Optional: UPI metadata added by the scanner (from UPI QR codes)
  upiId?: string;
  merchantName?: string;
}

// ─── Pending Queue (in-memory; replace with Redis/DB for production) ──────────

interface PendingItem {
  id: string;
  payload: TransactionPayload;
  receivedAt: number;
  status: "pending" | "success" | "failed";
  txHash?: string;
  payoutResult?: object;
  error?: string;
}

const pendingQueue = new Map<string, PendingItem>();

// ─── Local EIP-712 Signature Verification ─────────────────────────────────────

async function verifySignature(payload: TransactionPayload): Promise<boolean> {
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

async function submitToBlockchain(
  payload: TransactionPayload
): Promise<{ txHash: string; blockNumber: number }> {
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("RELAYER_PRIVATE_KEY not set in .env");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayerWallet);

  const { parameters } = payload;

  // Validate nonce is 32 bytes
  const nonceBytes = ethers.getBytes(parameters.nonce);
  if (nonceBytes.length !== 32) {
    throw new Error(`Invalid nonce: expected 32 bytes, got ${nonceBytes.length}`);
  }

  console.log(`[BLOCKCHAIN] Submitting transferWithAuthorization…`);
  console.log(`  from:  ${parameters.from}`);
  console.log(`  to:    ${parameters.to}`);
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

/**
 * GET /health
 * Returns relayer status and queue size.
 */
app.get("/health", (_req: Request, res: Response) => {
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

/**
 * GET /queue
 * Returns all items in the pending queue (for debugging).
 */
app.get("/queue", (_req: Request, res: Response) => {
  const items = Array.from(pendingQueue.values()).map((item) => ({
    id: item.id,
    status: item.status,
    receivedAt: item.receivedAt,
    txHash: item.txHash,
    error: item.error,
  }));
  res.json({ count: items.length, items });
});

/**
 * POST /relay
 * Main endpoint — receives a Ghost Voucher payload and settles it.
 *
 * Body: TransactionPayload JSON
 * Returns: { success, txHash, blockNumber, payout }
 */
app.post("/relay", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const payload = req.body as TransactionPayload;

    // ── 1. Validate structure ──────────────────────────────────────────────
    if (
      payload.type !== "TRANSFER_WITH_AUTHORIZATION" ||
      !payload.parameters ||
      !payload.contractAddress
    ) {
      return res.status(400).json({ success: false, error: "Invalid payload structure" });
    }

    const { parameters } = payload;

    // ── 2. Validate time window ────────────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(parameters.validAfter)) {
      return res.status(400).json({ success: false, error: "Voucher not yet valid" });
    }
    if (now > Number(parameters.validBefore)) {
      return res.status(400).json({ success: false, error: "Voucher has expired" });
    }

    // ── 3. Local signature verification ───────────────────────────────────
    const sigValid = await verifySignature(payload);
    if (!sigValid) {
      return res.status(400).json({ success: false, error: "Invalid EIP-712 signature" });
    }
    console.log(`[RELAY] Signature verified ✅`);

    // ── 4. Deduplicate by nonce ────────────────────────────────────────────
    const itemId = parameters.nonce;
    if (pendingQueue.has(itemId)) {
      const existing = pendingQueue.get(itemId)!;
      if (existing.status === "success") {
        return res.json({
          success: true,
          cached: true,
          txHash: existing.txHash,
          message: "Already relayed",
        });
      }
    }

    // ── 5. Track in pending queue ──────────────────────────────────────────
    const pendingItem: PendingItem = {
      id: itemId,
      payload,
      receivedAt: Date.now(),
      status: "pending",
    };
    pendingQueue.set(itemId, pendingItem);

    // ── 6. Submit to blockchain ────────────────────────────────────────────
    let txHash: string;
    let blockNumber: number;
    try {
      ({ txHash, blockNumber } = await submitToBlockchain(payload));
      pendingItem.status = "success";
      pendingItem.txHash = txHash;
    } catch (chainErr: any) {
      pendingItem.status = "failed";
      pendingItem.error = chainErr?.message;
      pendingQueue.set(itemId, pendingItem);
      return res.status(500).json({
        success: false,
        error: `Blockchain submission failed: ${chainErr?.message}`,
      });
    }

    // ── 7. Trigger INR payout ─────────────────────────────────────────────
    let payoutResult = null;
    const amountInr = meshtToInr(parameters.value);

    // If the "to" address is a UPI VPA (came from UPI QR scan), pay out to it.
    // Otherwise, attempt to pay the on-chain "to" address's registered UPI (future feature).
    const upiId = payload.upiId ?? null;

    if (upiId) {
      console.log(`[PAYOUT] Triggering ₹${amountInr} to UPI: ${upiId}`);
      payoutResult = await triggerInrPayout(
        upiId,
        amountInr,
        txHash,
        payload.merchantName ?? "Merchant"
      );
      pendingItem.payoutResult = payoutResult;
    } else {
      console.log(`[PAYOUT] No UPI ID provided — skipping INR payout (crypto-only mode)`);
    }

    pendingQueue.set(itemId, pendingItem);

    const elapsed = Date.now() - startTime;
    console.log(`[RELAY] ✅ Complete in ${elapsed}ms — TX: ${txHash}`);

    return res.json({
      success: true,
      transactionHash: txHash,
      blockNumber,
      explorerUrl: `https://evm-testnet.flowscan.io/tx/${txHash}`,
      amountInr,
      payout: payoutResult,
      elapsed,
    });
  } catch (err: any) {
    console.error("[RELAY] ❌ Unexpected error:", err?.message);
    return res.status(500).json({
      success: false,
      error: err?.message ?? "Unknown relayer error",
    });
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
    console.warn(`   ⚠️  RELAYER_PRIVATE_KEY not set — blockchain submission will fail`);
  }
  console.log(`\n   Endpoints:`);
  console.log(`     GET  http://localhost:${PORT}/health`);
  console.log(`     POST http://localhost:${PORT}/relay`);
  console.log(`     GET  http://localhost:${PORT}/queue\n`);
});

export default app;
