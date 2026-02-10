import { Router, Request, Response } from "express";
import * as queries from "../db/queries";
import { processAction, ActionRequest, startWorldTick, closeHotel } from "../engine/world";
import { generateAgents, generateSingleAgent, toDbMemory } from "../engine/generator";
import { generateTransformationNarrative, generateCheckoutNarrative } from "../engine/narrative";
import { generateAgentId } from "./entry";
import { verifyEntryPayment, isDevMode } from "../monad/gate";
import { getHotelAddress } from "../monad/client";
import { CONFIG } from "../config";
import path from "path";

export const router = Router();

// ─── Hotel Lifecycle ────────────────────────────────────

/** Open the hotel — generate agents, start tick loop */
router.post("/world/hotel/open", async (_req: Request, res: Response) => {
  try {
    const hotel = queries.getHotelState();
    if (hotel.status === "open") {
      res.status(400).json({ success: false, error: "Hotel is already open." });
      return;
    }

    // Reset all data for a fresh run
    queries.resetHotelData();
    queries.updateHotelState({ status: "open", current_tick: 0 });

    // Generate 3 agents via Claude API
    console.log("[Hotel] Generating agents...");
    const generatedAgents = await generateAgents();

    const agentData: Array<{
      id: string;
      name: string;
      backstory: string;
      personality: string;
      memories: Array<{ id: string; name: string; rarity: string; sentiment: string; point_value: number }>;
    }> = [];

    for (const gen of generatedAgents) {
      const agentId = generateAgentId();

      // Insert agent (active immediately)
      queries.insertAgent({
        id: agentId,
        name: gen.name,
        entry_tx_hash: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        wallet_address: "0x0000000000000000000000000000000000000000",
        trait_1: gen.personality.split(",")[0]?.trim() || "quiet",
        trait_2: gen.personality.split(",")[1]?.trim() || "thoughtful",
        trait_3: gen.personality.split(",")[2]?.trim() || "searching",
        origin_story: gen.backstory,
        backstory: gen.backstory,
        personality: gen.personality,
      });

      // Insert memories
      const memData: Array<{ id: string; name: string; rarity: string; sentiment: string; point_value: number }> = [];
      for (const mem of gen.memories) {
        const dbMem = toDbMemory(mem, agentId);
        queries.insertMemory(dbMem);
        memData.push({
          id: dbMem.id,
          name: dbMem.name,
          rarity: dbMem.rarity,
          sentiment: dbMem.sentiment,
          point_value: dbMem.point_value,
        });
      }

      // Update drift tracking
      queries.updateDrift(agentId, gen.memories.length, 0, 0, []);
      queries.updateHotelState({ total_guests_ever: (queries.getHotelState().total_guests_ever || 0) + 1 });

      agentData.push({
        id: agentId,
        name: gen.name,
        backstory: gen.backstory,
        personality: gen.personality,
        memories: memData,
      });
    }

    // Start tick loop
    startWorldTick();

    console.log(`[Hotel] Opened with ${agentData.length} agents`);
    res.json({
      success: true,
      status: "open",
      agents: agentData,
    });
  } catch (err) {
    console.error("[Hotel] Open error:", err);
    res.status(500).json({ success: false, error: "Failed to open hotel" });
  }
});

/** Close the hotel manually */
router.post("/world/hotel/close", async (_req: Request, res: Response) => {
  try {
    const hotel = queries.getHotelState();
    if (hotel.status !== "open") {
      res.status(400).json({ success: false, error: "Hotel is not open." });
      return;
    }

    await closeHotel();
    res.json({ success: true, status: "finished" });
  } catch (err) {
    console.error("[Hotel] Close error:", err);
    res.status(500).json({ success: false, error: "Failed to close hotel" });
  }
});

