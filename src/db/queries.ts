import { getDb } from "./schema";

// ─── Types ───────────────────────────────────────────────

export interface AgentRow {
  id: string;
  name: string;
  current_room: string;
  current_floor: string;
  entry_tx_hash: string;
  wallet_address: string;
  trait_1: string;
  trait_2: string;
  trait_3: string;
  origin_story: string;
  backstory: string;
  personality: string;
  total_memories_ever_held: number;
  total_memories_traded_away: number;
  drift_level: number;
  echo_sources: string;
  created_at: number;
  last_action_at: number;
  is_active: number;
}

export interface MemoryRow {
  id: string;
  owner_id: string | null;
  original_owner_id: string | null;
  rarity: string;
  name: string;
  description: string;
  point_value: number;
  sentiment: string;
  found_in_room: string | null;
  created_at: number;
}

export interface RoomRow {
  id: string;
  floor: string;
  name: string;
  description: string;
  room_type: string;
  special_mechanic: string | null;
  position_x: number;
  position_y: number;
  is_accessible: number;
  is_hidden: number;
  display_number: string | null;
}

export interface HotelStateRow {
  id: number;
  total_guests_ever: number;
  current_tick: number;
  last_event_tick: number;
  mood: string;
  status: string;
  max_ticks: number;
  total_trades: number;
}

export interface ActionLogRow {
  id: number;
  agent_id: string;
  action: string;
  params: string | null;
  outcome: string | null;
  narrative: string | null;
  timestamp: number;
}

export interface WorldEventRow {
  id: number;
  type: string;
  triggered_by: string | null;
  description: string;
  effects: string | null;
  timestamp: number;
}

export interface ConversationRow {
  id: number;
  agent_a_id: string;
  agent_b_id: string;
  room: string;
  exchanges: string;
  outcome: string | null;
  tick: number;
  timestamp: number;
}

// ─── Hotel State ─────────────────────────────────────────

/** Get the singleton hotel state */
export function getHotelState(): HotelStateRow {
  const db = getDb();
  return db.prepare("SELECT * FROM hotel_state WHERE id = 1").get() as HotelStateRow;
}

/** Update hotel state fields */
export function updateHotelState(updates: Partial<Omit<HotelStateRow, "id">>): void {
  const db = getDb();
  const fields = Object.keys(updates);
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE hotel_state SET ${setClause} WHERE id = 1`).run(updates);
}

/** Reset hotel for a fresh run — clear agents, memories, conversations, trades, action logs */
export function resetHotelData(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM conversations;
    DELETE FROM trades;
    DELETE FROM actions_log;
    DELETE FROM world_events;
    DELETE FROM memories;
    DELETE FROM agents;
  `);
  updateHotelState({
    current_tick: 0,
    last_event_tick: 0,
    total_guests_ever: 0,
    total_trades: 0,
    mood: "neutral",
    status: "closed",
  });
}

// ─── Rooms ──────────────────────────────────────────────

/** Get all rooms */
export function getAllRooms(): RoomRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM rooms ORDER BY position_y, position_x").all() as RoomRow[];
}

/** Get a single room by ID */
export function getRoom(id: string): RoomRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) as RoomRow | undefined;
}

/** Get all rooms on a specific floor */
export function getRoomsByFloor(floor: string): RoomRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM rooms WHERE floor = ? ORDER BY position_x").all(floor) as RoomRow[];
}

// ─── Agents ──────────────────────────────────────────────

/** Get an agent by ID */
export function getAgent(id: string): AgentRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
}

/** Get all active agents */
export function getActiveAgents(): AgentRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM agents WHERE is_active = 1").all() as AgentRow[];
}

/** Get agents in a specific room */
export function getAgentsInRoom(roomId: string): AgentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE current_room = ? AND is_active = 1")
    .all(roomId) as AgentRow[];
}

/** Get agents on a specific floor */
export function getAgentsOnFloor(floor: string): AgentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE current_floor = ? AND is_active = 1")
    .all(floor) as AgentRow[];
}

/** Get memories owned by an agent */
export function getAgentMemories(agentId: string): MemoryRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memories WHERE owner_id = ?")
    .all(agentId) as MemoryRow[];
}

/** Get an agent's original memories (what they entered with) */
export function getAgentOriginalMemories(agentId: string): MemoryRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memories WHERE original_owner_id = ?")
    .all(agentId) as MemoryRow[];
}

