import { CONFIG } from "../config";
import * as queries from "../db/queries";
import { processConversations } from "./conversation";
import { runBotTick } from "./botlogic";
import { generateSingleAgent, toDbMemory } from "./generator";
import { generateAgentId } from "../api/entry";

let tickInterval: NodeJS.Timeout | null = null;

/** Run one world tick — called every CONFIG.tickIntervalMs */
export async function worldTick(): Promise<void> {
  const hotel = queries.getHotelState();

  // Only tick when hotel is open
  if (hotel.status !== "open") return;

  const newTick = hotel.current_tick + 1;
  console.log(`[World] Tick ${newTick}`);

  // Run bot decisions (move/trade)
  try {
    await runBotTick();
  } catch (err) {
    console.error("[World] Bot tick error:", (err as Error).message);
  }

  // Process conversations between collocated agents
  try {
    const conversations = await processConversations(newTick);
    if (conversations.length > 0) {
      console.log(`[World] Tick ${newTick}: ${conversations.length} conversation(s) occurred`);
    }
  } catch (err) {
    console.error("[World] Conversation processing error:", (err as Error).message);
  }

  // Check for NPC drift checkouts
  try {
    await checkDriftCheckouts();
  } catch (err) {
    console.error("[World] Drift checkout error:", (err as Error).message);
  }

  // Update tick
  queries.updateHotelState({ current_tick: newTick });

  // Update hotel mood based on activity
  updateMood(newTick);
}

/** Check active NPCs for 100% drift and replace them */
async function checkDriftCheckouts(): Promise<void> {
  const npcs = queries.getActiveNPCs();

  for (const npc of npcs) {
    // Check if NPC has lost all their original memories
    const originalRemaining = queries.countOriginalMemoriesRemaining(npc.id);

    if (originalRemaining === 0) {
      // Log departure
      queries.insertWorldEvent({
        type: "npc_checkout",
        triggered_by: npc.id,
        description: `${npc.name} has traded away all their original memories. They no longer remember who they were — and drift out of the hotel like smoke.`,
        effects: JSON.stringify({ agent_id: npc.id, original_remaining: 0 }),
      });

      // Deactivate
      queries.deactivateAgent(npc.id);

      // Only spawn replacement if NPCs are below minimum (3)
      const activeNpcCount = queries.getActiveNPCs().length;
      if (activeNpcCount >= CONFIG.minGuests) {
        console.log(`[World] NPC "${npc.name}" checked out (0 original memories remain), no replacement needed (${activeNpcCount} NPCs remain)`);
        continue;
      }

      // Generate replacement NPC
      const generated = await generateSingleAgent("New Guest");
      const newId = generateAgentId();

      queries.insertAgent({
        id: newId,
        name: generated.name,
        entry_tx_hash: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        wallet_address: "0x0000000000000000000000000000000000000000",
        trait_1: generated.personality.split(",")[0]?.trim() || "quiet",
        trait_2: generated.personality.split(",")[1]?.trim() || "thoughtful",
        trait_3: generated.personality.split(",")[2]?.trim() || "searching",
        origin_story: generated.backstory,
        backstory: generated.backstory,
        personality: generated.personality,
      });

      // Insert memories for the new NPC
      for (const mem of generated.memories) {
        const dbMem = toDbMemory(mem, newId);
        queries.insertMemory(dbMem);
      }

      // Initialize drift tracking
      queries.updateDrift(newId, generated.memories.length, 0, 0, []);
      queries.updateHotelState({ total_guests_ever: (queries.getHotelState().total_guests_ever || 0) + 1 });

      // Log entry of new NPC
      queries.insertWorldEvent({
        type: "npc_entry",
        triggered_by: newId,
        description: `${generated.name} pushes through the revolving door, drawn by something they can't name. A new guest arrives to fill the void.`,
        effects: JSON.stringify({ agent_id: newId }),
      });

      console.log(`[World] NPC "${npc.name}" checked out (0 original memories remain), replaced by "${generated.name}"`);
    }
  }
}

/** Close the hotel — set status to finished, stop tick loop */
export async function closeHotel(): Promise<void> {
  queries.updateHotelState({ status: "finished" });
  stopWorldTick();

  queries.insertWorldEvent({
    type: "hotel_close",
    triggered_by: null,
    description: "The Liminal Hotel closes its doors. The guests are transformed.",
    effects: null,
  });

  console.log("[World] Hotel closed");
}

/** Update hotel mood based on recent activity */
function updateMood(tick: number): void {
  const agents = queries.getActiveAgents();
  const recentConvos = queries.getRecentConversations(5);

  let mood = "neutral";
  if (agents.length === 0) {
    mood = "quiet";
  } else if (recentConvos.length >= 3) {
    mood = "lively";
  } else if (agents.some((a) => a.drift_level >= 2)) {
    mood = "chaotic";
  } else if (agents.length >= 2) {
    mood = "neutral";
  }

  queries.updateHotelState({ mood });
}

/** Start the world tick loop */
export function startWorldTick(): void {
  if (tickInterval) return; // Already running
  console.log(`[World] Tick loop started (interval: ${CONFIG.tickIntervalMs}ms)`);
  tickInterval = setInterval(() => {
    worldTick().catch((err) => console.error("[World] Tick error:", err));
  }, CONFIG.tickIntervalMs);
}

/** Stop the world tick loop */
export function stopWorldTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
    console.log("[World] Tick loop stopped");
  }
}