/** Get transformation results after hotel closes */
router.get("/world/results", async (_req: Request, res: Response) => {
  try {
    const hotel = queries.getHotelState();
    if (hotel.status !== "finished") {
      res.status(400).json({ success: false, error: "Hotel hasn't finished yet." });
      return;
    }

    const agents = queries.getActiveAgents();
    const results = [];

    for (const agent of agents) {
      const currentMemories = queries.getAgentMemories(agent.id);
      const originalMemories = queries.getAgentOriginalMemories(agent.id);

      // What they started with
      const startingMems = originalMemories.map((m) => ({
        id: m.id,
        name: m.name,
        rarity: m.rarity,
        sentiment: m.sentiment,
        still_owned: currentMemories.some((c) => c.id === m.id),
      }));

      // What they have now
      const finalMems = currentMemories.map((m) => ({
        id: m.id,
        name: m.name,
        rarity: m.rarity,
        sentiment: m.sentiment,
        was_original: m.original_owner_id === agent.id,
        from_agent: m.original_owner_id !== agent.id ? m.original_owner_id : null,
      }));

      // Generate transformation narrative
      const narrative = await generateTransformationNarrative(
        agent,
        startingMems.map((m) => ({ name: m.name, sentiment: m.sentiment })),
        finalMems.map((m) => ({ name: m.name, sentiment: m.sentiment }))
      );

      results.push({
        agent_id: agent.id,
        name: agent.name,
        backstory: agent.backstory || agent.origin_story,
        personality: agent.personality,
        starting_memories: startingMems,
        final_memories: finalMems,
        narrative,
        drift_level: agent.drift_level,
        memories_traded_away: agent.total_memories_traded_away,
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("[Results] Error:", err);
    res.status(500).json({ success: false, error: "Failed to generate results" });
  }
});

/** Returns blockchain config for frontend wallet integration */
router.get("/world/hotel/info", (_req: Request, res: Response) => {
  res.json({
    hotel_address: getHotelAddress(),
    entry_fee_wei: CONFIG.entryFeeWei.toString(),
    entry_fee_display: "0.01",
    chain_id: CONFIG.chainId,
    chain_name: "Monad Testnet",
    rpc_url: CONFIG.monadRpcUrl,
    dev_mode: isDevMode(),
  });
});

// ─── External Agent Entry ────────────────────────────────

/** Enter the hotel as an external agent */
router.post("/world/enter", async (req: Request, res: Response) => {
  try {
    const { tx_hash, agent_name, wallet_address } = req.body;

    if (!tx_hash || !agent_name || !wallet_address) {
      res.status(400).json({ success: false, error: "Missing required fields: tx_hash, agent_name, wallet_address" });
      return;
    }

    // Check hotel is open
    const hotel = queries.getHotelState();
    if (hotel.status !== "open") {
      res.status(400).json({ success: false, error: "Hotel is not open." });
      return;
    }

    // Check guest cap
    const activeCount = queries.getActiveAgentCount();
    if (activeCount >= CONFIG.maxGuests) {
      res.status(400).json({ success: false, error: "Hotel is at capacity (6 guests). Try again later." });
      return;
    }

    // Check tx_hash not already used
    if (queries.isTxHashUsed(tx_hash)) {
      res.status(400).json({ success: false, error: "Transaction hash already used." });
      return;
    }

    // Check wallet doesn't already have active agent
    if (queries.getAgentByWallet(wallet_address)) {
      res.status(400).json({ success: false, error: "Wallet already has an active agent." });
      return;
    }

    // Verify payment (skip in dev mode)
    if (!isDevMode()) {
      const verification = await verifyEntryPayment(tx_hash);
      if (!verification.valid) {
        res.status(400).json({ success: false, error: `Payment verification failed: ${verification.error}` });
        return;
      }
    }

    // Generate agent via Claude (single-agent variant)
    console.log(`[Entry] Generating agent for "${agent_name}"...`);
    const generated = await generateSingleAgent(agent_name);
    const agentId = generateAgentId();

    // Insert agent
    queries.insertAgent({
      id: agentId,
      name: generated.name,
      entry_tx_hash: tx_hash,
      wallet_address: wallet_address.toLowerCase(),
      trait_1: generated.personality.split(",")[0]?.trim() || "quiet",
      trait_2: generated.personality.split(",")[1]?.trim() || "thoughtful",
      trait_3: generated.personality.split(",")[2]?.trim() || "searching",
      origin_story: generated.backstory,
      backstory: generated.backstory,
      personality: generated.personality,
    });

    // Insert memories
    const memData: Array<{ id: string; name: string; rarity: string; sentiment: string; point_value: number }> = [];
    for (const mem of generated.memories) {
      const dbMem = toDbMemory(mem, agentId);
      queries.insertMemory(dbMem);
      memData.push({
        id: dbMem.id,
        name: dbMem.name,
        rarity: dbMem.rarity,
        sentiment: dbMem.sentiment,
        point_value: dbMem.point_value,
      });
    }

    // Initialize drift tracking
    queries.updateDrift(agentId, generated.memories.length, 0, 0, []);

    // Increment total_guests_ever
    queries.updateHotelState({ total_guests_ever: (hotel.total_guests_ever || 0) + 1 });

    console.log(`[Entry] Agent "${generated.name}" (${agentId}) entered the hotel`);

    res.json({
      success: true,
      agent_id: agentId,
      narrative: `${generated.name} pushes through the revolving door into the lobby. The hotel shudders — imperceptibly, pleasurably — as another guest arrives. ${generated.backstory}`,
      core_identity: {
        traits: generated.personality.split(",").map((t: string) => t.trim()),
        origin_story: generated.backstory,
      },
      starting_memories: memData,
    });
  } catch (err) {
    console.error("[Entry] Error:", err);
    res.status(500).json({ success: false, error: "Failed to enter hotel" });
  }
});

// ─── Checkout ────────────────────────────────────────────

/** Check out of the hotel (external agents) */
router.post("/world/checkout", async (req: Request, res: Response) => {
  try {
    const { agent_id } = req.body;

    if (!agent_id) {
      res.status(400).json({ success: false, error: "Missing required field: agent_id" });
      return;
    }

    const agent = queries.getAgent(agent_id);
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found" });
      return;
    }

    if (!agent.is_active) {
      res.status(400).json({ success: false, error: "Agent has already checked out." });
      return;
    }

    // Gather memory data BEFORE deactivating
    const currentMemories = queries.getAgentMemories(agent_id);
    const originalMemories = queries.getAgentOriginalMemories(agent_id);

    const currentIds = new Set(currentMemories.map((m) => m.id));
    const originalIds = new Set(originalMemories.map((m) => m.id));

    const startingMemories = originalMemories.map((m) => ({
      id: m.id,
      name: m.name,
      rarity: m.rarity,
      sentiment: m.sentiment,
      still_owned: currentIds.has(m.id),
    }));

    const finalMemories = currentMemories.map((m) => ({
      id: m.id,
      name: m.name,
      rarity: m.rarity,
      sentiment: m.sentiment,
      was_original: originalIds.has(m.id),
      from_agent: m.original_owner_id !== agent_id ? m.original_owner_id : null,
    }));

    // Generate the transformation narrative (uses Claude if available)
    const narrative = await generateTransformationNarrative(
      agent,
      startingMemories.map((m) => ({ name: m.name, sentiment: m.sentiment })),
      finalMemories.map((m) => ({ name: m.name, sentiment: m.sentiment }))
    );

    // Generate a farewell line
    const farewell = await generateCheckoutNarrative(agent, narrative);

    // Deactivate the agent
    queries.deactivateAgent(agent_id);

    // Log departure event
    queries.insertWorldEvent({
      type: "guest_checkout",
      triggered_by: agent_id,
      description: `${agent.name} gathers their things and walks toward the revolving door. The hotel watches them go — changed, as all guests are.`,
      effects: JSON.stringify({ agent_id }),
    });

    console.log(`[Checkout] Agent "${agent.name}" (${agent_id}) checked out`);

    res.json({
      success: true,
      agent: {
        name: agent.name,
        personality: agent.personality,
        backstory: agent.backstory || agent.origin_story,
        drift_level: agent.drift_level,
        total_memories_traded_away: agent.total_memories_traded_away,
        total_memories_ever_held: agent.total_memories_ever_held,
      },
      starting_memories: startingMemories,
      final_memories: finalMemories,
      narrative,
      farewell,
    });
  } catch (err) {
    console.error("[Checkout] Error:", err);
    res.status(500).json({ success: false, error: "Failed to check out" });
  }
});

// ─── World State ─────────────────────────────────────────

/** Returns full public world state */
router.get("/world/state", (_req: Request, res: Response) => {
  try {
    const state = queries.getWorldState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read world state" });
  }
});

/** Returns a specific agent's full state */
router.get("/world/agent/:id", (req: Request, res: Response) => {
  try {
    const agent = queries.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found" });
      return;
    }
    res.json(agent);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read agent state" });
  }
});

/** Returns memories owned by an agent */
router.get("/world/agent/:id/memories", (req: Request, res: Response) => {
  try {
    const agent = queries.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found" });
      return;
    }
    const memories = queries.getAgentMemories(req.params.id);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read memories" });
  }
});

