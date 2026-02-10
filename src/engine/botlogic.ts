import { CONFIG } from "../config";
import * as queries from "../db/queries";
import { AgentRow } from "../db/queries";
import { VALID_ROOMS } from "./rules";
import { processAction } from "./actions";

// ─── Bot Decision Logic ─────────────────────────────────
// Each tick, every NPC either moves or claims an echo.
// Trades happen exclusively through the conversation system.

export async function runBotTick(): Promise<void> {
  const agents = queries.getActiveAgents();
  if (agents.length === 0) return;

  // Shuffle to randomize who goes first
  const shuffled = [...agents].sort(() => Math.random() - 0.5);

  for (const agent of shuffled) {
    try {
      await decideBotAction(agent);
    } catch (err) {
      console.error(`[Bot] Error for ${agent.name}:`, (err as Error).message);
    }
  }
}

async function decideBotAction(agent: AgentRow): Promise<void> {
  // Check for unclaimed hotel memories — 30% chance to claim one (if under memory cap)
  const currentMems = queries.getAgentMemories(agent.id);
  const unclaimed = queries.getUnclaimedMemories();
  if (unclaimed.length > 0 && currentMems.length < CONFIG.maxMemoriesPerAgent && Math.random() < 0.3) {
    // Prefer happy/neutral echoes, but sometimes the hotel compels painful ones
    const desirable = unclaimed.filter((m) => m.sentiment !== "painful");
    const painful = unclaimed.filter((m) => m.sentiment === "painful");
    let target: typeof unclaimed[0] | null = null;
    if (desirable.length > 0) {
      target = desirable[Math.floor(Math.random() * desirable.length)];
    } else if (painful.length > 0 && Math.random() < 0.15) {
      // 15% chance to reluctantly claim a painful echo when nothing else is available
      target = painful[Math.floor(Math.random() * painful.length)];
    }
    if (target) {
      await processAction({
        agent_id: agent.id,
        action: "claim",
        params: { memory_id: target.id },
      });
      return;
    }
  }

  // Move — explore the hotel
  await moveToward(agent);
}

async function moveToward(agent: AgentRow): Promise<void> {
  const allAgents = queries.getActiveAgents().filter((a) => a.id !== agent.id);
  const roommates = allAgents.filter((a) => a.current_room === agent.current_room);

  let targetRoom: string;

  // If already with others, strongly prefer exploring somewhere new
  if (roommates.length > 0) {
    // 80% random room, 20% follow someone elsewhere
    if (Math.random() < 0.8) {
      const otherRooms = VALID_ROOMS.filter((r) => r !== agent.current_room);
      targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
    } else {
      const elsewhere = allAgents.filter((a) => a.current_room !== agent.current_room);
      if (elsewhere.length > 0) {
        targetRoom = elsewhere[Math.floor(Math.random() * elsewhere.length)].current_room;
      } else {
        const otherRooms = VALID_ROOMS.filter((r) => r !== agent.current_room);
        targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
      }
    }
  } else {
    // Alone — seek out another agent or explore
    if (allAgents.length > 0 && Math.random() < 0.5) {
      const targetAgent = allAgents[Math.floor(Math.random() * allAgents.length)];
      targetRoom = targetAgent.current_room;
    } else {
      const otherRooms = VALID_ROOMS.filter((r) => r !== agent.current_room);
      targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
    }
  }

  if (targetRoom === agent.current_room) return;

  await processAction({
    agent_id: agent.id,
    action: "move",
    params: { target_room: targetRoom },
  });
}
