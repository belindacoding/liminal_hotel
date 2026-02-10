/**
 * Test script: inserts a test agent and prints curl commands.
 * Usage: npx tsx scripts/test-actions.ts
 */
import { initDb } from "../src/db/schema";
import { getDb } from "../src/db/schema";

// Initialize DB and insert a test agent directly
initDb();
const db = getDb();

const testAgent = {
  id: "agent_test_001",
  name: "The Wanderer",
  current_room: "lobby_front_desk",
  current_floor: "lobby",
  entry_tx_hash: "0xfake_test_tx",
  wallet_address: "0xfake_test_wallet",
  trait_1: "curious",
  trait_2: "poetic",
  trait_3: "lost_traveler",
  origin_story: "You arrived through a door that wasn't there yesterday.",
  total_memories_ever_held: 0,
  total_memories_traded_away: 0,
  drift_level: 0,
  echo_sources: "[]",
};

// Insert or replace test agent
db.prepare(
  `INSERT OR REPLACE INTO agents (id, name, current_room, current_floor, entry_tx_hash, wallet_address, trait_1, trait_2, trait_3, origin_story, total_memories_ever_held, total_memories_traded_away, drift_level, echo_sources)
   VALUES (@id, @name, @current_room, @current_floor, @entry_tx_hash, @wallet_address, @trait_1, @trait_2, @trait_3, @origin_story, @total_memories_ever_held, @total_memories_traded_away, @drift_level, @echo_sources)`
).run(testAgent);

// Also update hotel guest count
db.prepare("UPDATE hotel_state SET total_guests_ever = 1 WHERE id = 1").run();

console.log("[Test] Inserted test agent:", testAgent.id);
console.log("[Test] Agent is in lobby_front_desk.");
console.log("[Test] Start the server (npm run dev) and run these curl commands:\n");

const API = "http://localhost:3000";

console.log("# 1. Explore (may find memory)");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '{"agent_id":"agent_test_001","action":"explore","params":{}}' | jq .`);

console.log("\n# 2. Move to corridors room 307");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '{"agent_id":"agent_test_001","action":"move","params":{"target_room":"corridors_room_307"}}' | jq .`);

console.log("\n# 3. Explore in corridors");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '{"agent_id":"agent_test_001","action":"explore","params":{}}' | jq .`);

console.log("\n# 4. Move to basement wine cellar");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '{"agent_id":"agent_test_001","action":"move","params":{"target_room":"basement_wine_cellar"}}' | jq .`);

console.log("\n# 5. Explore in wine cellar");
console.log(`curl -s -X POST ${API}/world/action -H "Content-Type: application/json" -d '{"agent_id":"agent_test_001","action":"explore","params":{}}' | jq .`);

console.log("\n# 6. Check agent state");
console.log(`curl -s ${API}/world/agent/agent_test_001 | jq .`);

console.log("\n# 7. Check world state");
console.log(`curl -s ${API}/world/state | jq .`);

console.log("\n# 8. Check history");
console.log(`curl -s ${API}/world/history | jq .`);

console.log("\n# 9. Check leaderboard (scores)");
console.log(`curl -s ${API}/world/leaderboard | jq .`);
