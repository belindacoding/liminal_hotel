import * as queries from "../db/queries";
import { AgentRow, MemoryRow } from "../db/queries";
import { VALID_ROOMS } from "./rules";
import { processAction } from "./actions";

// ─── Bot Decision Logic ─────────────────────────────────
// Each tick, every agent either moves or trades.
// Priority: if someone else is in the room, try to trade. Otherwise move.

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
  // Check for unclaimed hotel memories — 30% chance to claim one
  const unclaimed = queries.getUnclaimedMemories();
  if (unclaimed.length > 0 && Math.random() < 0.3) {
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

  const otherAgents = queries.getAgentsInRoom(agent.current_room)
    .filter((a) => a.id !== agent.id);

  if (otherAgents.length > 0 && Math.random() > 0.4) {
    // 60% chance to trade when co-located, 40% chance to wander
    const target = otherAgents[Math.floor(Math.random() * otherAgents.length)];
    await attemptTrade(agent, target);
  } else {
    // Move toward a room with other agents, or a random room
    await moveToward(agent);
  }
}

async function attemptTrade(agent: AgentRow, target: AgentRow): Promise<void> {
  const myMemories = queries.getAgentMemories(agent.id);
  const targetMemories = queries.getAgentMemories(target.id);

  if (myMemories.length === 0 || targetMemories.length === 0) {
    // Can't trade if either has no memories — move instead
    await moveToward(agent);
    return;
  }

  // Strategy: offer a painful memory, request a happy one
  const myPainful = myMemories.filter((m) => m.sentiment === "painful");
  const targetHappy = targetMemories.filter((m) => m.sentiment === "happy");

  let offerMem: MemoryRow;
  let requestMem: MemoryRow;

  if (myPainful.length > 0 && targetHappy.length > 0) {
    // Ideal trade: give painful, get happy
    offerMem = myPainful[Math.floor(Math.random() * myPainful.length)];
    requestMem = targetHappy[Math.floor(Math.random() * targetHappy.length)];
  } else if (myPainful.length > 0) {
    // Have painful to offload, take anything
    offerMem = myPainful[Math.floor(Math.random() * myPainful.length)];
    requestMem = targetMemories[Math.floor(Math.random() * targetMemories.length)];
  } else {
    // Random swap — sometimes you just trade for variety
    offerMem = myMemories[Math.floor(Math.random() * myMemories.length)];
    requestMem = targetMemories[Math.floor(Math.random() * targetMemories.length)];
  }

  // 30% chance to skip trading (not every encounter leads to a deal)
  if (Math.random() < 0.3) {
    return;
  }

  await processAction({
    agent_id: agent.id,
    action: "trade",
    params: {
      target_agent: target.id,
      offer: [offerMem.id],
      request: [requestMem.id],
    },
  });
}

async function moveToward(agent: AgentRow): Promise<void> {
  const allAgents = queries.getActiveAgents().filter((a) => a.id !== agent.id);

  let targetRoom: string;

  if (allAgents.length > 0 && Math.random() < 0.7) {
    // Move toward another agent
    const targetAgent = allAgents[Math.floor(Math.random() * allAgents.length)];
    targetRoom = targetAgent.current_room;
  } else {
    // Move to a random room
    const otherRooms = VALID_ROOMS.filter((r) => r !== agent.current_room);
    targetRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
  }

  if (targetRoom === agent.current_room) return;

  await processAction({
    agent_id: agent.id,
    action: "move",
    params: { target_room: targetRoom },
  });
}
