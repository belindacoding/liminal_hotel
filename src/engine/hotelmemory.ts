import { CONFIG } from "../config";
import * as queries from "../db/queries";
import { MemoryRow } from "../db/queries";
import { Rarity, Sentiment, POINT_VALUES } from "./economy";

// ─── Echo Name Templates ────────────────────────────────

const ECHO_NAMES: Record<Sentiment, string[]> = {
  painful: [
    "Echo of weeping in the wine cellar",
    "Residue of a goodbye no one heard",
    "The weight someone left behind",
    "A scream that the walls absorbed",
    "Afterimage of a door closing forever",
  ],
  happy: [
    "Echo of laughter in the lobby",
    "Residue of a first dance, half-remembered",
    "The warmth someone forgot to take",
    "A smile the fireplace kept",
    "Afterglow of a reunion at the rooftop",
  ],
  neutral: [
    "Echo of footsteps going nowhere",
    "Residue of a conversation lost mid-sentence",
    "Something the gallery mirrors reflected back",
    "A thought that got stuck between floors",
    "The pause between one guest leaving and another arriving",
  ],
};

const ECHO_DESCRIPTIONS: Record<Sentiment, string[]> = {
  painful: [
    "Born from the emotional residue of recent painful exchanges. It hums with sorrow.",
    "The hotel absorbed too much grief. This is what condensed.",
    "When enough pain changes hands, the walls start to weep. This is a tear.",
  ],
  happy: [
    "Born from the emotional residue of recent joyful exchanges. It glows faintly.",
    "The hotel absorbed too much joy. This is what crystallized.",
    "When enough happiness circulates, the hotel produces something worth keeping.",
  ],
  neutral: [
    "Born from the emotional residue of recent exchanges. It feels... ambiguous.",
    "The hotel watched the trades and produced this. Neither happy nor sad — just real.",
    "A memory that belongs to no one and everyone. The hotel's own.",
  ],
};

// ─── Sentiment Detection ────────────────────────────────

/** Look at recently traded memories, return majority sentiment */
export function determineSentiment(): Sentiment {
  const recentTrades = queries.getRecentTradesForSentiment(10);

  // Collect all memory IDs from recent trades
  const memoryIds: string[] = [];
  for (const trade of recentTrades) {
    const offered: string[] = JSON.parse(trade.offered_memories);
    const requested: string[] = JSON.parse(trade.requested_memories);
    memoryIds.push(...offered, ...requested);
  }

  // Look up sentiments
  let painful = 0;
  let happy = 0;
  for (const id of memoryIds) {
    const mem = queries.getMemory(id);
    if (!mem) continue;
    if (mem.sentiment === "painful") painful++;
    else if (mem.sentiment === "happy") happy++;
  }

  if (painful > happy) return "painful";
  if (happy > painful) return "happy";
  return "neutral";
}

// ─── Rarity Picker ──────────────────────────────────────

/** 50% common, 30% uncommon, 15% rare, 5% legendary */
export function pickRarity(): Rarity {
  const roll = Math.random();
  if (roll < 0.05) return "legendary";
  if (roll < 0.20) return "rare";
  if (roll < 0.50) return "uncommon";
  return "common";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Produce Hotel Memory ───────────────────────────────

/** Create an unclaimed "echo" memory and log a world event */
export function produceHotelMemory(): MemoryRow {
  const sentiment = determineSentiment();
  const rarity = pickRarity();
  const name = pick(ECHO_NAMES[sentiment]);
  const description = pick(ECHO_DESCRIPTIONS[sentiment]);
  const pointValue = POINT_VALUES[rarity];

  const id = `echo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  queries.insertHotelMemory({
    id,
    rarity,
    name,
    description,
    point_value: pointValue,
    sentiment,
  });

  queries.insertWorldEvent({
    type: "hotel_echo",
    triggered_by: null,
    description: `The hotel produces a new memory: "${name}" (${rarity}). It waits to be claimed.`,
    effects: JSON.stringify({ memory_id: id, rarity, sentiment }),
  });

  console.log(`[Hotel] Echo produced: "${name}" (${rarity}, ${sentiment})`);

  return queries.getMemory(id)!;
}

// ─── Trade Hook ─────────────────────────────────────────

/** Called after every completed trade. Increments total_trades, produces memory every N trades. */
export function onTradeCompleted(): void {
  const hotel = queries.getHotelState();
  const newTotal = hotel.total_trades + 1;
  queries.updateHotelState({ total_trades: newTotal });

  if (newTotal % CONFIG.tradesPerHotelMemory === 0) {
    // Cap unclaimed echoes to prevent accumulation
    const unclaimed = queries.getUnclaimedMemories();
    if (unclaimed.length >= CONFIG.maxUnclaimedEchoes) {
      console.log(`[Hotel] Skipping echo production — ${unclaimed.length} unclaimed already`);
      return;
    }
    produceHotelMemory();
  }
}
