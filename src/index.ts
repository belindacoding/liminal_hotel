import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { router } from "./api/routes";
import { errorHandler, rateLimiter } from "./api/middleware";
import { initDb } from "./db/schema";
import { getHotelState } from "./db/queries";
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

  // Resume tick loop if hotel was already open (e.g. after hot reload)
  const hotel = getHotelState();
  if (hotel.status === "open") {
    console.log("[World] Hotel is open — resuming tick loop");
    startWorldTick();
  }
});

export default app;