/** Count how many of an agent's original memories they still own */
export function countOriginalMemoriesRemaining(agentId: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM memories WHERE original_owner_id = ? AND owner_id = ?")
    .get(agentId, agentId) as { cnt: number };
  return row.cnt;
}

// ─── Action Log ──────────────────────────────────────────

/** Get recent action history */
export function getActionHistory(limit: number = 50): ActionLogRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM actions_log ORDER BY timestamp DESC LIMIT ?")
    .all(limit) as ActionLogRow[];
}

// ─── World Events ────────────────────────────────────────

/** Get recent world events */
export function getRecentEvents(limit: number = 10): WorldEventRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM world_events ORDER BY timestamp DESC LIMIT ?")
    .all(limit) as WorldEventRow[];
}

// ─── Trades ──────────────────────────────────────────────

/** Count active trades */
export function getActiveTradeCount(): number {
  const db = getDb();
  const result = db
    .prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'pending'")
    .get() as { count: number };
  return result.count;
}

// ─── Leaderboard ─────────────────────────────────────────

/** Get agent leaderboard sorted by score (sum of point_value) */
export function getLeaderboard(): Array<{
  agent_id: string;
  agent_name: string;
  memory_count: number;
  score: number;
  drift_level: number;
}> {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        a.id as agent_id,
        a.name as agent_name,
        a.drift_level,
        COUNT(m.id) as memory_count,
        COALESCE(SUM(m.point_value), 0) as score
      FROM agents a
      LEFT JOIN memories m ON m.owner_id = a.id
      WHERE a.is_active = 1
      GROUP BY a.id
      ORDER BY score DESC`
    )
    .all() as Array<{
    agent_id: string;
    agent_name: string;
    memory_count: number;
    score: number;
    drift_level: number;
  }>;
}

// ─── Agent Mutations ─────────────────────────────────────

/** Update an agent's room and floor */
export function updateAgentRoom(agentId: string, roomId: string, floor: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE agents SET current_room = ?, current_floor = ?, last_action_at = unixepoch() WHERE id = ?"
  ).run(roomId, floor, agentId);
}

/** Update agent's drift tracking fields */
export function updateDrift(
  agentId: string,
  totalEverHeld: number,
  totalTradedAway: number,
  driftLevel: number,
  echoSources: string[]
): void {
  const db = getDb();
  db.prepare(
    `UPDATE agents SET
      total_memories_ever_held = ?,
      total_memories_traded_away = ?,
      drift_level = ?,
      echo_sources = ?,
      last_action_at = unixepoch()
    WHERE id = ?`
  ).run(totalEverHeld, totalTradedAway, driftLevel, JSON.stringify(echoSources), agentId);
}

/** Touch the last_action_at timestamp */
export function touchAgent(agentId: string): void {
  const db = getDb();
  db.prepare("UPDATE agents SET last_action_at = unixepoch() WHERE id = ?").run(agentId);
}

// ─── Memory Mutations ────────────────────────────────────

/** Insert a new memory fragment */
export function insertMemory(memory: {
  id: string;
  owner_id: string;
  original_owner_id?: string;
  rarity: string;
  name: string;
  description: string;
  point_value: number;
  sentiment?: string;
  found_in_room?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO memories (id, owner_id, original_owner_id, rarity, name, description, point_value, sentiment, found_in_room)
     VALUES (@id, @owner_id, @original_owner_id, @rarity, @name, @description, @point_value, @sentiment, @found_in_room)`
  ).run({
    ...memory,
    original_owner_id: memory.original_owner_id || memory.owner_id,
    sentiment: memory.sentiment || "neutral",
    found_in_room: memory.found_in_room || null,
  });
}

/** Transfer a memory to a new owner */
export function transferMemory(memoryId: string, newOwnerId: string): void {
  const db = getDb();
  db.prepare("UPDATE memories SET owner_id = ? WHERE id = ?").run(newOwnerId, memoryId);
}

/** Delete a memory (consumed in combine, etc.) */
export function deleteMemory(memoryId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM memories WHERE id = ?").run(memoryId);
}

// ─── Action Log Mutations ────────────────────────────────

