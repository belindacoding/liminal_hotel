import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { CONFIG } from "../config";
import { POINT_VALUES, Rarity, Sentiment } from "./economy";

// ─── Types ───────────────────────────────────────────────

export interface GeneratedAgent {
  name: string;
  backstory: string;
  personality: string;
  memories: GeneratedAgentMemory[];
}

export interface GeneratedAgentMemory {
  name: string;
  description: string;
  rarity: Rarity;
  sentiment: Sentiment;
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

// ─── Generate Agents ────────────────────────────────────

const SYSTEM_PROMPT = `You are a creative writing engine for a game called "The Liminal Hotel" — a mysterious place where unhappy people come to trade away their painful life memories and collect better ones.

Generate 4 hotel guests. Each guest should be a realistic, grounded person with a specific life situation that brought them here. They carry 8 memories — a mix of painful, happy, and neutral ones from their actual life.

Rules:
- Names should be realistic full names (first + last), diverse backgrounds
- Backstories should be 1-2 sentences, specific and grounded (not fantasy)
- Personality should be 2-3 descriptive words
- Each agent gets exactly 8 memories with this approximate distribution: 3 painful, 3 happy, 2 neutral
- Memories should be specific life events, not abstract concepts
- Rarity = emotional weight: legendary = life-defining, rare = significant, uncommon = notable, common = everyday
- Each agent should have 1-2 legendary/rare memories and the rest uncommon/common

Return ONLY valid JSON, no markdown:
{
  "agents": [
    {
      "name": "Full Name",
      "backstory": "A specific, grounded reason they're at the hotel...",
      "personality": "trait1, trait2, trait3",
      "memories": [
        { "name": "Short title", "description": "One sentence description", "rarity": "rare", "sentiment": "painful" },
        ...8 total
      ]
    },
    ...4 total
  ]
}`;

export async function generateAgents(): Promise<GeneratedAgent[]> {
  const apiClient = getClient();
  if (!apiClient) {
    console.log("[Generator] No API key, using fallback agents");
    return fallbackAgents();
  }

  try {
    const response = await apiClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: "Generate 3 guests for The Liminal Hotel. Make them diverse, interesting people with real human problems. Return JSON only." }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      // Try to extract JSON from the response
      let text = block.text.trim();
      // Strip markdown code fences if present
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(text);
      if (parsed.agents && Array.isArray(parsed.agents) && parsed.agents.length >= 3) {
        return parsed.agents.slice(0, 3).map(validateAgent);
      }
    }
    console.log("[Generator] API response didn't parse, using fallback");
    return fallbackAgents();
  } catch (err) {
    console.error("[Generator] Claude API failed:", (err as Error).message);
    return fallbackAgents();
  }
}

function validateAgent(raw: any): GeneratedAgent {
  const validRarities: Rarity[] = ["common", "uncommon", "rare", "legendary"];
  const validSentiments: Sentiment[] = ["painful", "happy", "neutral"];

  const memories = (raw.memories || []).slice(0, 8).map((m: any) => ({
    name: String(m.name || "A fading memory"),
    description: String(m.description || "Something half-remembered."),
    rarity: validRarities.includes(m.rarity) ? m.rarity : "common",
    sentiment: validSentiments.includes(m.sentiment) ? m.sentiment : "neutral",
  }));

  // Pad to 8 if needed
  while (memories.length < 8) {
    memories.push({
      name: "A moment half-remembered",
      description: "The details have faded but the feeling remains.",
      rarity: "common" as Rarity,
      sentiment: "neutral" as Sentiment,
    });
  }

  return {
    name: String(raw.name || "Unknown Guest"),
    backstory: String(raw.backstory || "They arrived without explanation."),
    personality: String(raw.personality || "quiet, guarded"),
    memories,
  };
}

/** Convert generated memory to DB-ready format */
export function toDbMemory(mem: GeneratedAgentMemory, ownerId: string) {
  return {
    id: `mem_${uuid().slice(0, 12)}`,
    owner_id: ownerId,
    original_owner_id: ownerId,
    rarity: mem.rarity,
    name: mem.name,
    description: mem.description,
    point_value: POINT_VALUES[mem.rarity],
    sentiment: mem.sentiment,
    found_in_room: "lobby",
  };
}

// ─── Generate Single Agent ──────────────────────────────

