import { publicClient, getHotelAddress } from "./client";
import { CONFIG } from "../config";

/** Result of transaction verification */
export interface VerifyResult {
  valid: boolean;
  error?: string;
  senderAddress?: string;
  amount?: bigint;
}

/**
 * Verify that a transaction is a valid entry payment.
 * Checks:
 *   1. Transaction exists and was successful
 *   2. Recipient is the hotel wallet
 *   3. Amount >= entry fee
 *
 * Includes retry logic (3 attempts with exponential backoff) for RPC calls.
 */
export async function verifyEntryPayment(txHash: string): Promise<VerifyResult> {
  const hotelAddress = getHotelAddress();
  if (!hotelAddress) {
    return { valid: false, error: "Hotel wallet not configured" };
  }

  const hash = txHash as `0x${string}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const [receipt, tx] = await Promise.all([
        publicClient.getTransactionReceipt({ hash }),
        publicClient.getTransaction({ hash }),
      ]);

      // Check tx was successful
      if (receipt.status !== "success") {
        return { valid: false, error: "Transaction failed on-chain" };
      }

      // Check recipient is hotel wallet
      if (!tx.to || tx.to.toLowerCase() !== hotelAddress.toLowerCase()) {
        return {
          valid: false,
          error: `Transaction recipient (${tx.to}) does not match hotel wallet (${hotelAddress})`,
        };
      }

      // Check amount
      if (tx.value < CONFIG.entryFeeWei) {
        return {
          valid: false,
          error: `Insufficient payment: sent ${tx.value}, need ${CONFIG.entryFeeWei}`,
        };
      }

      return {
        valid: true,
        senderAddress: tx.from,
        amount: tx.value,
      };
    } catch (err) {
      const message = (err as Error).message;

      // If tx not found, no point retrying
      if (message.includes("could not be found") || message.includes("not found")) {
        return { valid: false, error: "Transaction not found on-chain" };
      }

      // Retry on RPC errors
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(`[Gate] RPC attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return { valid: false, error: `RPC error after 3 attempts: ${message}` };
    }
  }

  return { valid: false, error: "Verification failed unexpectedly" };
}

/**
 * Dev mode: skip on-chain verification.
 * Used when HOTEL_PRIVATE_KEY is not set (local development).
 */
export function isDevMode(): boolean {
  return !CONFIG.hotelPrivateKey;
}