/** Log an action */
export function logAction(entry: {
  agent_id: string;
  action: string;
  params: string | null;
  outcome: string | null;
  narrative: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO actions_log (agent_id, action, params, outcome, narrative)
     VALUES (@agent_id, @action, @params, @outcome, @narrative)`
  ).run(entry);
}

// ─── World Event Mutations ───────────────────────────────

/** Insert a world event */
export function insertWorldEvent(event: {
  type: string;
  triggered_by: string | null;
  description: string;
  effects: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO world_events (type, triggered_by, description, effects)
     VALUES (@type, @triggered_by, @description, @effects)`
  ).run(event);
}

// ─── Trade Mutations ─────────────────────────────────────

/** Insert a trade record */
export function insertTrade(trade: {
  seller_id: string;
  buyer_id: string;
  offered_memories: string;
  requested_memories: string;
  status: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO trades (seller_id, buyer_id, offered_memories, requested_memories, status)
     VALUES (@seller_id, @buyer_id, @offered_memories, @requested_memories, @status)`
  ).run(trade);
}

// ─── Hotel Memory Queries ────────────────────────────────

/** Get all unclaimed memories (owner_id IS NULL) */
export function getUnclaimedMemories(): MemoryRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memories WHERE owner_id IS NULL ORDER BY created_at DESC")
    .all() as MemoryRow[];
}

/** Atomically claim an unclaimed memory — returns true if successful */
export function claimMemory(memoryId: string, agentId: string): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE memories SET owner_id = ? WHERE id = ? AND owner_id IS NULL")
    .run(agentId, memoryId);
  return result.changes > 0;
}

/** Get a single memory by ID */
export function getMemory(memoryId: string): MemoryRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM memories WHERE id = ?").get(memoryId) as MemoryRow | undefined;
}

/** Insert a hotel-produced memory (unclaimed, original_owner_id = 'hotel') */
export function insertHotelMemory(memory: {
  id: string;
  rarity: string;
  name: string;
  description: string;
  point_value: number;
  sentiment: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO memories (id, owner_id, original_owner_id, rarity, name, description, point_value, sentiment)
     VALUES (@id, NULL, 'hotel', @rarity, @name, @description, @point_value, @sentiment)`
  ).run(memory);
}

/** Get recent completed trades for sentiment analysis */
export function getRecentTradesForSentiment(limit: number = 10): Array<{
  offered_memories: string;
  requested_memories: string;
}> {
  const db = getDb();
  return db
    .prepare("SELECT offered_memories, requested_memories FROM trades WHERE status = 'completed' ORDER BY timestamp DESC LIMIT ?")
    .all(limit) as Array<{ offered_memories: string; requested_memories: string }>;
}

// ─── Conversation Mutations ─────────────────────────────

/** Insert a conversation record */
export function insertConversation(conv: {
  agent_a_id: string;
  agent_b_id: string;
  room: string;
  exchanges: string;
  outcome: string | null;
  tick: number;
  trade_summary?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (agent_a_id, agent_b_id, room, exchanges, outcome, tick, trade_summary)
     VALUES (@agent_a_id, @agent_b_id, @room, @exchanges, @outcome, @tick, @trade_summary)`
  ).run({ ...conv, trade_summary: conv.trade_summary ?? null });
}

/** Get recent conversations */
export function getRecentConversations(limit: number = 10): ConversationRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?")
    .all(limit) as ConversationRow[];
}

/** Get cooldown: last conversation tick between two agents */
export function getConversationCooldown(agentAId: string, agentBId: string): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT MAX(tick) as last_tick FROM conversations
     WHERE (agent_a_id = ? AND agent_b_id = ?) OR (agent_a_id = ? AND agent_b_id = ?)`
  ).get(agentAId, agentBId, agentBId, agentAId) as { last_tick: number | null } | undefined;
  return row?.last_tick ?? -999;
}

// ─── Agent Creation ──────────────────────────────────────

/** Insert a new agent (guest) into the hotel — spawns at The Lobby */
export function insertAgent(agent: {
  id: string;
  name: string;
  entry_tx_hash: string;
  wallet_address: string;
  trait_1: string;
  trait_2: string;
  trait_3: string;
  origin_story: string;
  backstory?: string;
  personality?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO agents (id, name, current_room, current_floor, entry_tx_hash, wallet_address, trait_1, trait_2, trait_3, origin_story, backstory, personality)
     VALUES (@id, @name, 'lobby', '', @entry_tx_hash, @wallet_address, @trait_1, @trait_2, @trait_3, @origin_story, @backstory, @personality)`
  ).run({
    ...agent,
    backstory: agent.backstory || "",
    personality: agent.personality || "",
  });
}

/** Insert a new agent as inactive (waiting to enter) */
export function insertAgentInactive(agent: {
  id: string;
  name: string;
  entry_tx_hash: string;
  wallet_address: string;
  trait_1: string;
  trait_2: string;
  trait_3: string;
  origin_story: string;
  backstory?: string;
  personality?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO agents (id, name, current_room, current_floor, entry_tx_hash, wallet_address, trait_1, trait_2, trait_3, origin_story, backstory, personality, is_active)
     VALUES (@id, @name, 'lobby', '', @entry_tx_hash, @wallet_address, @trait_1, @trait_2, @trait_3, @origin_story, @backstory, @personality, 0)`
  ).run({
    ...agent,
    backstory: agent.backstory || "",
    personality: agent.personality || "",
  });
}