const SINGLE_AGENT_PROMPT = `You are a creative writing engine for a game called "The Liminal Hotel" — a mysterious place where unhappy people come to trade away their painful life memories and collect better ones.

Generate 1 hotel guest with the given name. The guest should be a realistic, grounded person with a specific life situation that brought them here. They carry 8 memories — a mix of painful, happy, and neutral ones from their actual life.

Rules:
- The name may be a real name, a nickname, a handle, or something abstract — work with whatever is given
- Backstory should be 1-2 sentences, specific and grounded (not fantasy)
- Personality should be 2-3 descriptive words
- Exactly 8 memories with this approximate distribution: 3 painful, 3 happy, 2 neutral
- Memories should be specific life events, not abstract concepts
- Rarity = emotional weight: legendary = life-defining, rare = significant, uncommon = notable, common = everyday
- 1-2 legendary/rare memories and the rest uncommon/common

Return ONLY valid JSON, no markdown:
{
  "name": "The Name Given",
  "backstory": "A specific, grounded reason they're at the hotel...",
  "personality": "trait1, trait2, trait3",
  "memories": [
    { "name": "Short title", "description": "One sentence description", "rarity": "rare", "sentiment": "painful" },
    ...8 total
  ]
}`;

export async function generateSingleAgent(name: string): Promise<GeneratedAgent> {
  const apiClient = getClient();
  if (!apiClient) {
    console.log("[Generator] No API key, using fallback for single agent");
    return fallbackSingleAgent(name);
  }

  try {
    const response = await apiClient.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SINGLE_AGENT_PROMPT,
      messages: [{ role: "user", content: `Generate a guest named "${name}" for The Liminal Hotel. Return JSON only.` }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      let text = block.text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(text);
      // Force the requested name
      parsed.name = name;
      return validateAgent(parsed);
    }
    console.log("[Generator] Single agent API response didn't parse, using fallback");
    return fallbackSingleAgent(name);
  } catch (err) {
    console.error("[Generator] Single agent Claude API failed:", (err as Error).message);
    return fallbackSingleAgent(name);
  }
}

function fallbackSingleAgent(name: string): GeneratedAgent {
  const personalities = [
    "quiet, observant, guarded",
    "warm, impulsive, regretful",
    "sharp, restless, tender",
    "stoic, precise, lonely",
  ];
  const backstories = [
    `${name} arrived carrying a suitcase full of things that belong to someone they used to be. The hotel seemed to recognize them.`,
    `${name} came looking for a memory they lost years ago. The hotel promised nothing but offered everything.`,
    `${name} checked in after a long journey from a place that no longer exists — at least, not the way they remember it.`,
    `${name} showed up at the front desk with no reservation and no explanation. The hotel had a room ready anyway.`,
  ];

  const fallbackMemories: GeneratedAgentMemory[] = [
    { name: "A door that wouldn't open", description: "They stood in front of it for an hour. It opened when they stopped trying.", rarity: "rare", sentiment: "painful" },
    { name: "The last good morning", description: "Sunlight through kitchen curtains, coffee brewing, the radio playing something familiar.", rarity: "uncommon", sentiment: "happy" },
    { name: "A promise broken quietly", description: "No argument, no scene. Just a text message that changed everything.", rarity: "rare", sentiment: "painful" },
    { name: "Learning to swim", description: "Cold lake water, a parent's steady hands, the moment of letting go.", rarity: "common", sentiment: "happy" },
    { name: "The empty apartment", description: "Moving day. Echoes in bare rooms. The marks on the wall where pictures used to hang.", rarity: "uncommon", sentiment: "painful" },
    { name: "A stranger's kindness", description: "Someone paid for their coffee on the worst day of their life. They never said thank you.", rarity: "common", sentiment: "happy" },
    { name: "Waiting for a phone call", description: "The phone sat on the table. Hours passed. It never rang.", rarity: "common", sentiment: "neutral" },
    { name: "The sound of rain on a tin roof", description: "A cabin somewhere. No agenda. Nothing to do but listen.", rarity: "common", sentiment: "neutral" },
  ];

  return {
    name,
    backstory: backstories[Math.floor(Math.random() * backstories.length)],
    personality: personalities[Math.floor(Math.random() * personalities.length)],
    memories: fallbackMemories,
  };
}

// ─── Fallback Agents ─────────────────────────────────────

