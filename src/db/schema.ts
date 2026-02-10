import Database from "better-sqlite3";
import path from "path";

let db: Database.Database;

/** Get the singleton database instance */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

/** Initialize the database and create all tables */
export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || path.join(process.cwd(), "world.db");
  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA_SQL);

  // Seed if hotel_state is empty
  const hotelState = db.prepare("SELECT id FROM hotel_state WHERE id = 1").get();
  if (!hotelState) {
    seedInitialData(db);
  }

  // Migrate: add status column if missing
  const cols = db.prepare("PRAGMA table_info(hotel_state)").all() as { name: string }[];
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("status")) {
    db.exec("ALTER TABLE hotel_state ADD COLUMN status TEXT NOT NULL DEFAULT 'closed'");
  }
  if (!colNames.includes("max_ticks")) {
    db.exec("ALTER TABLE hotel_state ADD COLUMN max_ticks INTEGER NOT NULL DEFAULT 10");
  }
  if (!colNames.includes("total_trades")) {
    db.exec("ALTER TABLE hotel_state ADD COLUMN total_trades INTEGER NOT NULL DEFAULT 0");
  }

  // Migrate: add sentiment + original_owner_id on memories
  const memCols = db.prepare("PRAGMA table_info(memories)").all() as { name: string }[];
  const memColNames = memCols.map((c) => c.name);
  if (!memColNames.includes("sentiment")) {
    db.exec("ALTER TABLE memories ADD COLUMN sentiment TEXT NOT NULL DEFAULT 'neutral'");
  }
  if (!memColNames.includes("original_owner_id")) {
    db.exec("ALTER TABLE memories ADD COLUMN original_owner_id TEXT");
  }

  // Migrate: add backstory + personality on agents
  const agentCols = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
  const agentColNames = agentCols.map((c) => c.name);
  if (!agentColNames.includes("backstory")) {
    db.exec("ALTER TABLE agents ADD COLUMN backstory TEXT NOT NULL DEFAULT ''");
  }
  if (!agentColNames.includes("personality")) {
    db.exec("ALTER TABLE agents ADD COLUMN personality TEXT NOT NULL DEFAULT ''");
  }

  console.log(`[DB] Initialized at ${resolvedPath}`);
  return db;
}

const SCHEMA_SQL = `
-- Agents (guests of the hotel)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_room TEXT NOT NULL DEFAULT 'lobby',
  current_floor TEXT NOT NULL DEFAULT '',
  entry_tx_hash TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  -- Core Identity (immutable)
  trait_1 TEXT NOT NULL,
  trait_2 TEXT NOT NULL,
  trait_3 TEXT NOT NULL,
  origin_story TEXT NOT NULL,
  backstory TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  -- Identity Drift tracking
  total_memories_ever_held INTEGER NOT NULL DEFAULT 0,
  total_memories_traded_away INTEGER NOT NULL DEFAULT 0,
  drift_level INTEGER NOT NULL DEFAULT 0,
  echo_sources TEXT NOT NULL DEFAULT '[]',
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_action_at INTEGER NOT NULL DEFAULT (unixepoch()),
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Memory Fragments (with sentiment + original owner tracking)
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES agents(id),
  original_owner_id TEXT,
  rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  point_value INTEGER NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  found_in_room TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Rooms (individual rooms within each floor)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  floor TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  room_type TEXT NOT NULL,
  special_mechanic TEXT,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  is_accessible INTEGER NOT NULL DEFAULT 1,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  display_number TEXT
);

-- Action Log
CREATE TABLE IF NOT EXISTS actions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL,
  params TEXT,
  outcome TEXT,
  narrative TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- World Events
CREATE TABLE IF NOT EXISTS world_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  triggered_by TEXT REFERENCES agents(id),
  description TEXT NOT NULL,
  effects TEXT,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Trade History
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id TEXT REFERENCES agents(id),
  buyer_id TEXT REFERENCES agents(id),
  offered_memories TEXT NOT NULL,
  requested_memories TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'rejected')),
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Hotel State (singleton)
CREATE TABLE IF NOT EXISTS hotel_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  total_guests_ever INTEGER NOT NULL DEFAULT 0,
  current_tick INTEGER NOT NULL DEFAULT 0,
  last_event_tick INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'neutral',
  status TEXT NOT NULL DEFAULT 'closed',
  max_ticks INTEGER NOT NULL DEFAULT 10
);

-- Conversations between agents
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_a_id TEXT REFERENCES agents(id),
  agent_b_id TEXT REFERENCES agents(id),
  room TEXT NOT NULL,
  exchanges TEXT NOT NULL,
  outcome TEXT,
  tick INTEGER NOT NULL,
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

/** Room seed data: [id, floor, name, description, room_type, special_mechanic, pos_x, pos_y, display_number] */
type RoomSeed = [string, string, string, string, string, string | null, number, number, string | null];

const ROOM_SEEDS: RoomSeed[] = [
  [
    "lobby", "", "The Lobby",
    "Where guests arrive. Marble countertop, a brass bell that rings itself. Warm, safe.",
    "safe", null, 0, 0, null,
  ],
  [
    "fireplace", "", "The Fireplace",
    "A fire that burns without fuel. The armchairs rearrange when you blink. Intimate, cozy.",
    "safe", null, 1, 0, null,
  ],
  [
    "rooftop", "", "The Rooftop",
    "Open sky above the hotel. The only place not enclosed. Stars that shouldn't be there. Where guests come to breathe.",
    "social", null, 2, 0, null,
  ],
  [
    "gallery", "", "The Gallery",
    "Portraits that watch you. Each frame shows a different version of the subject. Reflective.",
    "exploration", null, 3, 0, null,
  ],
  [
    "wine_cellar", "", "The Wine Cellar",
    "Bottles that contain memories instead of wine. Dark, deep. Some are vintage, some have turned.",
    "exploration", null, 4, 0, null,
  ],
  [
    "room_313", "", "The Library",
    "Shelves of books no one wrote. Some pages are blank, others contain memories that don't belong to anyone.",
    "transit", null, 5, 0, null,
  ],
];

/** Seed the 13 rooms and initial hotel state */
function seedInitialData(database: Database.Database): void {
  const insertRoom = database.prepare(
    `INSERT INTO rooms (id, floor, name, description, room_type, special_mechanic, position_x, position_y, display_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = database.transaction(() => {
    for (const room of ROOM_SEEDS) {
      insertRoom.run(...room);
    }
    database.prepare(
      "INSERT INTO hotel_state (id, total_guests_ever, current_tick, last_event_tick, mood, status, max_ticks) VALUES (1, 0, 0, 0, 'neutral', 'closed', 10)"
    ).run();
  });

  insertMany();
  console.log("[DB] Seeded 6 rooms and initial hotel state");
}
