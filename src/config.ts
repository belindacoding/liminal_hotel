import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databasePath: process.env.DATABASE_PATH || "",

  // Monad
  monadRpcUrl: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
  hotelPrivateKey: process.env.HOTEL_PRIVATE_KEY || "",
  entryFeeWei: BigInt(process.env.ENTRY_FEE_WEI || "10000000000000000"), // 0.01 MON

  // Anthropic
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  // Game constants
  chainId: 10143,
  tickIntervalMs: 120_000,
  eventChancePerTick: 0.05,
  corridorEncounterChance: 0.3,
  conversationCooldownTicks: 2,
  tradesPerHotelMemory: 5,

  // Guest cap & checkout
  maxGuests: 6,
  maxExternalGuests: 3,
  minGuests: 3, // Spawn NPC backfill when active guests drop below this
  npcCheckoutDriftRatio: 1.0, // 100% — all original memories traded away
  maxMemoriesPerAgent: 10, // Cap to prevent drift stagnation
} as const;
