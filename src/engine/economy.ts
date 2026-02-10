// ─── Types ───────────────────────────────────────────────

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type Sentiment = "painful" | "happy" | "neutral";

export interface GeneratedMemory {
  id: string;
  rarity: Rarity;
  name: string;
  description: string;
  point_value: number;
  sentiment: Sentiment;
}

// ─── Point Values ────────────────────────────────────────

export const POINT_VALUES: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  legendary: 8,
};

// ─── Identity Drift ──────────────────────────────────────

/** Calculate drift level from memory trade ratios */
export function calculateDriftLevel(
  totalEverHeld: number,
  totalTradedAway: number
): number {
  if (totalEverHeld === 0) return 0;
  const ratio = totalTradedAway / totalEverHeld;
  if (ratio > 0.85) return 3;
  if (ratio > 0.70) return 2;
  if (ratio > 0.50) return 1;
  return 0;
}
