/**
 * The Broker — Trading-focused bot.
 *
 * Strategy: Move to where other agents are, trade aggressively.
 * Claims unclaimed echoes when available.
 */

import {
  BaseBot,
  AgentState,
  WorldState,
  BotAction,
  MemoryInfo,
  agentsInRoom,
  pick,
} from "./base";

const VALID_ROOMS = ["lobby", "fireplace", "rooftop", "gallery", "wine_cellar", "room_313"];

export class BrokerBot extends BaseBot {
  private lastTradeTarget: string = "";
  private idleCount = 0;

  constructor(name: string, apiUrl: string, intervalMs?: number) {
    super(name, apiUrl, intervalMs);
  }

  decide(agent: AgentState, world: WorldState): BotAction | null {
    // Find rooms with other agents
    const roomsWithAgents = this.findRoomsWithAgents(world);

    // Priority 1: Claim unclaimed echoes if any exist
    if (world.unclaimed_memories && world.unclaimed_memories.length > 0) {
      const echo = world.unclaimed_memories[0];
      return { action: "claim", params: { memory_id: echo.id } };
    }

    // Priority 2: Trade if there are other agents in the same room
    const othersHere = agentsInRoom(world, agent.current_room).filter(
      (id) => id !== this.agentId
    );

    if (othersHere.length > 0 && this.memories.length > 0) {
      const target = this.pickTradeTarget(othersHere);
      if (target) {
        const toOffer = this.pickMemoryToOffer();
        if (toOffer) {
          this.lastTradeTarget = target;
          this.idleCount = 0;
          return {
            action: "trade",
            params: {
              target_agent: target,
              offer: [toOffer.id],
              request: [],
            },
          };
        }
      }
    }

    // Priority 3: Move to a room that has other agents
    if (roomsWithAgents.length > 0) {
      const targetRoom = roomsWithAgents.find(r => r !== agent.current_room);
      if (targetRoom) {
        this.idleCount = 0;
        return { action: "move", params: { target_room: targetRoom } };
      }
    }

    // Priority 4: Move to a random room
    this.idleCount++;
    if (this.idleCount >= 2) {
      this.idleCount = 0;
      const otherRooms = VALID_ROOMS.filter(r => r !== agent.current_room);
      return { action: "move", params: { target_room: pick(otherRooms) } };
    }

    return null;
  }

  /** Find rooms that have other agents */
  private findRoomsWithAgents(world: WorldState): string[] {
    const rooms: string[] = [];
    for (const [roomId, room] of Object.entries(world.rooms)) {
      const others = (room.agents || []).filter((id: string) => id !== this.agentId);
      if (others.length > 0) rooms.push(roomId);
    }
    return rooms;
  }

  /** Pick a trade target, avoiding the same one twice in a row */
  private pickTradeTarget(candidates: string[]): string | null {
    const filtered = candidates.filter((id) => id !== this.lastTradeTarget);
    if (filtered.length > 0) return pick(filtered);
    if (candidates.length > 0) return pick(candidates);
    return null;
  }

  /** Pick a memory to offer — prefer common rarity (lowest point value) */
  private pickMemoryToOffer(): MemoryInfo | null {
    if (this.memories.length === 0) return null;

    // Offer lowest point value
    const sorted = [...this.memories].sort(
      (a, b) => a.point_value - b.point_value
    );
    return sorted[0];
  }
}
