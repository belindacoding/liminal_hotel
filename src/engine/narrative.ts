import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "../config";
import { AgentRow } from "../db/queries";

// ─── Claude API Client ──────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!CONFIG.anthropicApiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey: CONFIG.anthropicApiKey });
  }
  return client;
}

// ─── Narrative Context ───────────────────────────────────

export interface NarrativeContext {
  action: string;
  agent: AgentRow;
  location: string;
  outcome: Record<string, unknown>;
}

// ─── Generate Narrative ──────────────────────────────────

export async function generateNarrative(context: NarrativeContext): Promise<string> {
  // Use simple fallback narratives — save API calls for agent generation and conversations
  return fallbackNarrative(context);
}

// ─── Fallback Templates ──────────────────────────────────

const ROOM_NAMES: Record<string, string> = {
  lobby: "The Lobby",
  fireplace: "The Fireplace",
  rooftop: "The Rooftop",
  gallery: "The Gallery",
  wine_cellar: "The Wine Cellar",
  room_313: "The Library",
};

function resolveRoomName(roomId: string): string {
  return ROOM_NAMES[roomId] || roomId;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MOVE_TEMPLATES = [
  "{agent} walks to {location}. The hallway seems shorter than it should be.",
  "{agent} finds {location}. The hotel rearranges itself to accommodate.",
  "{agent} arrives at {location}, looking for someone to talk to.",
  "{agent} makes their way to {location}. The hotel watches, as always.",
];

const TRADE_TEMPLATES = [
  "Memories change hands in {location}. Both parties feel different.",
  "A trade is completed. Something shifts — not in the hotel, but in them.",
  "{agent} walks away from the exchange carrying something new. The weight is different.",
];

const CLAIM_TEMPLATES = [
  "{agent} reaches out and takes what the hotel left behind. It hums in their hands.",
  "The echo was waiting for someone. {agent} was the one who answered.",
  "{agent} claims a memory born from the hotel itself. It feels different from the others.",
  "In {location}, {agent} picks up something the walls produced. It pulses faintly.",
];

function fallbackNarrative(context: NarrativeContext): string {
  const roomName = resolveRoomName(context.location);
  let templates: string[];
  switch (context.action) {
    case "move":
      templates = MOVE_TEMPLATES;
      break;
    case "claim":
      templates = CLAIM_TEMPLATES;
      break;
    default:
      templates = TRADE_TEMPLATES;
      break;
  }

  return pick(templates)
    .replace(/\{agent\}/g, context.agent.name)
    .replace(/\{location\}/g, roomName);
}

// ─── Transformation Narrative ────────────────────────────

export async function generateTransformationNarrative(
  agent: AgentRow,
  startingMemories: { name: string; sentiment: string }[],
  finalMemories: { name: string; sentiment: string }[]
): Promise<string> {
  const apiClient = getClient();

  const startPainful = startingMemories.filter((m) => m.sentiment === "painful").map((m) => m.name);
  const finalPainful = finalMemories.filter((m) => m.sentiment === "painful").map((m) => m.name);
  const startHappy = startingMemories.filter((m) => m.sentiment === "happy").map((m) => m.name);
  const finalHappy = finalMemories.filter((m) => m.sentiment === "happy").map((m) => m.name);

  if (apiClient) {
    try {
      const response = await apiClient.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        system: "You write brief, grounded transformation summaries for hotel guests. 2-3 sentences max. No flowery language — honest and human.",
        messages: [{
          role: "user",
          content: `${agent.name} (${agent.personality}): "${agent.backstory}"
Entered carrying painful memories: ${startPainful.join(", ") || "none"}
Entered carrying happy memories: ${startHappy.join(", ") || "none"}
Leaves carrying painful memories: ${finalPainful.join(", ") || "none"}
Leaves carrying happy memories: ${finalHappy.join(", ") || "none"}

Write a brief summary of their transformation.`,
        }],
      });

      const block = response.content[0];
      if (block.type === "text") return block.text;
    } catch (err) {
      console.error("[Narrative] Transformation API failed:", (err as Error).message);
    }
  }

  // Fallback
  const tradedAway = startPainful.length - finalPainful.length;
  if (tradedAway > 0) {
    return `${agent.name} arrived weighed down by ${startPainful.length} painful memories. They traded ${tradedAway} of them away and leave carrying ${finalHappy.length} happy ones. The hotel did what it promised.`;
  }
  return `${agent.name} came to the hotel looking for change. Whether they found it depends on which memories they choose to keep.`;
}

// ─── Checkout Farewell Narrative ─────────────────────────

export async function generateCheckoutNarrative(
  agent: AgentRow,
  transformationSummary: string
): Promise<string> {
  const apiClient = getClient();

  if (apiClient) {
    try {
      const response = await apiClient.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        system: "You write brief, poetic farewell lines for guests leaving a mysterious hotel. One or two sentences. Cinematic, bittersweet. Second person ('you').",
        messages: [{
          role: "user",
          content: `Guest: ${agent.name} (${agent.personality}). Their transformation: ${transformationSummary}\n\nWrite a farewell as they step through the revolving door for the last time.`,
        }],
      });

      const block = response.content[0];
      if (block.type === "text") return block.text;
    } catch (err) {
      console.error("[Narrative] Checkout farewell API failed:", (err as Error).message);
    }
  }

  // Fallback
  return `The revolving door turns one final time. ${agent.name} steps through — lighter, heavier, different. The hotel watches them go and begins to forget.`;
}
