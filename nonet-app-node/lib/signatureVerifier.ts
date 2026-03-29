/**
 * Local Signature Verifier
 *
 * Verifies an EIP-3009 "Ghost Voucher" (TransferWithAuthorization payload)
 * entirely locally — no network or blockchain call required.
 *
 * Uses the same keccak256(abi.encodePacked(...)) + Ethereum prefix that
 * the deployed EIPThreeDoubleZeroNine contract and TransactionLoader.tsx use.
 */
import { ethers } from "ethers";
import { CONTRACT_CONFIG, TransactionPayload } from "@/constants/contracts";

export interface VerificationResult {
  valid: boolean;
  from?: string;
  to?: string;
  /** Amount in token units (raw wei string) */
  amountRaw?: string;
  /** Amount formatted with 18 decimals */
  amountFormatted?: string;
  error?: string;
}

/**
 * Verify a received Ghost Voucher locally using keccak256 + Ethereum prefix recovery.
 * The merchant calls this the moment they receive a BLE packet — no internet needed.
 */
export async function verifyGhostVoucher(
  payloadJson: string,
  chainId: number = 545
): Promise<VerificationResult> {
  try {
    let payload: TransactionPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      return { valid: false, error: "Malformed JSON payload" };
    }

    if (
      payload.type !== "TRANSFER_WITH_AUTHORIZATION" ||
      !payload.parameters ||
      !payload.contractAddress
    ) {
      return { valid: false, error: "Invalid payload structure" };
    }

    const { parameters, contractAddress } = payload;

    // Validate time windows
    const now = Math.floor(Date.now() / 1000);
    const validAfter = Number(parameters.validAfter);
    const validBefore = Number(parameters.validBefore);

    if (now < validAfter) {
      return { valid: false, error: "Voucher not yet valid" };
    }
    if (now > validBefore) {
      return { valid: false, error: "Voucher has expired" };
    }

    // Replicate the contract's keccak256(abi.encodePacked(...))
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "uint256", "bytes32", "address", "uint256"],
      [
        parameters.from,
        parameters.to,
        BigInt(parameters.value),
        BigInt(parameters.validAfter),
        BigInt(parameters.validBefore),
        parameters.nonce,
        contractAddress,
        BigInt(chainId),
      ]
    );

    // Local signature recovery — pure cryptography, no RPC call
    // hashMessage adds the "\x19Ethereum Signed Message:\n32" prefix
    const recoveredSigner = ethers.recoverAddress(
      ethers.hashMessage(ethers.getBytes(messageHash)),
      parameters.signature
    );

    const isValid = recoveredSigner.toLowerCase() === parameters.from.toLowerCase();

    if (!isValid) {
      return {
        valid: false,
        error: `Signature mismatch: expected ${parameters.from}, got ${recoveredSigner}`,
      };
    }

    const amountFormatted = ethers.formatUnits(BigInt(parameters.value), 18);

    return {
      valid: true,
      from: parameters.from,
      to: parameters.to,
      amountRaw: parameters.value,
      amountFormatted,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || "Unknown verification error",
    };
  }
}