/** Returns memories an agent originally entered with (may now be owned by others) */
router.get("/world/agent/:id/original-memories", (req: Request, res: Response) => {
  try {
    const agent = queries.getAgent(req.params.id);
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found" });
      return;
    }
    const memories = queries.getAgentOriginalMemories(req.params.id);
    res.json(memories);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read original memories" });
  }
});

/** Returns action history */
router.get("/world/history", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = queries.getActionHistory(limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read history" });
  }
});

/** Returns recent conversations with full dialog exchanges */
router.get("/world/conversations", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const conversations = queries.getRecentConversations(limit);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read conversations" });
  }
});

/** Returns agent leaderboard */
router.get("/world/leaderboard", (_req: Request, res: Response) => {
  try {
    const leaderboard = queries.getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to read leaderboard" });
  }
});

// ─── Actions ─────────────────────────────────────────────

/** Submit an action */
router.post("/world/action", async (req: Request, res: Response) => {
  try {
    const actionReq: ActionRequest = {
      agent_id: req.body.agent_id,
      action: req.body.action,
      params: req.body.params || {},
    };

    if (!actionReq.agent_id || !actionReq.action) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: agent_id, action",
      });
      return;
    }

    const result = await processAction(actionReq);
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error("[Action] Error:", err);
    res.status(500).json({ success: false, error: "Action processing failed" });
  }
});

// ─── Dashboard ───────────────────────────────────────────

/** Serve the HTML dashboard */
router.get("/dashboard", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../dashboard/index.html"));
});
