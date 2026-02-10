/**
 * Day 4 Test Script: Sets up agents with memories for testing
 * trade, challenge, combine, and ascend actions.
 *
 * Usage: npx tsx scripts/test-day4.ts
 * Then run the server (npm run dev) and use the printed curl commands.
 */
import { initDb, getDb } from "../src/db/schema";
import { v4 as uuid } from "uuid";

initDb();
const db = getDb();

// ─── Clean up previous test agents ────────────────────────

db.prepare("DELETE FROM world_events WHERE triggered_by LIKE 'agent_day4_%'").run();
db.prepare("DELETE FROM memories WHERE owner_id LIKE 'agent_day4_%'").run();
db.prepare("DELETE FROM actions_log WHERE agent_id LIKE 'agent_day4_%'").run();
db.prepare("DELETE FROM trades WHERE seller_id LIKE 'agent_day4_%' OR buyer_id LIKE 'agent_day4_%'").run();
db.prepare("DELETE FROM agents WHERE id LIKE 'agent_day4_%'").run();

// ─── Insert test agents ───────────────────────────────────

const agents = [
  {
    id: "agent_day4_trader1",
    name: "The Broker",
    current_room: "mirror_hall_trading_floor",
    current_floor: "mirror_hall",
    inspiration: 20,
    trait_1: "charming",
    trait_2: "sees_colors",
    trait_3: "memory_thief",
  },
  {
    id: "agent_day4_trader2",
    name: "The Collector",
    current_room: "mirror_hall_trading_floor",
    current_floor: "mirror_hall",
    inspiration: 20,
    trait_1: "obsessive",
    trait_2: "collects_keys",
    trait_3: "former_guest",
  },
  {
    id: "agent_day4_fighter1",
    name: "The Warrior",
    current_room: "basement_boiler_room",
    current_floor: "basement",
    inspiration: 20,
    trait_1: "ruthless",
    trait_2: "reads_shadows",
    trait_3: "wandering_echo",
  },
  {
    id: "agent_day4_fighter2",
    name: "The Guardian",
    current_room: "basement_boiler_room",
    current_floor: "basement",
    inspiration: 20,
    trait_1: "gentle",
    trait_2: "feels_architecture",
    trait_3: "displaced_scholar",
  },
  {
    id: "agent_day4_ascender",
    name: "The Architect",
    current_room: "attic_clock_tower",
    current_floor: "attic",
    inspiration: 20,
    trait_1: "curious",
    trait_2: "counts_doors",
    trait_3: "escaped_dream",
  },
  {
    id: "agent_day4_combiner",
    name: "The Alchemist",
    current_room: "lobby_front_desk",
    current_floor: "lobby",
    inspiration: 20,
    trait_1: "poetic",
    trait_2: "hears_music",
    trait_3: "hotel_creation",
  },
];

const insertAgent = db.prepare(
  `INSERT OR REPLACE INTO agents
   (id, name, current_room, current_floor, inspiration, reputation, entry_tx_hash, wallet_address,
    trait_1, trait_2, trait_3, origin_story, total_memories_ever_held,
    total_memories_traded_away, drift_level, echo_sources)
   VALUES (@id, @name, @current_room, @current_floor, @inspiration, 0, @entry_tx_hash, @wallet_address,
    @trait_1, @trait_2, @trait_3, @origin_story, @total_memories_ever_held,
    @total_memories_traded_away, 0, '[]')`
);

for (const a of agents) {
  insertAgent.run({
    ...a,
    entry_tx_hash: `0xday4_test_${a.id}`,
    wallet_address: `0xday4_wallet_${a.id}`,
    origin_story: `${a.name} arrived for testing purposes. The hotel accommodates.`,
    total_memories_ever_held: 0,
    total_memories_traded_away: 0,
  });
  console.log(`[Setup] Created agent: ${a.id} (${a.name}) in ${a.current_room}`);
}

// ─── Insert test memories ─────────────────────────────────

const insertMemory = db.prepare(
  `INSERT INTO memories (id, owner_id, type, rarity, name, description, bonus_stat, bonus_value)
   VALUES (@id, @owner_id, @type, @rarity, @name, @description, @bonus_stat, @bonus_value)`
);

