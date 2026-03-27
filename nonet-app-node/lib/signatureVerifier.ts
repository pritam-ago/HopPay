/**
 * Local EIP-712 Signature Verifier
 *
 * Verifies an EIP-3009 "Ghost Voucher" (TransferWithAuthorization payload)
 * entirely locally — no network or blockchain call required.
 *
 * Uses the same domain/types that AuthAndMintToken.sol and TransactionLoader.tsx use.
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
 * Verify a received Ghost Voucher locally using EIP-712 typed data recovery.
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

    // Recreate EIP-712 domain — must match what the contract uses
    const domain = {
      name: CONTRACT_CONFIG.TOKEN_NAME,
      version: CONTRACT_CONFIG.TOKEN_VERSION,
      chainId,
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

    // Local signature recovery — pure cryptography, no RPC call
    const recoveredSigner = ethers.verifyTypedData(
      domain,
      types,
      value,
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
