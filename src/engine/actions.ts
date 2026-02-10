import { CONFIG } from "../config";
import * as queries from "../db/queries";
import { AgentRow, MemoryRow } from "../db/queries";
import { ActionRequest, ActionType, validateAction, getAvailableActions } from "./rules";
import {
  calculateDriftLevel,
  GeneratedMemory,
} from "./economy";
import { generateNarrative, NarrativeContext } from "./narrative";
import { onTradeCompleted } from "./hotelmemory";

// ─── Action Response ─────────────────────────────────────

export interface ActionResponse {
  success: boolean;
  action: string;
  error?: string;
  state_changes: {
    agent: Partial<AgentRow> & { id: string };
    world_effects?: string[];
    new_memories?: Array<{
      id: string;
      rarity: string;
      name: string;
      point_value: number;
    }>;
    lost_memories?: string[];
    identity_drift?: {
      drift_level: number;
      drift_ratio: number;
      message: string;
    };
  };
  narrative: string;
  available_actions: ActionType[];
  timestamp: number;
}

// ─── Main Action Processor ───────────────────────────────

/** Process an action request end-to-end */
export async function processAction(request: ActionRequest): Promise<ActionResponse> {
  // Load agent
  const agent = queries.getAgent(request.agent_id);
  if (!agent) {
    return errorResponse(request.action, "Agent not found.");
  }

  const memories = queries.getAgentMemories(agent.id);

  // Validate
  const validation = validateAction(request, agent, memories);
  if (!validation.valid) {
    return errorResponse(request.action, validation.error!);
  }

  // Dispatch to handler
  let result: HandlerResult;
  switch (request.action) {
    case "move":
      result = handleMove(agent, request.params);
      break;
    case "trade":
      result = handleTrade(agent, memories, request.params);
      break;
    case "claim":
      result = handleClaim(agent, request.params);
      break;
    default:
      return errorResponse(request.action, "Unknown action.");
  }

  // Check for handler-level errors
  if (result.error) {
    return errorResponse(request.action, result.error);
  }

  // Refresh agent state after mutations
  const updatedAgent = queries.getAgent(agent.id)!;
  const updatedMemories = queries.getAgentMemories(agent.id);

  // Generate narrative
  const narrativeCtx: NarrativeContext = {
    action: request.action,
    agent: updatedAgent,
    location: updatedAgent.current_room,
    outcome: result.outcome,
  };
  const narrative = await generateNarrative(narrativeCtx);

  // Log action
  queries.logAction({
    agent_id: agent.id,
    action: request.action,
    params: JSON.stringify(request.params),
    outcome: JSON.stringify(result.outcome),
    narrative,
  });

  return {
    success: true,
    action: request.action,
    state_changes: {
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        current_room: updatedAgent.current_room,
        current_floor: updatedAgent.current_floor,
        drift_level: updatedAgent.drift_level,
      },
      world_effects: result.worldEffects.length > 0 ? result.worldEffects : undefined,
      new_memories: result.newMemories.length > 0
        ? result.newMemories.map((m) => ({
            id: m.id,
            rarity: m.rarity,
            name: m.name,
            point_value: m.point_value,
          }))
        : undefined,
      lost_memories: result.lostMemories.length > 0 ? result.lostMemories : undefined,
      identity_drift: result.driftChange
        ? {
            drift_level: result.driftChange.level,
            drift_ratio: result.driftChange.ratio,
            message: result.driftChange.message,
          }
        : undefined,
    },
    narrative,
    available_actions: getAvailableActions(updatedAgent, updatedMemories),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// ─── Internal Types ──────────────────────────────────────

interface HandlerResult {
  outcome: Record<string, unknown>;
  worldEffects: string[];
  newMemories: GeneratedMemory[];
  lostMemories: string[];
  driftChange?: { level: number; ratio: number; message: string };
  error?: string;
}

function emptyResult(): HandlerResult {
  return {
    outcome: {},
    worldEffects: [],
    newMemories: [],
    lostMemories: [],
  };
}

// ─── Handlers ────────────────────────────────────────────

function handleMove(agent: AgentRow, params: ActionRequest["params"]): HandlerResult {
  const result = emptyResult();
  const targetRoom = params.target_room!;

  queries.updateAgentRoom(agent.id, targetRoom, "");

  result.outcome = {
    moved_to: targetRoom,
  };
  return result;
}

function handleTrade(
  agent: AgentRow,
  memories: MemoryRow[],
  params: ActionRequest["params"]
): HandlerResult {
  const result = emptyResult();
  const target = queries.getAgent(params.target_agent!);

  if (!target) {
    result.error = "Target agent not found.";
    return result;
  }

  // Require same room
  if (target.current_room !== agent.current_room) {
    result.error = "Target agent is not in the same room.";
    return result;
  }

  const targetMemories = queries.getAgentMemories(target.id);
  const offeredIds = params.offer || [];
  const requestedIds = params.request || [];

  // Require at least something to be exchanged
  if (offeredIds.length === 0 && requestedIds.length === 0) {
    result.error = "Nothing to trade. Offer or request memories.";
    return result;
  }

  // Validate requested memories belong to target
  const targetOwnedIds = new Set(targetMemories.map((m) => m.id));
  for (const mid of requestedIds) {
    if (!targetOwnedIds.has(mid)) {
      result.error = `Target does not own memory ${mid}.`;
      return result;
    }
  }

  // Execute trade: transfer offered memories to target
  for (const mid of offeredIds) {
    queries.transferMemory(mid, target.id);
  }

  // Transfer requested memories to agent
  for (const mid of requestedIds) {
    queries.transferMemory(mid, agent.id);
  }

  // Update drift tracking for both agents
  const agentGained = requestedIds.length;
  const agentLost = offeredIds.length;
  const agentEverHeld = agent.total_memories_ever_held + agentGained;
  const agentTradedAway = agent.total_memories_traded_away + agentLost;
  const agentDrift = calculateDriftLevel(agentEverHeld, agentTradedAway);
  const agentEchoes: string[] = JSON.parse(agent.echo_sources);
  if (agentGained > 0 && !agentEchoes.includes(target.id)) {
    agentEchoes.push(target.id);
  }
  queries.updateDrift(agent.id, agentEverHeld, agentTradedAway, agentDrift, agentEchoes);

  const targetGained = offeredIds.length;
  const targetLost = requestedIds.length;
  const targetEverHeld = target.total_memories_ever_held + targetGained;
  const targetTradedAway = target.total_memories_traded_away + targetLost;
  const targetDrift = calculateDriftLevel(targetEverHeld, targetTradedAway);
  const targetEchoes: string[] = JSON.parse(target.echo_sources);
  if (targetGained > 0 && !targetEchoes.includes(agent.id)) {
    targetEchoes.push(agent.id);
  }
  queries.updateDrift(target.id, targetEverHeld, targetTradedAway, targetDrift, targetEchoes);

  // Check for drift level changes
  if (agentDrift > agent.drift_level) {
    const driftMessages = [
      "",
      "Something feels different. A memory that isn't yours surfaces briefly.",
      "You're becoming someone else. The hotel notices.",
      "You are more hotel than guest now.",
    ];
    result.driftChange = {
      level: agentDrift,
      ratio: agentEverHeld > 0 ? agentTradedAway / agentEverHeld : 0,
      message: driftMessages[agentDrift] || "Something shifts inside you.",
    };
  }

  // Record trade
  queries.insertTrade({
    seller_id: agent.id,
    buyer_id: target.id,
    offered_memories: JSON.stringify(offeredIds),
    requested_memories: JSON.stringify(requestedIds),
    status: "completed",
  });

  // Notify hotel memory system
  onTradeCompleted();

  result.outcome = {
    offered: offeredIds,
    received: requestedIds,
  };
  result.worldEffects.push("A trade was completed.");

  return result;
}

function handleClaim(
  agent: AgentRow,
  params: ActionRequest["params"]
): HandlerResult {
  const result = emptyResult();
  const memoryId = params.memory_id!;

  // Verify memory exists and is unclaimed
  const memory = queries.getMemory(memoryId);
  if (!memory) {
    result.error = "Memory not found.";
    return result;
  }
  if (memory.owner_id !== null) {
    result.error = "Memory has already been claimed.";
    return result;
  }

  // Atomic claim
  const claimed = queries.claimMemory(memoryId, agent.id);
  if (!claimed) {
    result.error = "Failed to claim — someone got there first.";
    return result;
  }

  // Update drift (gained 1 from "hotel")
  const everHeld = agent.total_memories_ever_held + 1;
  const drift = calculateDriftLevel(everHeld, agent.total_memories_traded_away);
  const echoes: string[] = JSON.parse(agent.echo_sources);
  if (!echoes.includes("hotel")) {
    echoes.push("hotel");
  }
  queries.updateDrift(agent.id, everHeld, agent.total_memories_traded_away, drift, echoes);

  // Log as world event
  queries.insertWorldEvent({
    type: "claim",
    triggered_by: agent.id,
    description: `${agent.name} claimed "${memory.name}" (${memory.rarity}) from the hotel's echoes.`,
    effects: JSON.stringify({ memory_id: memoryId, rarity: memory.rarity }),
  });

  result.outcome = { claimed_memory: memoryId, name: memory.name, rarity: memory.rarity };
  result.newMemories.push({
    id: memory.id,
    rarity: memory.rarity as "common" | "uncommon" | "rare" | "legendary",
    name: memory.name,
    description: memory.description,
    point_value: memory.point_value,
    sentiment: memory.sentiment as "painful" | "happy" | "neutral",
  });
  result.worldEffects.push(`${agent.name} claimed an echo from the hotel.`);

  return result;
}

// ─── Helpers ─────────────────────────────────────────────

function errorResponse(action: string, error: string): ActionResponse {
  return {
    success: false,
    action,
    error,
    state_changes: { agent: { id: "" } },
    narrative: "",
    available_actions: [],
    timestamp: Math.floor(Date.now() / 1000),
  };
}