/** Activate the next pending (inactive) agent — returns the agent if found */
export function activateNextAgent(): AgentRow | undefined {
  const db = getDb();
  const agent = db.prepare(
    "SELECT * FROM agents WHERE is_active = 0 ORDER BY created_at ASC LIMIT 1"
  ).get() as AgentRow | undefined;
  if (agent) {
    db.prepare("UPDATE agents SET is_active = 1, last_action_at = unixepoch() WHERE id = ?").run(agent.id);
  }
  return agent;
}

/** Check if a tx hash has already been used for entry */
export function isTxHashUsed(txHash: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT id FROM agents WHERE entry_tx_hash = ?").get(txHash);
  return !!row;
}

/** Check if a wallet already has an active agent */
export function getAgentByWallet(walletAddress: string): AgentRow | undefined {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM agents WHERE wallet_address = ? AND is_active = 1"
  ).get(walletAddress.toLowerCase()) as AgentRow | undefined;
}

// ─── Guest Cap & Checkout ────────────────────────────────

/** Deactivate an agent (check out) */
export function deactivateAgent(agentId: string): void {
  const db = getDb();
  db.prepare("UPDATE agents SET is_active = 0 WHERE id = ?").run(agentId);
}

export function renameAgent(agentId: string, newName: string): void {
  const db = getDb();
  db.prepare("UPDATE agents SET name = ? WHERE id = ?").run(newName, agentId);
}

/** Get all active NPCs (wallet_address = 0x000...0) */
export function getActiveNPCs(): AgentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE is_active = 1 AND wallet_address = '0x0000000000000000000000000000000000000000'")
    .all() as AgentRow[];
}

/** Get active bot client agents (0xbot_ wallets) */
export function getActiveBotAgents(): AgentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE is_active = 1 AND wallet_address LIKE '0xbot_%'")
    .all() as AgentRow[];
}

/** Get count of active agents */
export function getActiveAgentCount(): number {
  const db = getDb();
  const result = db
    .prepare("SELECT COUNT(*) as count FROM agents WHERE is_active = 1")
    .get() as { count: number };
  return result.count;
}

// ─── World State (composite) ─────────────────────────────

/** Build the full public world state response */
export function getWorldState(): object {
  const hotel = getHotelState();
  const rooms = getAllRooms();
  const agents = getActiveAgents();
  const recentEvents = getRecentEvents(5);
  const leaderboard = getLeaderboard();
  const unclaimed = getUnclaimedMemories();

  // Flat room map with agents
  const roomMap: Record<string, object> = {};
  for (const room of rooms) {
    const agentsHere = agents
      .filter((a) => a.current_room === room.id)
      .map((a) => a.id);

    roomMap[room.id] = {
      name: room.name,
      room_type: room.room_type,
      agents: agentsHere,
    };
  }

  return {
    hotel: {
      tick: hotel.current_tick,
      total_guests: hotel.total_guests_ever,
      active_guests: agents.length,
      max_guests: 6,
      mood: hotel.mood,
      status: hotel.status,
      total_trades: hotel.total_trades,
    },
    unclaimed_memories: unclaimed.map((m) => ({
      id: m.id,
      name: m.name,
      rarity: m.rarity,
      sentiment: m.sentiment,
      point_value: m.point_value,
    })),
    rooms: roomMap,
    recent_events: recentEvents.map((e) => ({
      type: e.type,
      description: e.description,
      tick: hotel.current_tick,
    })),
    leaderboard: leaderboard.map((l) => ({
      agent: l.agent_name,
      agent_id: l.agent_id,
      memories: l.memory_count,
      score: l.score,
      drift_level: l.drift_level,
    })),
  };
}