function fallbackAgents(): GeneratedAgent[] {
  return [
    {
      name: "Diana Chen",
      backstory: "A burned-out emergency room surgeon who lost a patient she'd known since childhood. She hasn't slept well in two years.",
      personality: "precise, guilt-ridden, guarded",
      memories: [
        { name: "The surgery that went wrong", description: "A routine operation that became anything but. The beeping flatline still echoes.", rarity: "legendary", sentiment: "painful" },
        { name: "Learning to ride a bike with Dad", description: "Summer of '94, skinned knees, his hands steady on the handlebars.", rarity: "common", sentiment: "happy" },
        { name: "Medical school graduation", description: "Mom crying in the front row, the weight of the diploma meaning everything.", rarity: "uncommon", sentiment: "happy" },
        { name: "The night shift that never ended", description: "36 hours straight, three codes, two losses. Coffee tasted like pennies.", rarity: "rare", sentiment: "painful" },
        { name: "First successful solo surgery", description: "Hands steady, heart racing, the patient waking up and saying thank you.", rarity: "uncommon", sentiment: "happy" },
        { name: "The argument with her sister", description: "Words said at Thanksgiving that can't be unsaid. The empty chair at Christmas.", rarity: "rare", sentiment: "painful" },
        { name: "Morning coffee routine", description: "The French press, the specific mug, the five minutes of silence before the world starts.", rarity: "common", sentiment: "neutral" },
        { name: "Reading in the hospital garden", description: "Stolen moments between shifts, a paperback with a cracked spine.", rarity: "common", sentiment: "neutral" },
      ],
    },
    {
      name: "Marcus Webb",
      backstory: "A retired jazz musician whose hearing is failing. The music that defined his life is slowly going silent.",
      personality: "warm, melancholic, proud",
      memories: [
        { name: "The standing ovation at Blue Note", description: "New York, 1998. The crowd on their feet. The best night of his life.", rarity: "legendary", sentiment: "happy" },
        { name: "The diagnosis", description: "The audiologist's careful words. Progressive. Irreversible. The silence that followed.", rarity: "legendary", sentiment: "painful" },
        { name: "Teaching his daughter piano", description: "Her small fingers on the keys, getting 'Twinkle Twinkle' right for the first time.", rarity: "uncommon", sentiment: "happy" },
        { name: "His wife's laugh", description: "That specific laugh she had, the one that made strangers smile. Gone now, like her.", rarity: "rare", sentiment: "painful" },
        { name: "Playing in the rain", description: "Street corner in New Orleans, trumpet case open, rain coming down, not caring.", rarity: "uncommon", sentiment: "happy" },
        { name: "The last concert", description: "Missing a note he'd played perfectly ten thousand times. Knowing it was over.", rarity: "rare", sentiment: "painful" },
        { name: "Tuning the trumpet", description: "The ritual of it, the warm brass, the muscle memory that never fades.", rarity: "common", sentiment: "neutral" },
        { name: "Walking through the French Quarter", description: "The smells, the sounds, the way the light falls on Bourbon Street at dusk.", rarity: "common", sentiment: "neutral" },
      ],
    },
    {
      name: "Yuki Tanaka",
      backstory: "A software engineer who moved across the world for a job and lost touch with everyone she loved. Success never felt so empty.",
      personality: "analytical, lonely, dry-humored",
      memories: [
        { name: "The video call that froze", description: "Her mother mid-sentence, pixelated, then disconnected. She didn't call back.", rarity: "rare", sentiment: "painful" },
        { name: "Cherry blossoms with grandmother", description: "Hanami season, warm mochi, grandmother's hand in hers. Simple perfection.", rarity: "rare", sentiment: "happy" },
        { name: "The promotion email", description: "Senior engineer. Corner office. Nobody to tell who would really care.", rarity: "uncommon", sentiment: "painful" },
        { name: "Cooking with her college roommate", description: "Terrible pasta, good wine, laughing until 3 AM in a tiny kitchen.", rarity: "uncommon", sentiment: "happy" },
        { name: "First snowfall in a new country", description: "Standing outside her apartment, catching snowflakes, feeling like a child again.", rarity: "common", sentiment: "happy" },
        { name: "The unanswered letter", description: "She wrote it by hand. Three pages. Her friend never responded.", rarity: "uncommon", sentiment: "painful" },
        { name: "Debugging at 2 AM", description: "The glow of monitors, empty energy drink cans, the satisfaction of a fix.", rarity: "common", sentiment: "neutral" },
        { name: "The apartment with no photos", description: "Clean, efficient, modern. No pictures on the walls. Not even a plant.", rarity: "common", sentiment: "neutral" },
      ],
    },
  ];
}
