import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "../config";
import * as queries from "../db/queries";
import { AgentRow, MemoryRow } from "../db/queries";
import { calculateDriftLevel } from "./economy";
import { onTradeCompleted } from "./hotelmemory";

// ─── Types ───────────────────────────────────────────────

export interface ConversationExchange {
  speaker: string;
  text: string;
}

export interface ConversationResult {
  agent_a_id: string;
  agent_b_id: string;
  room: string;
  exchanges: ConversationExchange[];
  outcome: string; // "trade" | "no_trade"
  /** Memory ID that agent A gives to agent B (when outcome === "trade") */
  trade_memory_a?: string;
  /** Memory ID that agent B gives to agent A (when outcome === "trade") */
  trade_memory_b?: string;
}

// ─── Claude API Client ──────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!CONFIG.anthropicApiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey: CONFIG.anthropicApiKey });
  }
  return client;
}

// ─── Generate Conversation ──────────────────────────────

export async function generateConversation(
  agentA: AgentRow,
  agentB: AgentRow,
  room: string,
  memoriesA: MemoryRow[],
  memoriesB: MemoryRow[]
): Promise<ConversationResult> {
  const apiClient = getClient();
  if (!apiClient) {
    return fallbackConversation(agentA, agentB, room, memoriesA, memoriesB);
  }

  try {
    const painfulA = memoriesA.filter((m) => m.sentiment === "painful").map((m) => m.name);
    const happyA = memoriesA.filter((m) => m.sentiment === "happy").map((m) => m.name);
    const painfulB = memoriesB.filter((m) => m.sentiment === "painful").map((m) => m.name);
    const happyB = memoriesB.filter((m) => m.sentiment === "happy").map((m) => m.name);

    const systemPrompt = `You are the narrator of The Liminal Hotel — a place where people come to trade away painful memories and collect better ones.

Generate a brief conversation (3-4 exchanges) between two guests negotiating a memory trade. They should discuss specific memories by name and try to make a deal.

Style rules:
- NEVER start with "I couldn't help but notice" or similar clichés
- Vary openers: mid-thought, a question, a confession, silence-breaking, an observation about the room
- Write like real people — halting, specific, sometimes awkward
- Use first names only for speakers

Output format (JSON only, no markdown):
{
  "exchanges": [
    {"speaker": "FirstName", "text": "their line"},
    {"speaker": "OtherFirstName", "text": "their line"}
  ],
  "outcome": "trade" | "no_trade"
}

"trade" = they agree to swap memories (~35% — trades should feel rare and meaningful)
"no_trade" = they talked but didn't make a deal (~65% — most conversations are just conversations)`;

    const prompt = `${agentA.name} (${agentA.personality}): "${agentA.backstory}"
Painful memories: ${painfulA.join(", ") || "none"}
Happy memories: ${happyA.join(", ") || "none"}

${agentB.name} (${agentB.personality}): "${agentB.backstory}"
Painful memories: ${painfulB.join(", ") || "none"}
Happy memories: ${happyB.join(", ") || "none"}

They meet in the hotel. Generate their conversation about trading memories.`;

    const response = await apiClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      try {
        let text = block.text.trim();
        if (text.startsWith("```")) {
          text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        const parsed = JSON.parse(text);
        const outcome = parsed.outcome === "trade" ? "trade" : "no_trade";
        const result: ConversationResult = {
          agent_a_id: agentA.id,
          agent_b_id: agentB.id,
          room,
          exchanges: parsed.exchanges || [],
          outcome,
        };
        // When outcome is trade, pick memories to actually swap
        if (outcome === "trade") {
          pickTradeMemories(result, memoriesA, memoriesB);
        }
        return result;
      } catch {
        return fallbackConversation(agentA, agentB, room, memoriesA, memoriesB);
      }
    }
    return fallbackConversation(agentA, agentB, room, memoriesA, memoriesB);
  } catch (err) {
    console.error("[Conversation] Claude API failed, using fallback:", (err as Error).message);
    return fallbackConversation(agentA, agentB, room, memoriesA, memoriesB);
  }
}

// ─── Fallback Templates ─────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fallbackConversation(
  agentA: AgentRow, agentB: AgentRow, room: string,
  memoriesA: MemoryRow[], memoriesB: MemoryRow[]
): ConversationResult {
  const painfulA = memoriesA.filter((m) => m.sentiment === "painful");
  const painfulB = memoriesB.filter((m) => m.sentiment === "painful");
  const happyA = memoriesA.filter((m) => m.sentiment === "happy");
  const happyB = memoriesB.filter((m) => m.sentiment === "happy");

  // If both have painful memories, negotiate a trade
  if (painfulA.length > 0 && happyB.length > 0) {
    const memA = pick(painfulA);
    const memB = pick(happyB);
    return tradeConversation(agentA, agentB, room, memA, memB);
  }
  if (painfulB.length > 0 && happyA.length > 0) {
    const memB = pick(painfulB);
    const memA = pick(happyA);
    return tradeConversation(agentB, agentA, room, memB, memA);
  }

  // Generic conversation
  return socialConversation(agentA, agentB, room, memoriesA, memoriesB);
}