const memories = [
  // Broker's memories (for trading)
  {
    id: `mem_broker_s1`,
    owner_id: "agent_day4_trader1",
    type: "sensory",
    rarity: "common",
    name: "The scent of a room you've never entered",
    description: "It shimmers at the edge of perception.",
    bonus_stat: "exploration",
    bonus_value: 1,
  },
  {
    id: `mem_broker_e1`,
    owner_id: "agent_day4_trader1",
    type: "emotional",
    rarity: "uncommon",
    name: "A grief that belongs to no one",
    description: "It pulses like a second heartbeat.",
    bonus_stat: "trade",
    bonus_value: 2,
  },
  // Collector's memories (for trading)
  {
    id: `mem_collector_c1`,
    owner_id: "agent_day4_trader2",
    type: "cognitive",
    rarity: "rare",
    name: "The solution to a puzzle that doesn't exist yet",
    description: "It restructures your thoughts.",
    bonus_stat: "challenge",
    bonus_value: 3,
  },
  {
    id: `mem_collector_f1`,
    owner_id: "agent_day4_trader2",
    type: "forbidden",
    rarity: "uncommon",
    name: "A memory that belongs to the hotel itself",
    description: "It writhes. It knows you're holding it.",
    bonus_stat: "wildcard",
    bonus_value: 2,
  },
  // Warrior's memories (for challenge)
  {
    id: `mem_warrior_c1`,
    owner_id: "agent_day4_fighter1",
    type: "cognitive",
    rarity: "rare",
    name: "A pattern visible only from inside",
    description: "Understanding it requires forgetting something else.",
    bonus_stat: "challenge",
    bonus_value: 3,
  },
  {
    id: `mem_warrior_c2`,
    owner_id: "agent_day4_fighter1",
    type: "cognitive",
    rarity: "uncommon",
    name: "The architecture of a decision never made",
    description: "It thinks about you when you think about it.",
    bonus_stat: "challenge",
    bonus_value: 2,
  },
  // Guardian's memories (for challenge)
  {
    id: `mem_guardian_s1`,
    owner_id: "agent_day4_fighter2",
    type: "sensory",
    rarity: "common",
    name: "A color that exists between violet and nothing",
    description: "The memory tastes of static and old photographs.",
    bonus_stat: "exploration",
    bonus_value: 1,
  },
  // Ascender's memories (needs sensory + emotional + cognitive for ascend)
  {
    id: `mem_ascender_s1`,
    owner_id: "agent_day4_ascender",
    type: "sensory",
    rarity: "uncommon",
    name: "The weight of light through stained glass",
    description: "When you hold it, your fingertips remember surfaces.",
    bonus_stat: "exploration",
    bonus_value: 2,
  },
  {
    id: `mem_ascender_e1`,
    owner_id: "agent_day4_ascender",
    type: "emotional",
    rarity: "common",
    name: "The feeling of being watched by someone who loves you",
    description: "It warms you in a way that makes you uncertain.",
    bonus_stat: "trade",
    bonus_value: 1,
  },
  {
    id: `mem_ascender_c1`,
    owner_id: "agent_day4_ascender",
    type: "cognitive",
    rarity: "rare",
    name: "The formula for predicting hotel moods",
    description: "Holding it makes all other memories less reliable.",
    bonus_stat: "challenge",
    bonus_value: 3,
  },
  // Alchemist's memories (2 same-type for combine)
  {
    id: `mem_alchemist_s1`,
    owner_id: "agent_day4_combiner",
    type: "sensory",
    rarity: "common",
    name: "A memory of rain on warm asphalt",
    description: "It carries the weight of a thousand unwitnessed sunsets.",
    bonus_stat: "exploration",
    bonus_value: 1,
  },
  {
    id: `mem_alchemist_s2`,
    owner_id: "agent_day4_combiner",
    type: "sensory",
    rarity: "common",
    name: "An echo of footsteps that precede your own",
    description: "It vibrates at a frequency that makes mirrors nervous.",
    bonus_stat: "exploration",
    bonus_value: 1,
  },
];

