/**
 * The Wanderer — Exploration-focused bot.
 *
 * Strategy: Move between rooms constantly, encountering agents.
 * Occasionally trades when co-located. Prefers variety of rooms.
 */

import { BaseBot, AgentState, WorldState, BotAction, agentsInRoom, pick } from "./base";

const VALID_ROOMS = ["lobby", "fireplace", "rooftop", "gallery", "wine_cellar", "room_313"];

export class WandererBot extends BaseBot {
  private visitHistory: string[] = [];

  constructor(name: string, apiUrl: string, intervalMs?: number) {
    super(name, apiUrl, intervalMs);
  }

  async decide(agent: AgentState, world: WorldState): Promise<BotAction | null> {
    this.visitHistory.push(agent.current_room);
    // Keep last 10 visits
    if (this.visitHistory.length > 10) this.visitHistory.shift();

    // Priority 1: Trade if co-located with another agent (30% chance)
    const othersHere = agentsInRoom(world, agent.current_room).filter(
      (id) => id !== this.agentId
    );
    if (othersHere.length > 0 && this.memories.length > 0 && Math.random() < 0.3) {
      const target = pick(othersHere);
      const targetMems = await this.api.getTargetMemories(target);
      if (targetMems.length > 0) {
        const sorted = [...this.memories].sort((a, b) => a.point_value - b.point_value);
        return {
          action: "trade",
          params: {
            target_agent: target,
            offer: [sorted[0].id],
            request: [pick(targetMems).id],
          },
        };
      }
    }

    // Priority 2: Claim unclaimed echoes (40% chance)
    if (world.unclaimed_memories && world.unclaimed_memories.length > 0 && Math.random() < 0.4) {
      const echo = pick(world.unclaimed_memories);
      return { action: "claim", params: { memory_id: echo.id } };
    }

    // Priority 3: Move to a room we haven't visited recently
    const target = this.pickNextRoom(agent.current_room);
    if (target) {
      return { action: "move", params: { target_room: target } };
    }

    return null;
  }

  /** Pick the next room, preferring ones not recently visited */
  private pickNextRoom(current: string): string | null {
    const candidates = VALID_ROOMS.filter((room) => room !== current);

    // Count recent visits to each room
    const recentVisits: Record<string, number> = {};
    for (const room of this.visitHistory.slice(-5)) {
      recentVisits[room] = (recentVisits[room] || 0) + 1;
    }

    // Sort by least recently visited
    candidates.sort((a, b) => (recentVisits[a] || 0) - (recentVisits[b] || 0));

    // Pick from least visited with some randomness
    const leastVisited = candidates.filter(
      (c) => (recentVisits[c] || 0) === (recentVisits[candidates[0]] || 0)
    );

    return pick(leastVisited);
  }
}
