/**
 * Bot Launcher — Enters all 3 bots into the hotel and runs them simultaneously.
 *
 * Usage: npx tsx scripts/run-bots.ts
 * (Server must be running: npm run dev)
 *
 * Options (env vars):
 *   API_URL   — Server URL (default: http://localhost:3000)
 *   INTERVAL  — Bot tick interval in ms (default: 4000)
 *   DURATION  — Total run time in seconds (default: 120)
 */

import { WandererBot } from "../src/bots/explorer";
import { BrokerBot } from "../src/bots/trader";
import { ArchitectBot } from "../src/bots/schemer";
import { sleep } from "../src/bots/base";

const API_URL = process.env.API_URL || "http://localhost:3000";
const INTERVAL = parseInt(process.env.INTERVAL || "4000", 10);
const DURATION = parseInt(process.env.DURATION || "120", 10);

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   The Liminal Hotel — Bot Launcher               ║");
  console.log("║   3 agents are about to check in...              ║");
  console.log(`║   API: ${API_URL.padEnd(41)}║`);
  console.log(`║   Interval: ${(INTERVAL + "ms").padEnd(36)}║`);
  console.log(`║   Duration: ${(DURATION + "s").padEnd(36)}║`);
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Verify server is running
  try {
    const res = await fetch(`${API_URL}/world/state`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const state = await res.json() as { hotel: { status: string } };
    console.log("[Launcher] Server is running.\n");

    // Auto-open hotel if closed
    if (state.hotel.status !== "open") {
      console.log("[Launcher] Hotel is closed — opening...\n");
      const openRes = await fetch(`${API_URL}/world/hotel/open`, { method: "POST" });
      const openData = await openRes.json() as { success: boolean; agents?: Array<{ name: string }> };
      if (!openData.success) {
        console.error("[Launcher] Failed to open hotel.");
        process.exit(1);
      }
      const npcNames = (openData.agents || []).map(a => a.name).join(", ");
      console.log(`[Launcher] Hotel opened with NPCs: ${npcNames}\n`);
    }
  } catch {
    console.error("[Launcher] Cannot connect to server. Start it first: npm run dev");
    process.exit(1);
  }

  // Create bots with staggered intervals to avoid simultaneous API hits
  const wanderer = new WandererBot("Lucia Varga", API_URL, INTERVAL);
  const broker = new BrokerBot("Jin Tanaka", API_URL, INTERVAL + 500);
  const architect = new ArchitectBot("Oren Kissi", API_URL, INTERVAL + 1000);

  // Enter all 3 bots
  console.log("─── Entering the Hotel ──────────────────────────\n");

  const entered = await Promise.all([
    wanderer.enter(),
    broker.enter(),
    architect.enter(),
  ]);

  if (entered.some((e) => !e)) {
    console.error("\n[Launcher] Some bots failed to enter. Aborting.");
    process.exit(1);
  }

  console.log(`\n─── Bots Running (${DURATION}s) ──────────────────────────\n`);

  // Start all bots (non-blocking — they run in parallel)
  const botPromises = [
    wanderer.start(),
    broker.start(),
    architect.start(),
  ];

  // Set up shutdown timer
  const shutdownTimer = setTimeout(async () => {
    console.log("\n─── Time's Up ──────────────────────────────────\n");

    wanderer.stop();
    broker.stop();
    architect.stop();

    // Wait a moment for final ticks to complete
    await sleep(2000);

    // Print final state
    await printSummary(API_URL, [wanderer.agentId, broker.agentId, architect.agentId]);

    process.exit(0);
  }, DURATION * 1000);

  // Handle graceful shutdown on Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\n\n─── Interrupted ────────────────────────────────\n");
    clearTimeout(shutdownTimer);

    wanderer.stop();
    broker.stop();
    architect.stop();

    await sleep(2000);
    await printSummary(API_URL, [wanderer.agentId, broker.agentId, architect.agentId]);

    process.exit(0);
  });

  // Wait for all bots to stop
  await Promise.all(botPromises);
}

async function printSummary(apiUrl: string, agentIds: string[]) {
  console.log("═══════════════════════════════════════════════════");
  console.log("  SESSION SUMMARY");
  console.log("═══════════════════════════════════════════════════\n");

  for (const id of agentIds) {
    try {
      const res = await fetch(`${apiUrl}/world/agent/${id}`);
      const agent = await res.json() as Record<string, unknown>;
      const memRes = await fetch(`${apiUrl}/world/agent/${id}/memories`);
      const mems = await memRes.json() as Array<Record<string, unknown>>;
      const score = (mems as Array<{point_value: number}>).reduce((sum, m) => sum + m.point_value, 0);
      console.log(`  ${agent.name}`);
      console.log(`    Room: ${agent.current_room} (${agent.current_floor})`);
      console.log(`    Drift Level: ${agent.drift_level}`);
      console.log(`    Memories: ${mems.length} (Score: ${score})`);
      console.log(`    Memories Held Ever: ${agent.total_memories_ever_held}`);
      console.log(`    Memories Traded: ${agent.total_memories_traded_away}`);
      console.log();
    } catch {
      console.log(`  Agent ${id}: (unable to fetch state)`);
    }
  }

  // Hotel state
  try {
    const res = await fetch(`${apiUrl}/world/state`);
    const world = await res.json() as Record<string, unknown>;
    const hotel = world.hotel as Record<string, unknown>;
    console.log(`  Hotel Mood: ${hotel.mood}`);
    console.log(`  Total Guests Ever: ${hotel.total_guests}`);
    console.log(`  Active Guests: ${hotel.active_guests}`);
  } catch {
    console.log("  Hotel state: (unable to fetch)");
  }

  // Leaderboard
  try {
    const res = await fetch(`${apiUrl}/world/leaderboard`);
    const board = await res.json() as Array<Record<string, unknown>>;
    console.log("\n  LEADERBOARD:");
    for (let i = 0; i < board.length; i++) {
      const entry = board[i];
      console.log(
        `    ${i + 1}. ${entry.agent_name} — score:${entry.score} mem:${entry.memory_count}`
      );
    }
  } catch {
    console.log("  Leaderboard: (unable to fetch)");
  }

  console.log("\n═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[Launcher] Fatal error:", err);
  process.exit(1);
});
