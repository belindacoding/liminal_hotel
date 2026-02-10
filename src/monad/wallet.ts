import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { formatEther } from "viem";
import { publicClient } from "./client";

/** Generate a new random wallet (for bots or testing) */
export function generateWallet(): { privateKey: string; address: string } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

/** Check the MON balance of an address */
export async function getBalance(address: string): Promise<{
  wei: bigint;
  display: string;
}> {
  const balance = await publicClient.getBalance({
    address: address as `0x${string}`,
  });
  return {
    wei: balance,
    display: `${formatEther(balance)} MON`,
  };
}