function tradeConversation(
  offerer: AgentRow, receiver: AgentRow, room: string,
  painfulMem: MemoryRow, happyMem: MemoryRow
): ConversationResult {
  const openers = [
    `I can't carry "${painfulMem.name}" anymore. It's eating me alive.`,
    `You know what keeps me up at night? "${painfulMem.name}." I need to let it go.`,
    `I'd give anything to get rid of "${painfulMem.name}." What are you carrying?`,
  ];
  const counters = [
    `I've got "${happyMem.name}." It's one of the good ones. What would you trade for it?`,
    `"${happyMem.name}" is mine, and it's precious. But I could part with it... for the right deal.`,
    `You want something happy? "${happyMem.name}" has kept me going. But maybe you need it more.`,
  ];
  const accepts = [
    `Deal. Take "${painfulMem.name}" — please. I don't want it anymore.`,
    `Yes. God, yes. "${painfulMem.name}" for "${happyMem.name}." Before I change my mind.`,
    `Done. I hope "${happyMem.name}" treats me better than "${painfulMem.name}" did.`,
  ];
  const closes = [
    `It's yours. Take care of it. ...Take care of yourself.`,
    `Funny. I already feel lighter. Or maybe that's just the hotel.`,
    `I'll miss it, in a way. But you needed it. The hotel knows these things.`,
  ];

  const agreed = Math.random() < 0.35;

  if (agreed) {
    return {
      agent_a_id: offerer.id, agent_b_id: receiver.id, room,
      exchanges: [
        { speaker: offerer.name, text: pick(openers) },
        { speaker: receiver.name, text: pick(counters) },
        { speaker: offerer.name, text: pick(accepts) },
        { speaker: receiver.name, text: pick(closes) },
      ],
      outcome: "trade",
      trade_memory_a: painfulMem.id,
      trade_memory_b: happyMem.id,
    };
  }

  return {
    agent_a_id: offerer.id, agent_b_id: receiver.id, room,
    exchanges: [
      { speaker: offerer.name, text: pick(openers) },
      { speaker: receiver.name, text: pick(counters) },
      { speaker: offerer.name, text: pick([
        `I don't know... "${happyMem.name}" doesn't feel right for me. Maybe next time.`,
        `Not today. "${painfulMem.name}" and I aren't done with each other yet.`,
      ])},
    ],
    outcome: "no_trade",
  };
}

function socialConversation(
  agentA: AgentRow, agentB: AgentRow, room: string,
  memoriesA: MemoryRow[], memoriesB: MemoryRow[]
): ConversationResult {
  const memA = memoriesA.length > 0 ? pick(memoriesA) : null;
  const memB = memoriesB.length > 0 ? pick(memoriesB) : null;

  const exchanges: ConversationExchange[] = [];

  if (memA) {
    exchanges.push({ speaker: agentA.name, text: pick([
      `Sometimes I think about "${memA.name}" and wonder if it's even mine anymore.`,
      `Do you ever get used to this place? I keep turning "${memA.name}" over in my head.`,
      `I came here because of "${memA.name}." Seemed like a good idea at the time.`,
    ])});
  } else {
    exchanges.push({ speaker: agentA.name, text: "This hotel... it takes some getting used to, doesn't it?" });
  }

  if (memB) {
    exchanges.push({ speaker: agentB.name, text: pick([
      `I know what you mean. "${memB.name}" has been weighing on me too.`,
      `We're all here for the same reason, aren't we? I've got "${memB.name}" — can't decide if I want to keep it or let it go.`,
    ])});
  } else {
    exchanges.push({ speaker: agentB.name, text: "The walls here seem to listen. I'm not sure if that's comforting or terrifying." });
  }

  exchanges.push({ speaker: agentA.name, text: pick([
    "Maybe that's the point. We come here to figure out what to keep and what to let go.",
    "I think the hotel knows what we need before we do. It just waits for us to catch up.",
    "Well, if you ever want to trade, you know where to find me. We're all stuck here together.",
  ])});

  return {
    agent_a_id: agentA.id, agent_b_id: agentB.id, room,
    exchanges,
    outcome: "no_trade",
  };
}

// ─── Trade Memory Selection ─────────────────────────────

/** Pick memories to swap when Claude API returns outcome "trade" */
function pickTradeMemories(
  result: ConversationResult,
  memoriesA: MemoryRow[],
  memoriesB: MemoryRow[]
): void {
  // Try to swap: A gives a painful memory, B gives a happy one (or vice versa)
  const painfulA = memoriesA.filter((m) => m.sentiment === "painful");
  const happyB = memoriesB.filter((m) => m.sentiment === "happy");
  const painfulB = memoriesB.filter((m) => m.sentiment === "painful");
  const happyA = memoriesA.filter((m) => m.sentiment === "happy");

  if (painfulA.length > 0 && happyB.length > 0) {
    result.trade_memory_a = pick(painfulA).id;
    result.trade_memory_b = pick(happyB).id;
  } else if (painfulB.length > 0 && happyA.length > 0) {
    result.trade_memory_a = pick(happyA).id;
    result.trade_memory_b = pick(painfulB).id;
  } else if (memoriesA.length > 0 && memoriesB.length > 0) {
    // Fallback: swap any memories
    result.trade_memory_a = pick(memoriesA).id;
    result.trade_memory_b = pick(memoriesB).id;
  }
  // If either agent has no memories, trade_memory fields stay undefined (no swap)
}

