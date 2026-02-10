import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CONFIG } from "../config";

/** Monad Testnet chain definition */
export const monadTestnet = defineChain({
  id: CONFIG.chainId,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [CONFIG.monadRpcUrl] },
  },
});

/** Public client for reading chain state (no private key needed) */
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

/** Create a wallet client for signing transactions (requires private key) */
export function createHotelWalletClient() {
  if (!CONFIG.hotelPrivateKey) {
    console.warn("[Monad] No HOTEL_PRIVATE_KEY set — wallet client unavailable");
    return null;
  }

  const account = privateKeyToAccount(CONFIG.hotelPrivateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(),
  });
}

/** Get the hotel wallet address from the private key */
export function getHotelAddress(): string | null {
  if (!CONFIG.hotelPrivateKey) return null;
  const account = privateKeyToAccount(CONFIG.hotelPrivateKey as `0x${string}`);
  return account.address;
}
