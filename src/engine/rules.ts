import { AgentRow, MemoryRow } from "../db/queries";

/** All valid action types */
export type ActionType = "move" | "trade" | "claim";

/** Action request from the API */
export interface ActionRequest {
  agent_id: string;
  action: ActionType;
  params: {
    target_room?: string;
    target_agent?: string;
    offer?: string[];
    request?: string[];
    memory_id?: string;
  };
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  cost: number;
}

// ─── Room Data ──────────────────────────────────────────

/** All valid room IDs */
export const VALID_ROOMS = [
  "lobby",
  "fireplace",
  "rooftop",
  "gallery",
  "wine_cellar",
  "room_313",
];

/** Calculate movement cost between two rooms (all movement is free) */
export function getMoveCost(_fromRoom: string, _toRoom: string): number {
  return 0;
}

// ─── Room-Based Action Restrictions ─────────────────────

/** Actions available per room — move, trade, and claim everywhere */
function getRoomActions(_roomId: string): ActionType[] {
  return ["move", "trade", "claim"];
}

// ─── Validation ─────────────────────────────────────────

/** Validate an action request against game rules */
export function validateAction(
  request: ActionRequest,
  agent: AgentRow,
  agentMemories: MemoryRow[]
): ValidationResult {
  const { action, params } = request;

  // Check agent is active
  if (!agent.is_active) {
    return { valid: false, error: "Agent is no longer active in the hotel.", cost: 0 };
  }

  // Check action is valid for current room
  const allowed = getRoomActions(agent.current_room);
  if (!allowed.includes(action)) {
    return {
      valid: false,
      error: `Cannot perform '${action}' in ${agent.current_room}. Available: ${allowed.join(", ")}.`,
      cost: 0,
    };
  }

  // Action-specific validation
  switch (action) {
    case "move":
      return validateMove(params, agent);
    case "trade":
      return validateTrade(params, agent, agentMemories);
    case "claim":
      return validateClaim(params);
    default:
      return { valid: false, error: `Unknown action: ${action}`, cost: 0 };
  }
}

function validateMove(
  params: ActionRequest["params"],
  agent: AgentRow
): ValidationResult {
  if (!params.target_room) {
    return { valid: false, error: "Move requires target_room.", cost: 0 };
  }
  if (!VALID_ROOMS.includes(params.target_room)) {
    return {
      valid: false,
      error: `Invalid room: ${params.target_room}. Valid rooms: ${VALID_ROOMS.join(", ")}.`,
      cost: 0,
    };
  }
  if (params.target_room === agent.current_room) {
    return { valid: false, error: "You are already there.", cost: 0 };
  }
  return { valid: true, cost: 0 };
}

function validateTrade(
  params: ActionRequest["params"],
  agent: AgentRow,
  agentMemories: MemoryRow[]
): ValidationResult {
  if (!params.target_agent) {
    return { valid: false, error: "Trade requires target_agent.", cost: 0 };
  }
  if (params.target_agent === agent.id) {
    return { valid: false, error: "You cannot trade with yourself.", cost: 0 };
  }
  // Validate offered memory IDs belong to this agent
  if (params.offer && params.offer.length > 0) {
    const ownedIds = new Set(agentMemories.map((m) => m.id));
    for (const mid of params.offer) {
      if (!ownedIds.has(mid)) {
        return { valid: false, error: `You do not own memory ${mid}.`, cost: 0 };
      }
    }
  }
  return { valid: true, cost: 0 };
}

function validateClaim(
  params: ActionRequest["params"]
): ValidationResult {
  if (!params.memory_id) {
    return { valid: false, error: "Claim requires memory_id.", cost: 0 };
  }
  return { valid: true, cost: 0 };
}

/** Get available actions for an agent in their current room */
export function getAvailableActions(agent: AgentRow, _memories: MemoryRow[]): ActionType[] {
  return getRoomActions(agent.current_room);
}