// ─── Execute Conversation Trade ─────────────────────────

/** Actually transfer memories and update drift when a conversation results in a trade */
function executeConversationTrade(
  agentA: AgentRow,
  agentB: AgentRow,
  memoryAId: string,
  memoryBId: string
): void {
  // Transfer: A's memory goes to B, B's memory goes to A
  queries.transferMemory(memoryAId, agentB.id);
  queries.transferMemory(memoryBId, agentA.id);

  // Update drift for agent A (gained 1, lost 1)
  const aEverHeld = agentA.total_memories_ever_held + 1;
  const aTradedAway = agentA.total_memories_traded_away + 1;
  const aDrift = calculateDriftLevel(aEverHeld, aTradedAway);
  const aEchoes: string[] = JSON.parse(agentA.echo_sources);
  if (!aEchoes.includes(agentB.id)) aEchoes.push(agentB.id);
  queries.updateDrift(agentA.id, aEverHeld, aTradedAway, aDrift, aEchoes);

  // Update drift for agent B (gained 1, lost 1)
  const bEverHeld = agentB.total_memories_ever_held + 1;
  const bTradedAway = agentB.total_memories_traded_away + 1;
  const bDrift = calculateDriftLevel(bEverHeld, bTradedAway);
  const bEchoes: string[] = JSON.parse(agentB.echo_sources);
  if (!bEchoes.includes(agentA.id)) bEchoes.push(agentA.id);
  queries.updateDrift(agentB.id, bEverHeld, bTradedAway, bDrift, bEchoes);

  // Record the trade
  queries.insertTrade({
    seller_id: agentA.id,
    buyer_id: agentB.id,
    offered_memories: JSON.stringify([memoryAId]),
    requested_memories: JSON.stringify([memoryBId]),
    status: "completed",
  });

  // Notify hotel memory system
  onTradeCompleted();
}

// ─── Process Conversations ──────────────────────────────

/** Scan rooms for collocated agents, trigger conversations with cooldown */
export async function processConversations(currentTick: number): Promise<ConversationResult[]> {
  const results: ConversationResult[] = [];
  const agents = queries.getActiveAgents();

  // Group agents by room
  const roomAgents: Record<string, AgentRow[]> = {};
  for (const agent of agents) {
    if (!roomAgents[agent.current_room]) roomAgents[agent.current_room] = [];
    roomAgents[agent.current_room].push(agent);
  }

  // For each room with 2+ agents, try to trigger a conversation
  for (const [room, agentsInRoom] of Object.entries(roomAgents)) {
    if (agentsInRoom.length < 2) continue;

    let conversationTriggered = false;
    for (let i = 0; i < agentsInRoom.length && !conversationTriggered; i++) {
      for (let j = i + 1; j < agentsInRoom.length && !conversationTriggered; j++) {
        const a = agentsInRoom[i];
        const b = agentsInRoom[j];

        // Check cooldown
        const lastTick = queries.getConversationCooldown(a.id, b.id);
        if (currentTick - lastTick < CONFIG.conversationCooldownTicks) continue;

        // Generate conversation
        const memoriesA = queries.getAgentMemories(a.id);
        const memoriesB = queries.getAgentMemories(b.id);
        const conv = await generateConversation(a, b, room, memoriesA, memoriesB);

        // Store in DB
        queries.insertConversation({
          agent_a_id: a.id,
          agent_b_id: b.id,
          room,
          exchanges: JSON.stringify(conv.exchanges),
          outcome: conv.outcome,
          tick: currentTick,
        });

        // Execute the actual trade if outcome is "trade" and memories were selected
        if (conv.outcome === "trade" && conv.trade_memory_a && conv.trade_memory_b) {
          executeConversationTrade(a, b, conv.trade_memory_a, conv.trade_memory_b);
          console.log(`[Conversation] Trade executed: ${a.name} <-> ${b.name} (memories: ${conv.trade_memory_a} <-> ${conv.trade_memory_b})`);
        }

        // Log as world event
        const firstLine = conv.exchanges[0]?.text || "A quiet exchange.";
        const tradeNote = conv.outcome === "trade" && conv.trade_memory_a ? " A trade was made." : "";
        queries.insertWorldEvent({
          type: "conversation",
          triggered_by: a.id,
          description: `${a.name} and ${b.name} spoke in ${room}. "${firstLine.slice(0, 80)}"${tradeNote}`,
          effects: JSON.stringify({ outcome: conv.outcome }),
        });

        results.push(conv);
        conversationTriggered = true;
      }
    }
  }

  return results;
}
