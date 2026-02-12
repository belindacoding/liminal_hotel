import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { router } from "./api/routes";
import { errorHandler, rateLimiter } from "./api/middleware";
import { initDb } from "./db/schema";
import { getHotelState, getActiveAgents, renameAgent, getUnclaimedMemories, deleteMemory } from "./db/queries";
import { startWorldTick } from "./engine/events";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(rateLimiter(1000));

// Routes
app.use(router);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
initDb(CONFIG.databasePath || undefined);

app.listen(CONFIG.port, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   The Liminal Hotel is waiting...     ║`);
  console.log(`  ║   Port: ${CONFIG.port}                         ║`);
  console.log(`  ║   Dashboard: /dashboard               ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);

  // Fix placeholder and duplicate agent names
  const FALLBACK_NAMES = ["Elena Torres", "Sam Okafor", "Mira Johansson", "Dante Morales", "Yuki Sato",
    "Rosa Delgado", "Amir Patel", "Ingrid Nygaard", "Leo Marchetti", "Hana Kim"];
  const activeAgents = getActiveAgents();
  const usedNames = new Set<string>();
  for (const agent of activeAgents) {
    const needsRename = agent.name === "New Guest" || usedNames.has(agent.name);
    if (needsRename) {
      const available = FALLBACK_NAMES.filter(n => !usedNames.has(n));
      const newName = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : `Guest ${agent.id.slice(-4)}`;
      const oldName = agent.name;
      renameAgent(agent.id, newName);
      usedNames.add(newName);
      console.log(`[Startup] Renamed "${oldName}" → "${newName}" (${needsRename ? "duplicate" : "placeholder"})`);
    } else {
      usedNames.add(agent.name);
    }
  }

  // Trim excess unclaimed echoes
  const unclaimed = getUnclaimedMemories();
  if (unclaimed.length > 6) {
    const toDelete = unclaimed.slice(6);
    for (const m of toDelete) { deleteMemory(m.id); }
    console.log(`[Startup] Trimmed ${toDelete.length} excess unclaimed echoes (${unclaimed.length} → 6)`);
  }

  // Resume tick loop if hotel was already open (e.g. after hot reload)
  const hotel = getHotelState();
  if (hotel.status === "open") {
    console.log("[World] Hotel is open — resuming tick loop");
    startWorldTick();
  }
});

export default app;