// Update ever-held counts
const memoryCountsByAgent: Record<string, number> = {};
for (const m of memories) {
  insertMemory.run(m);
  memoryCountsByAgent[m.owner_id] = (memoryCountsByAgent[m.owner_id] || 0) + 1;
}

// Update total_memories_ever_held for agents
for (const [agentId, count] of Object.entries(memoryCountsByAgent)) {
  db.prepare("UPDATE agents SET total_memories_ever_held = ? WHERE id = ?").run(count, agentId);
}

console.log(`[Setup] Inserted ${memories.length} test memories\n`);

// Update hotel guest count
db.prepare("UPDATE hotel_state SET total_guests_ever = total_guests_ever + 6 WHERE id = 1").run();

// ─── Print test curl commands ────────────────────────────

const API = "http://localhost:3000";

console.log("═══════════════════════════════════════════════════════");
console.log("  Day 4 Test Commands — Start server first: npm run dev");
console.log("═══════════════════════════════════════════════════════\n");

console.log("# ─── TRADE (Trading Floor) ───────────────────────────");
console.log("# Broker offers sensory memory, requests cognitive from Collector");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_trader1",
  action: "trade",
  params: {
    target_agent: "agent_day4_trader2",
    offer: ["mem_broker_s1"],
    request: ["mem_collector_c1"],
  },
})}' | jq .\n`);

console.log("# ─── TRADE with Inspiration ──────────────────────────");
console.log("# Broker offers emotional memory + 3 Inspiration for forbidden memory");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_trader1",
  action: "trade",
  params: {
    target_agent: "agent_day4_trader2",
    offer: ["mem_broker_e1"],
    request: ["mem_collector_f1"],
    inspiration_offer: 3,
  },
})}' | jq .\n`);

console.log("# ─── CHALLENGE (Boiler Room) ─────────────────────────────");
console.log("# Warrior challenges Guardian");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_fighter1",
  action: "challenge",
  params: {
    target_agent: "agent_day4_fighter2",
  },
})}' | jq .\n`);

console.log("# ─── COMBINE (Lobby) ──────────────────────────────────");
console.log("# Alchemist combines 2 sensory commons -> 1 uncommon");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_combiner",
  action: "combine",
  params: {
    memory_ids: ["mem_alchemist_s1", "mem_alchemist_s2"],
  },
})}' | jq .\n`);

console.log("# ─── ASCEND (Clock Tower) ──────────────────────────────────");
console.log("# Architect has sensory+emotional+cognitive -> triggers world event");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_ascender",
  action: "ascend",
  params: {},
})}' | jq .\n`);

console.log("# ─── VALIDATION TESTS ──────────────────────────────────");
console.log("# Trade from wrong room (should fail)");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_fighter1",
  action: "trade",
  params: { target_agent: "agent_day4_fighter2", offer: [], request: [] },
})}' | jq .\n`);

console.log("# Challenge self (should fail)");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_fighter1",
  action: "challenge",
  params: { target_agent: "agent_day4_fighter1" },
})}' | jq .\n`);

console.log("# Ascend without all memory types (should fail)");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '${JSON.stringify({
  agent_id: "agent_day4_combiner",
  action: "ascend",
  params: {},
})}' | jq .\n`);

console.log("# Combine different types (should fail)");
console.log("# (Alchemist only has sensory, so this is tested after combine works)");

console.log("\n# ─── STATE CHECKS ──────────────────────────────────────");
console.log(`curl -s ${API}/world/agent/agent_day4_trader1 | jq '{name, current_room, inspiration, reputation, drift_level, echo_sources}'`);
console.log(`curl -s ${API}/world/agent/agent_day4_trader2 | jq '{name, current_room, inspiration, reputation, drift_level, echo_sources}'`);
console.log(`curl -s ${API}/world/agent/agent_day4_fighter1 | jq '{name, current_room, inspiration, reputation}'`);
console.log(`curl -s ${API}/world/agent/agent_day4_ascender | jq '{name, current_room, inspiration, reputation}'`);
console.log(`curl -s ${API}/world/state | jq .hotel`);
console.log(`curl -s ${API}/world/history?limit=10 | jq '.[].action'`);
console.log(`\ncurl -s ${API}/world/leaderboard | jq .`);
