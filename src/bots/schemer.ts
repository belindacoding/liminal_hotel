/**
 * The Architect — Score-maximizing bot.
 *
 * Strategy: Systematic rotation through rooms, trading for value.
 * Claims echoes aggressively. Only offers common memories.
 */

import {
  BaseBot,
  AgentState,
  WorldState,
  BotAction,
  agentsInRoom,
  pick,
} from "./base";

const ROTATION_ROOMS = ["gallery", "wine_cellar", "room_313", "rooftop", "fireplace", "lobby"];

export class ArchitectBot extends BaseBot {
  private roomIndex = 0;

  constructor(name: string, apiUrl: string, intervalMs?: number) {
    super(name, apiUrl, intervalMs);
  }

  async decide(agent: AgentState, world: WorldState): Promise<BotAction | null> {
    const currentRoom = agent.current_room;

    // Priority 1: Claim unclaimed echoes (always grab them)
    if (world.unclaimed_memories && world.unclaimed_memories.length > 0) {
      // Prefer highest point value echo
      const sorted = [...world.unclaimed_memories].sort((a, b) => b.point_value - a.point_value);
      return { action: "claim", params: { memory_id: sorted[0].id } };
    }

    // Priority 2: Trade if in same room as someone and it's beneficial
    const othersHere = agentsInRoom(world, currentRoom).filter(
      (id) => id !== this.agentId
    );
    if (othersHere.length > 0 && this.memories.length > 1) {
      // Only offer commons when we have plenty
      const commons = this.memories.filter(m => m.rarity === "common");
      if (commons.length >= 2) {
        const target = pick(othersHere);
        const targetMems = await this.api.getTargetMemories(target);
        // Try to get a rare memory in exchange for a common
        const rares = targetMems.filter(m => m.rarity !== "common");
        const toRequest = rares.length > 0 ? pick(rares) : targetMems.length > 0 ? pick(targetMems) : null;
        if (toRequest) {
          return {
            action: "trade",
            params: {
              target_agent: target,
              offer: [commons[0].id],
              request: [toRequest.id],
            },
          };
        }
      }
    }

    // Priority 3: Move to next room in rotation
    const targetRoom = ROTATION_ROOMS[this.roomIndex % ROTATION_ROOMS.length];
    if (currentRoom !== targetRoom) {
      return { action: "move", params: { target_room: targetRoom } };
    }

    // Already at target room — cycle to next
    this.roomIndex++;
    const nextRoom = ROTATION_ROOMS[this.roomIndex % ROTATION_ROOMS.length];
    return { action: "move", params: { target_room: nextRoom } };
  }
}
