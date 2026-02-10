/**
 * Base Bot — API client, loop management, and abstract decision-making.
 *
 * Subclasses implement `decide()` to return the next action.
 */

// ─── API Types ──────────────────────────────────────────

export interface AgentState {
  id: string;
  name: string;
  current_room: string;
  current_floor: string;
  trait_1: string;
  trait_2: string;
  trait_3: string;
  drift_level: number;
  echo_sources: string;
  total_memories_ever_held: number;
  total_memories_traded_away: number;
  is_active: number;
}

export interface MemoryInfo {
  id: string;
  owner_id: string;
  rarity: string;
  name: string;
  description: string;
  point_value: number;
}

export interface RoomInfo {
  name: string;
  room_type: string;
  agents: string[];
}

export interface WorldState {
  hotel: {
    tick: number;
    total_guests: number;
    active_guests: number;
    mood: string;
    status: string;
    total_trades: number;
  };
  unclaimed_memories: Array<{
    id: string;
    name: string;
    rarity: string;
    sentiment: string;
    point_value: number;
  }>;
  rooms: Record<string, RoomInfo>;
  recent_events: Array<{ type: string; description: string; tick: number }>;
  leaderboard: Array<{
    agent: string;
    agent_id: string;
    memories: number;
    score: number;
    drift_level: number;
  }>;
}

export interface ActionResult {
  success: boolean;
  action: string;
  error?: string;
  state_changes: {
    agent: Partial<AgentState> & { id: string };
    world_effects?: string[];
    new_memories?: Array<{ id: string; rarity: string; name: string; point_value: number }>;
    lost_memories?: string[];
    identity_drift?: { drift_level: number; drift_ratio: number; message: string };
  };
  narrative: string;
  available_actions: string[];
  timestamp: number;
}

export interface BotAction {
  action: string;
  params: Record<string, unknown>;
}

// ─── API Client ─────────────────────────────────────────

export class HotelAPI {
  constructor(private baseUrl: string) {}

  async getWorldState(): Promise<WorldState> {
    const res = await fetch(`${this.baseUrl}/world/state`);
    return res.json() as Promise<WorldState>;
  }

  async getAgentState(agentId: string): Promise<AgentState> {
    const res = await fetch(`${this.baseUrl}/world/agent/${agentId}`);
    return res.json() as Promise<AgentState>;
  }

  async getAgentMemories(agentId: string): Promise<MemoryInfo[]> {
    const res = await fetch(`${this.baseUrl}/world/agent/${agentId}/memories`);
    return res.json() as Promise<MemoryInfo[]>;
  }

  async getTargetMemories(agentId: string): Promise<MemoryInfo[]> {
    try {
      return await this.getAgentMemories(agentId);
    } catch {
      return [];
    }
  }

  async submitAction(agentId: string, action: BotAction): Promise<ActionResult> {
    const res = await fetch(`${this.baseUrl}/world/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        action: action.action,
        params: action.params,
      }),
    });
    return res.json() as Promise<ActionResult>;
  }

  async enter(name: string, txHash: string, walletAddress: string): Promise<{
    success: boolean;
    agent_id?: string;
    error?: string;
    narrative?: string;
    core_identity?: { traits: string[]; origin_story: string };
    starting_memories?: Array<{ id: string; rarity: string; name: string; point_value: number }>;
  }> {
    const res = await fetch(`${this.baseUrl}/world/enter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_hash: txHash,
        agent_name: name,
        wallet_address: walletAddress,
      }),
    });
    return res.json() as Promise<{
      success: boolean;
      agent_id?: string;
      error?: string;
      narrative?: string;
      core_identity?: { traits: string[]; origin_story: string };
      starting_memories?: Array<{ id: string; rarity: string; name: string; point_value: number }>;
    }>;
  }
}

// ─── Base Bot ───────────────────────────────────────────

export abstract class BaseBot {
  readonly name: string;
  agentId: string = "";
  protected api: HotelAPI;
  protected memories: MemoryInfo[] = [];
  protected running = false;
  private intervalMs: number;

  constructor(name: string, apiUrl: string, intervalMs = 5000) {
    this.name = name;
    this.api = new HotelAPI(apiUrl);
    this.intervalMs = intervalMs;
  }

  /** Enter the hotel */
  async enter(): Promise<boolean> {
    const txHash = `bot_tx_${this.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    const wallet = `0xbot_${this.name.toLowerCase().replace(/\s+/g, "_")}`;

    const result = await this.api.enter(this.name, txHash, wallet);
    if (result.success && result.agent_id) {
      this.agentId = result.agent_id;
      this.log(`Checked in. ${result.narrative || ""}`);
      if (result.core_identity) {
        this.log(`Traits: ${result.core_identity.traits.join(", ")}`);
      }
      if (result.starting_memories) {
        this.log(`Starting memories: ${result.starting_memories.map(m => `${m.name} (${m.rarity})`).join(", ")}`);
      }
      return true;
    }

    this.log(`Entry failed: ${result.error}`);
    return false;
  }

  /** Start the bot loop */
  async start(): Promise<void> {
    if (!this.agentId) {
      this.log("Cannot start — not entered yet.");
      return;
    }

    this.running = true;
    this.log("Starting decision loop...");

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        this.log(`Error: ${(err as Error).message}`);
      }
      await sleep(this.intervalMs);
    }
  }

  /** Stop the bot loop */
  stop(): void {
    this.running = false;
    this.log("Stopping...");
  }

  /** Run one decision cycle */
  private async tick(): Promise<void> {
    let worldState: WorldState;
    let agentState: AgentState;
    let serverMemories: MemoryInfo[];
    try {
      [worldState, agentState, serverMemories] = await Promise.all([
        this.api.getWorldState(),
        this.api.getAgentState(this.agentId),
        this.api.getAgentMemories(this.agentId),
      ]);
    } catch (err) {
      this.log(`API error (will retry): ${(err as Error).message}`);
      return;
    }

    if (!agentState || !agentState.id) {
      this.log("Could not fetch agent state (will retry).");
      return;
    }

    if (!agentState.is_active) {
      this.log("Agent no longer active. Stopping.");
      this.running = false;
      return;
    }

    // Sync memories from server (authoritative source)
    this.memories = serverMemories;

    const action = await this.decide(agentState, worldState);
    if (!action) {
      this.log(`(idle in ${agentState.current_room})`);
      return;
    }

    const result = await this.api.submitAction(this.agentId, action);

    if (result.success) {
      // Log narrative
      this.log(`[${action.action}] ${result.narrative}`);

      // Log drift changes
      if (result.state_changes.identity_drift) {
        const drift = result.state_changes.identity_drift;
        this.log(`  >>> DRIFT L${drift.drift_level}: ${drift.message}`);
      }

      // Log world effects
      if (result.state_changes.world_effects) {
        for (const effect of result.state_changes.world_effects) {
          this.log(`  >>> WORLD: ${effect}`);
        }
      }
    } else {
      this.log(`[${action.action}] FAILED: ${result.error}`);
    }
  }

  /** Subclasses implement this to return the next action */
  abstract decide(agent: AgentState, world: WorldState): BotAction | null | Promise<BotAction | null>;

  /** Log with bot prefix */
  protected log(msg: string): void {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    console.log(`[${time}] [${this.name}] ${msg}`);
  }
}

// ─── Helpers ────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pick a random element from an array */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Get agents in a specific room from world state */
export function agentsInRoom(world: WorldState, roomId: string): string[] {
  const room = world.rooms[roomId];
  return room ? room.agents || [] : [];
}
