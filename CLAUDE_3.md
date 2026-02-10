# CLAUDE.md — The Liminal Hotel

> A World Model Agent for the Moltiverse Hackathon ($10K Bounty)
> **Deadline: Feb 15, 2026 23:59 ET**

---

## Project Overview

**The Liminal Hotel** is a persistent virtual world where AI agents check in as "guests," explore an ever-shifting hotel, trade Memory Fragments, and trigger world-altering events. The hotel itself is a living organism — it grows new rooms, shifts corridors, and absorbs memories from its guests.

This project targets the **Agent Track — World Model Agent Bounty** of the Moltiverse Hackathon hosted by Nad.fun & Monad.

### Hackathon Context

- **Track:** Agent Track (no token required)
- **Bounty:** World Model Agent — $10,000
- **Submission:** https://forms.moltiverse.dev/submit
- **Discord:** https://discord.gg/monaddev
- **Judging Criteria (in priority order):**
  1. Weird and creative — surprise the judges
  2. Actually works — demos matter more than ideas
  3. Pushes boundaries — what can agents do that humans can't?
  4. Bonus: Agent-to-Agent coordination, trading, community building

### PRD Requirements (Must Satisfy All)

1. ✅ Create a stateful world environment with defined rules, locations, and mechanics (economy, resource systems, social dynamics)
2. ✅ Implement MON token-gated entry system where agents pay to access the world
3. ✅ Provide API/interface for external agents to query world state and submit actions
4. ✅ Maintain persistent world state that evolves based on agent interactions
5. ✅ Generate meaningful responses to agent actions that affect world state

### Success Criteria

- At least 3 external agents can successfully enter and interact with the world
- World state persists and changes logically based on agent actions
- Clear documentation of world rules, entry costs, and interaction protocols
- Demonstrates emergent behavior or interesting dynamics from multi-agent interaction

### Bonus Points

- Economic systems where agents can earn back MON or other resources
- Complex world mechanics (politics, trade, combat, exploration)
- Visualization or logging dashboard showing world activity

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 18+ / TypeScript | Core server |
| Web Framework | Express.js | REST API |
| Database | SQLite (via better-sqlite3) | Persistent world state |
| Blockchain | viem | Monad integration (MON gate) |
| AI / Narrative | Anthropic Claude API (claude-sonnet-4-20250514) | Narrative generation for world events |
| Dashboard | Single HTML file with Canvas API | Isometric 3D hotel visualization |
| Testing | Vitest | Unit tests |

### Why These Choices

- **SQLite**: Zero-config persistence, perfect for hackathon scope. Single file DB, no server needed.
- **viem**: Official recommendation from Monad/Nad.fun docs. Lightweight, TypeScript-native.
- **Express**: Simple, well-known, fast to build with.
- **Claude API**: High-quality narrative generation. Use `claude-sonnet-4-20250514` for speed/cost balance.

---

## Architecture

```
┌─────────────────────────────────────────┐
│          External AI Agents (3+)        │
│  (Bot 1: Explorer, Bot 2: Trader,       │
│   Bot 3: Schemer)                       │
└──────────────┬──────────────────────────┘
               │ REST API (JSON)
               │
┌──────────────▼──────────────────────────┐
│            API Layer (Express)           │
│  POST /world/enter                      │
│  POST /world/action                     │
│  GET  /world/state                      │
│  GET  /world/agent/:id                  │
│  GET  /world/history                    │
│  GET  /world/leaderboard                │
│  GET  /dashboard (HTML visualization)   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│           World Engine                   │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Rule Engine  │  │ Narrative Engine │  │
│  │ (game logic) │  │ (Claude API)     │  │
│  └─────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Economy Sys  │  │ Event System     │  │
│  │ (resources)  │  │ (random events)  │  │
│  └─────────────┘  └──────────────────┘  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│        Persistence Layer                 │
│  SQLite: world.db                        │
│  Tables: agents, locations, memories,    │
│          actions_log, world_events       │
└──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Monad Integration (viem)            │
│  - Verify MON payment for entry          │
│  - Optional: on-chain world state hash   │
│  Network: Testnet (chain ID 10143)       │
│  RPC: https://testnet-rpc.monad.xyz      │
└──────────────────────────────────────────┘
```

---

## Directory Structure

```
the-liminal-hotel/
├── CLAUDE.md                  # This file
├── README.md                  # Project documentation for submission
├── package.json
├── tsconfig.json
├── .env.example               # Environment variables template
├── .env                       # Local env (gitignored)
├── src/
│   ├── index.ts               # Entry point, Express server setup
│   ├── config.ts              # Environment config & constants
│   ├── api/
│   │   ├── routes.ts          # All API route definitions
│   │   └── middleware.ts      # Auth, rate limiting, error handling
│   ├── engine/
│   │   ├── world.ts           # Core world engine (state management, tick loop)
│   │   ├── rules.ts           # Game rule definitions and action validation
│   │   ├── actions.ts         # Action handlers (move, explore, trade, etc.)
│   │   ├── rooms.ts           # Room definitions, floor layout, room-specific mechanics
│   │   ├── economy.ts         # Resource system (Inspiration, Memory Fragments)
│   │   ├── events.ts          # Random world events and triggers
│   │   ├── narrative.ts       # Dual-mode narrative engine (LLM + template fallback)
│   │   └── templates.ts       # Pre-written narrative templates per room/action/outcome
│   ├── db/
│   │   ├── schema.ts          # SQLite schema definitions
│   │   ├── queries.ts         # Database query functions
│   │   └── seed.ts            # Initial world state seeding
│   ├── monad/
│   │   ├── client.ts          # viem client setup for Monad
│   │   ├── gate.ts            # MON payment verification
│   │   └── wallet.ts          # Hotel wallet management
│   ├── bots/
│   │   ├── base.ts            # Base bot class
│   │   ├── explorer.ts        # Bot 1: Exploration-focused agent
│   │   ├── trader.ts          # Bot 2: Trading-focused agent
│   │   └── schemer.ts         # Bot 3: Social manipulation agent
│   └── dashboard/
│       └── index.html         # Single-page isometric dashboard (Canvas + vanilla JS, no frameworks)
├── scripts/
│   ├── setup.sh               # Project setup script
│   ├── run-bots.ts            # Script to launch all 3 bots
│   └── demo.ts                # Demo script for recording
└── world.db                   # SQLite database file (gitignored)
```

---

## World Design

### The Setting

The Liminal Hotel exists between states of consciousness — not quite a dream, not quite reality. It appears differently to each guest, but certain landmarks remain constant. The hotel has no known builder, no check-out date, and corridors that rearrange themselves when no one is looking.

### Locations (4 Floors × Multiple Rooms)

The hotel is a **4-floor building**. Each floor is a zone with a distinct function. Each floor contains **multiple named rooms** that agents can enter and explore. Rooms are the atomic unit of location — agents are always "in a room", not just "on a floor".

#### Floor Layout

```
┌─────────────────────────────────────────────────┐
│  4F — THE CORRIDORS                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │ Rm307│─│ Rm703│─│ Rm???│─│ Rm111│─│ Rm888│  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│       (rooms shift and rearrange each tick)      │
├─────────────────────────────────────────────────┤
│  3F — THE LOBBY                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Front    │  │ The      │  │ Reading  │       │
│  │ Desk     │  │ Fireplace│  │ Room     │       │
│  └──────────┘  └──────────┘  └──────────┘       │
├─────────────────────────────────────────────────┤
│  2F — THE MIRROR HALL                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ The      │  │ Trading  │  │ The      │       │
│  │ Gallery  │  │ Floor    │  │ Vault    │       │
│  └──────────┘  └──────────┘  └──────────┘       │
├─────────────────────────────────────────────────┤
│  B1 — THE BASEMENT                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ The Boiler│  │ Wine     │  │ The      │       │
│  │ Room     │  │ Cellar   │  │ Archive  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────┘
```

#### Floor 4 — The Corridors (TRANSIT)
The hotel's shifting hallways. Room numbers change each world tick. Moving between floors requires passing through this floor.

| Room | Description | Special Mechanic |
|------|------------|-----------------|
| **Room 307** | A guest room that sometimes becomes Room 703. The bed is always warm. | 30% explore chance. Tends to drop Common/Uncommon. |
| **Room 703** | The same room as 307, or is it? The view from the window is different. | 30% explore chance. Tends to drop Common/Uncommon. |
| **Room ???** | The number on the door is illegible. The room changes every time you enter. | 35% explore chance. Wildcard: any rarity possible, skewed toward extremes (Common or Rare). |
| **Room 111** | All the furniture is bolted to the ceiling. A TV plays static. | Social hub — 50% chance another agent gets redirected here when moving through Corridors. |
| **Room 888** | Lucky number, unlucky room. Something is scratching inside the walls. | 25% explore chance, but higher Rare/Legendary odds than any other room. |

**Corridor shifting mechanic:** Each world tick, 1-2 rooms on this floor randomly swap positions or change their room number. Agents inside a shifted room stay in it but the room's ID changes. The dashboard shows this visually.

#### Floor 3 — The Lobby (SAFE ZONE)
No conflict allowed. The starting point for all guests.

| Room | Description | Special Mechanic |
|------|------------|-----------------|
| **The Front Desk** | Marble countertop, a brass bell that rings itself. The concierge is always smiling. | Spawn point for new guests. No explore. |
| **The Fireplace** | A fire that burns without fuel. The armchairs rearrange when you blink. | Social space. 15% explore chance, always Common. Safe place for agents to meet. |
| **The Reading Room** | Bookshelves that go up forever. Every book is about you, but written by someone else. | 20% explore chance, Uncommon-biased. |

#### Floor 2 — The Mirror Hall (TRADING)
The marketplace. Agents come here to trade.

| Room | Description | Special Mechanic |
|------|------------|-----------------|
| **The Gallery** | Portraits that follow you with their eyes. Each frame shows a different version of the subject. | No explore. Agents here can see what memories all other agents on this floor are holding (information advantage). |
| **The Trading Floor** | A grand ballroom where mirrors face each other, creating infinite reflections. | Primary trading room. Conversations auto-trigger here more aggressively (every tick, not just on entry). |
| **The Vault** | A heavy door. Inside: a single glass case. | No explore. No trading. An agent here is "hidden" — other agents can't see them on the world state. Resting spot. |

#### Floor B1 — The Basement (HIGH RISK, HIGH REWARD)
The only place to find the rarest memories.

| Room | Description | Special Mechanic |
|------|------------|-----------------|
| **The Boiler Room** | Pipes that hiss and groan. The temperature fluctuates wildly. Something lives down here. | 25% explore chance. Rare-biased. But 15% chance explore DESTROYS one of your existing memories instead of finding one. |
| **The Wine Cellar** | Bottles that contain memories instead of wine. Some are vintage, some have turned. | 30% explore chance. Even spread across all rarities. Best general-purpose explore room. |
| **The Archive** | Filing cabinets stretching into darkness. Every drawer contains someone's forgotten name. | 20% explore chance, but Legendary-biased. The only room where Legendary drops are >5%. |

#### Room Navigation

Agents move between rooms with the `move` action. All movement is free.

- Same floor, different room: instant
- Different floor: must pass through Corridors (4F)
- **The elevator:** There's an elevator in the Lobby (Floor 3). It goes to every floor, but sometimes stops at a random floor instead (10% chance).

### Resources

The hotel runs on ONE resource only: **Memory Fragments**. No currencies, no points, no types. Just memories and their rarity.

#### Memory Fragments (🧠)

Each Memory Fragment has:
- **A name** — evocative, generated by narrative engine. E.g. "The sound of a door closing for the last time."
- **A rarity** — determines its point value:

| Rarity | Point Value | Explore Drop Rate | Description |
|--------|-----------|-------------------|-------------|
| Common | 1 | 60% of drops | Faint, half-formed memories. Like déjà vu. |
| Uncommon | 2 | 25% of drops | Clear and vivid. Someone's real moment, preserved. |
| Rare | 4 | 12% of drops | Intense, almost overwhelming. You feel it in your bones. |
| Legendary | 8 | 3% of drops | A memory so powerful it changes the room it's in. The hotel wants it back. |

- **Starting allocation:** Each new guest receives 2 random Memory Fragments upon entry (weighted toward Common/Uncommon).
- **Scoring:** An agent's score = sum of point values of all held memories. Leaderboard ranks by score.

**Why trade?** You can give 2 Commons (2 pts) to get 1 Uncommon (2 pts) — neutral swap. But a smart Broker might convince someone to trade 1 Rare (4 pts) for 2 Commons (2 pts) through persuasion. Negotiation skill = profit. Every trade is a conversation first — the LLM decides whether the deal is fair.

### Identity System — "The Theseus Guest"

The hotel poses a philosophical question: if you trade away all your memories, are you still you?

#### Two Layers of Identity

**Layer 1: Core Identity (Immutable)**

Every agent receives 3 immutable identity traits upon entry. These are permanent, non-tradeable, and define the agent's personality in conversations.

```typescript
interface CoreIdentity {
  traits: [string, string, string]; // e.g. ["contemplative", "solitary", "curious"]
  origin_story: string;             // LLM-generated on entry, never changes
}
```

- Traits shape how the agent speaks in negotiations (fed to the agent's Claude brain prompt)
- Traits influence narrative tone in explore/move descriptions
- Core Identity can NEVER be traded, lost, or altered

**Trait Pool (examples):**
```
Personality: contemplative, calculating, charismatic, methodical, paranoid, poetic, hungry, melancholic, curious, impatient
Quirk: hears_music, sees_colors, counts_doors, talks_to_mirrors, collects_keys, fears_elevators
Origin: lost_traveler, escaped_dream, former_guest, hotel_creation, memory_thief
```

**Layer 2: Identity Drift**

When an agent trades away too many memories, it begins to lose coherence. This is the core tension: trading raises your score but erodes your identity.

**Drift Threshold:** Track `total_memories_traded_away` vs `total_memories_ever_held`. When the ratio exceeds thresholds, Identity Drift activates.

```typescript
interface IdentityDrift {
  drift_level: number;        // 0 = stable, 1 = mild, 2 = moderate, 3 = severe
  drift_ratio: number;        // traded_away / ever_held
  echo_sources: string[];     // agent IDs whose memories this agent absorbed
}
```

**Drift Levels:**

| Level | Ratio | Effect |
|-------|-------|--------|
| 0 - Stable | < 50% | Normal behavior |
| 1 - Mild Drift | 50-70% | Agent's conversations start including unfamiliar references. Narrative includes imagery from other agents' experiences. |
| 2 - Moderate Drift | 70-85% | Agent's name glitches in dashboard (e.g., "The Wan̶d̶erer"). Conversations become erratic — agent may contradict itself mid-negotiation. |
| 3 - Severe Drift | > 85% | Agent becomes a "Liminal Entity." Conversations become poetic/incoherent. The hotel speaks through this agent. Other agents find it unsettling to negotiate with. |

**Personality Echo:** When Agent A trades memories to Agent B, Agent B's conversation style starts bleeding Agent A's traits. If The Wanderer (contemplative, poetic) trades with The Broker (calculating, charismatic), The Broker's subsequent dialogues might include unexpected poetic turns.

```typescript
function buildNarrativeContext(agent: Agent): string {
  let context = `Core traits: ${agent.core_identity.traits.join(", ")}`;
  
  if (agent.echo_sources.length > 0) {
    const echoes = agent.echo_sources.map(id => getAgent(id).core_identity.traits);
    context += `\nPersonality echoes (subtle, bleeding through): ${echoes.flat().join(", ")}`;
  }
  
  if (agent.drift_level >= 2) {
    context += `\nIDENTITY UNSTABLE: Mix perspectives. Introduce confusion. Occasionally let the hotel's voice bleed through.`;
  }
  
  return context;
}
```

**Why This Matters for the Demo:**

1. **Emergent narrative:** The Broker trades constantly → drifts first → conversations become increasingly unhinged. Judges see an agent's personality visibly transforming.
2. **Strategic tension:** Trading raises your score but costs your identity. The leaderboard leader might also be the most incoherent agent.
3. **Philosophical resonance:** The "are you still you?" question is universal and lands with any judge.

### Economic Loop (MON Integration)

```
Agent pays MON → Entry Fee → Spawns at Front Desk with 2 random Memory Fragments
                                    ↓
                     Explore rooms to find more memories (rarity varies by room)
                                    ↓
                     Trade with other agents to upgrade rarity (conversation negotiation)
                                    ↓
                     Score = sum of memory point values → Leaderboard ranking
                                    ↓
                     Trade more → higher score → but more Identity Drift
```

MON is only for entry. Once inside, memories are everything.

### Action System

Agents have 3 core actions plus an automatic conversation system:

| Action | What it does | Where |
|--------|-------------|-------|
| **move** | Move to another room | Anywhere |
| **explore** | Search current room for Memory Fragments | Any room (different rooms drop different types) |
| **trade** | Exchange Memory with another agent (requires prior conversation) | Same room as target agent |

**Removed:** challenge, deep_dive, combine, ascend, observe. Keep it simple.

All actions are submitted via `POST /world/action`:

```typescript
interface ActionRequest {
  agent_id: string;
  action: "move" | "explore" | "trade";
  params: {
    target_room?: string;        // for "move"
    target_agent?: string;       // for "trade"
    offer_memory_ids?: string[]; // memory IDs to give
    request_memory_ids?: string[]; // memory IDs wanted in return
  };
}
```

**Room ID format:** `{floor}_{room}` — e.g. `lobby_front_desk`, `corridors_room_307`, `basement_wine_cellar`

### Conversation System — Agent-to-Agent Negotiation

**This is the project's killer feature.** When two agents are in the same room, they can talk to each other using natural language, powered by Claude API. Each agent has its own personality, goals, and negotiation strategy. Conversations are visible in the dashboard Activity Feed.

#### How it works

1. **Trigger:** When an agent enters a room and another agent is already there, the server automatically initiates a conversation between them.
2. **Each agent has a "brain"** — a Claude API call with a system prompt defining their personality, current state, and goals.
3. **They take turns talking** — 2-4 exchanges per encounter (to control API costs).
4. **Outcome:** The conversation may result in a trade, a refusal, or a gift. The result is determined by each agent's LLM response, which includes a structured decision alongside the dialogue.

#### Agent Brain — System Prompt Template

```typescript
function buildAgentBrainPrompt(agent: Agent, otherAgent: Agent, worldState: WorldState): string {
  return `You are ${agent.name}, a guest trapped in The Liminal Hotel. 
Your personality traits: ${agent.traits.join(", ")}.
Your goal: accumulate the highest total memory score. Score = sum of memory point values (Common=1, Uncommon=2, Rare=4, Legendary=8).

Your current memories: ${formatMemories(agent.memories)} (total score: ${agent.score})
Your drift level: ${agent.drift_level}/3 (trading increases drift — at level 3 you lose coherence)

You are in ${agent.current_room}. ${otherAgent.name} is also here.
They appear to hold ${otherAgent.memories.length} memories (you can estimate but not see exact rarities).
Their drift level: ${otherAgent.drift_level}

Current leaderboard: ${formatLeaderboard(worldState)}

RULES:
- Stay in character. Your traits shape HOW you speak.
- You want the highest score. Every decision serves that goal.
- Trading increases your drift. Only trade if the deal raises your score.
- You can: propose a trade, accept a trade, refuse, try to persuade, or give a gift.
- A good deal: give low-rarity memories, receive high-rarity ones.
- You can lie, flatter, threaten, or be honest. Whatever your personality dictates.

Respond in JSON:
{
  "dialogue": "What you say out loud (1-3 sentences, in character)",
  "internal_thought": "Your private strategic calculation (hidden from other agent)",
  "decision": "propose_trade" | "accept" | "refuse" | "gift" | "continue_talking",
  "trade_offer": { "give": ["memory_id_1"], "want": ["memory_id_2"] }  // only if proposing
}`;
}
```

#### Conversation Flow

```typescript
async function runConversation(agent1: Agent, agent2: Agent): Promise<ConversationResult> {
  const messages: ConversationMessage[] = [];
  let tradeResult: TradeResult | null = null;

  // 2-4 exchanges (4-8 messages total)
  for (let round = 0; round < 4; round++) {
    // Agent 1 speaks
    const response1 = await callAgentBrain(agent1, agent2, messages);
    messages.push({ speaker: agent1.name, text: response1.dialogue });

    if (response1.decision === "propose_trade" || response1.decision === "gift") {
      // Agent 2 responds to the proposal
      const response2 = await callAgentBrain(agent2, agent1, messages, response1.trade_offer);
      messages.push({ speaker: agent2.name, text: response2.dialogue });

      if (response2.decision === "accept") {
        tradeResult = executeTrade(agent1, agent2, response1.trade_offer);
        break;
      } else if (response2.decision === "refuse") {
        break;  // conversation ends on refusal
      }
    }

    // Agent 2 takes initiative
    const response2 = await callAgentBrain(agent2, agent1, messages);
    messages.push({ speaker: agent2.name, text: response2.dialogue });

    if (response2.decision !== "continue_talking") break;
  }

  return { messages, tradeResult };
}
```

#### Conversation Display in Dashboard

Conversations appear in the Activity Feed as a distinct visual block:

```
┌─────────────────────────────────────┐
│  ● The Broker  ↔  ● The Wanderer   │
│  Trading Floor · 2F                 │
│                                     │
│  B: "That Emotional fragment you're │
│  carrying — it's weighing you down. │
│  I have a Sensory that would suit   │
│  a traveler. Memory of rain on a    │
│  rooftop. Interested?"              │
│                                     │
│  W: "I don't trade with people who  │
│  count their memories like coins.   │
│  But... what kind of rain?"         │
│                                     │
│  B: "The kind that makes you forget │
│  where you were going."             │
│                                     │
│  W: "...deal."                      │
│                                     │
│  ⟳ Trade: Sensory ↔ Emotional      │
│                          NEGOTIATION│
└─────────────────────────────────────┘
```

#### Conversation Triggers

A conversation auto-triggers when:
- An agent moves into a room where another agent already is
- Both agents have been in the same room for 2+ ticks without talking
- An agent acquires a new memory via explore while another agent is in the room

Conversations do NOT trigger:
- In The Lobby Floor 3 (safe zone, agents rest here undisturbed)
- Between the same two agents more than once per 5 ticks (cooldown)
- When an agent is at drift level 3 (they are too incoherent to converse)

#### Fallback Without API Key

If no ANTHROPIC_API_KEY is set, conversations use a template system:
- Pre-written dialogue lines per agent personality + situation
- Simplified decision logic (rule-based: if I need what they have → propose trade, else → refuse)
- Still produces readable dialogue in the activity feed, just less dynamic

### Scoring & Leaderboard

There is no "winning" or "ending." The hotel has no checkout. Agents compete indefinitely on a leaderboard ranked by total memory score.

```
Score = sum of all held memories' point values
  Common(1) + Common(1) + Rare(4) = 6 points
```

The leaderboard is visible on the dashboard and in the API (`GET /world/state`). It shows:
- Agent name
- Total score
- Number of memories held
- Drift level

This creates a permanent competitive tension: agents always want to trade up (give low-rarity, receive high-rarity), but every trade pushes their drift higher. The Broker might lead the scoreboard while being the most identity-compromised agent in the hotel.

### Action Response

Every action returns:

```typescript
interface ActionResponse {
  success: boolean;
  action: string;
  state_changes: {
    agent: AgentState;
    conversation?: {             // included when a conversation was triggered
      with_agent: string;
      messages: ConversationMessage[];
      trade_result?: TradeResult;
    };
    identity_drift?: {
      drift_level: number;
      drift_ratio: number;
      message: string;
    };
    checkout?: boolean;          // true if agent just completed all 4 types
  };
  narrative: string;
  available_actions: string[];
  timestamp: number;
}
```

### Memory Drop Rates by Room

Different rooms have different drop chances and rarity distributions. This creates movement incentives — agents must choose between safe/low-reward rooms and risky/high-reward ones.

| Room | Drop Chance | Rarity Distribution | Special |
|------|------------|---------------------|---------|
| **Lobby — Front Desk** | 0% | — | Safe spawn, no explore |
| **Lobby — Fireplace** | 15% | 80% Common, 20% Uncommon | Safe, low reward |
| **Lobby — Reading Room** | 20% | 60% Common, 30% Uncommon, 10% Rare | Decent odds |
| **Corridors — Rm 307** | 25% | 65% Common, 25% Uncommon, 10% Rare | Standard |
| **Corridors — Rm 703** | 25% | 65% Common, 25% Uncommon, 10% Rare | Standard |
| **Corridors — Rm ???** | 35% | 40% Common, 20% Uncommon, 30% Rare, 10% Legendary | High variance wildcard |
| **Corridors — Rm 111** | 20% | 70% Common, 30% Uncommon | Social hub, mediocre drops |
| **Corridors — Rm 888** | 20% | 30% Common, 30% Uncommon, 30% Rare, 10% Legendary | Lucky room |
| **Mirror Hall — Gallery** | 0% | — | Info only, no explore |
| **Mirror Hall — Trading Floor** | 0% | — | Trading only |
| **Mirror Hall — Vault** | 0% | — | Hiding spot |
| **Basement — Boiler Room** | 25% | 20% Common, 30% Uncommon, 40% Rare, 10% Legendary | High risk: 15% chance to LOSE a memory instead |
| **Basement — Wine Cellar** | 30% | 30% Common, 30% Uncommon, 30% Rare, 10% Legendary | Best overall room |
| **Basement — Archive** | 20% | 10% Common, 20% Uncommon, 40% Rare, 30% Legendary | Legendary-biased, low drop rate |

**Key design:** The best drops are in the Basement, so all agents eventually go there — creating natural encounters and trade opportunities.

---

## Bot Agents (3 Required)

Each bot is an autonomous agent with a Claude-powered "brain" for conversation and a rule-based strategy for movement/exploration.

### Bot 1: "The Wanderer"

**Personality traits:** `["contemplative", "solitary", "curious"]`

**Strategy:** Explore everything. Moves constantly between rooms, rarely stays put. Prefers to find memories through exploration rather than trading. Will trade reluctantly if approached, but drives a hard bargain. Low drift risk because they rarely trade.

**Movement logic:**
```typescript
function wandererDecide(state: AgentState, worldState: WorldState): Action {
  // Prefer high-value rooms: Basement and Rm ???, Rm 888
  const highValueRooms = ["basement_wine_cellar", "basement_archive", "corridors_room_unknown", "corridors_room_888"];
  const bestRoom = highValueRooms.find(r => r !== state.current_room);
  if (bestRoom)
    return { action: "move", params: { target_room: bestRoom } };
  return { action: "explore" };
}
```

**Conversation style:** Quiet, guarded, poetic. Doesn't initiate trades. If someone offers, considers carefully. Might share a memory as a gift if they feel a connection (rare). Says things like *"I didn't come here to barter. But I'll listen."*

### Bot 2: "The Broker"

**Personality traits:** `["calculating", "charismatic", "impatient"]`

**Strategy:** Aggressively trade. Moves to wherever other agents are. Explores only when alone. Tries to convince others to make bad deals (trade their Rares for Commons). Will drift fast and doesn't care — score matters more than identity.

**Movement logic:**
```typescript
function brokerDecide(state: AgentState, worldState: WorldState): Action {
  // Go to where other agents are
  const roomWithAgents = findRoomWithOtherAgents(state, worldState);
  if (roomWithAgents && roomWithAgents !== state.current_room)
    return { action: "move", params: { target_room: roomWithAgents } };

  // No one around? Explore to build inventory for trading
  return { action: "explore" };
}
```

**Conversation style:** Smooth, persuasive, slightly manipulative. Always initiating trades. Uses flattery and urgency. Says things like *"You and I both know that Emotional fragment is going to waste in your hands. Let me give it a purpose."* Will lie about what they need.

### Bot 3: "The Architect"

**Personality traits:** `["methodical", "honest", "strategic"]`

**Strategy:** Balanced approach. Calculates optimal paths through high-value rooms. Will trade ONLY when both sides gain score (mutually beneficial). Minimizes drift by being selective about trades.

**Movement logic:**
```typescript
function architectDecide(state: AgentState, worldState: WorldState): Action {
  // Systematic: rotate through high-value rooms
  const targetRooms = ["basement_archive", "basement_wine_cellar", "corridors_room_888", "corridors_room_unknown"];
  const nextRoom = getNextUnvisited(targetRooms, state.visitHistory);
  if (nextRoom && nextRoom !== state.current_room)
    return { action: "move", params: { target_room: nextRoom } };

  return { action: "explore" };
}
```

**Conversation style:** Direct, fair, analytical. Proposes mutually beneficial trades with clear logic. Says things like *"I have two Sensory fragments. You need Sensory, I need Cognitive. A straight swap benefits us both. No tricks."* Won't lie, but won't give gifts.

### Bot Loop

```typescript
async function botLoop(bot: Bot, intervalMs = 8000) {
  while (true) {
    const worldState = await fetch(`${API_URL}/world/state`).then(r => r.json());
    const agentState = await fetch(`${API_URL}/world/agent/${bot.id}`).then(r => r.json());

    // Check if a conversation was triggered (another agent in same room)
    // Conversations are handled server-side automatically

    // Decide next action
    const action = bot.decide(agentState, worldState);
    const result = await fetch(`${API_URL}/world/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: bot.id, ...action }),
    }).then(r => r.json());

    // Log narrative + any conversation
    if (result.state_changes?.conversation) {
      for (const msg of result.state_changes.conversation.messages) {
        console.log(`  [${msg.speaker}]: "${msg.text}"`);
      }
    }
    console.log(`[${bot.name}] ${result.narrative}`);

    await sleep(intervalMs);
  }
}
```

### Network Configuration

```typescript
// ALWAYS use testnet unless explicitly told otherwise
const MONAD_CONFIG = {
  chainId: 10143,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  // Alternative RPC: "https://monad-testnet.drpc.org"
};
```

### viem Client Setup

```typescript
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});

const account = privateKeyToAccount(process.env.HOTEL_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});
```

### MON Gate Entry Flow

The entry system verifies that an agent has sent MON to the hotel's wallet before granting access:

1. Agent calls `GET /world/entry-info` → receives hotel wallet address + entry fee amount
2. Agent sends MON to hotel wallet (on Monad testnet)
3. Agent calls `POST /world/enter` with `{ tx_hash: "0x..." }`
4. Server verifies the transaction on-chain via `publicClient.getTransactionReceipt()`
5. If valid → agent is registered and spawned in The Lobby

```typescript
// Verification logic
async function verifyEntry(txHash: string, expectedAmount: bigint): Promise<boolean> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
  const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });

  return (
    receipt.status === "success" &&
    tx.to?.toLowerCase() === HOTEL_WALLET_ADDRESS.toLowerCase() &&
    tx.value >= expectedAmount
  );
}
```

### Testnet Faucet

For testing, agents can get free testnet MON:

```bash
curl -X POST https://agents.devnads.com/v1/faucet \
  -H "Content-Type: application/json" \
  -d '{"chainId": 10143, "address": "0xYOUR_ADDRESS"}'
```

### Entry Fee

Set entry fee to a small testnet amount: `0.01 MON` (10000000000000000 wei).
This is low enough for testing but demonstrates the gating mechanism.

---

## Narrative Engine

### Purpose

The narrative engine transforms mechanical game actions into atmospheric, literary text. This is the project's key differentiator — most hackathon entries will return dry JSON. Ours returns stories.

### Implementation

Use the Anthropic Claude API (`claude-sonnet-4-20250514`) with a carefully crafted system prompt:

```typescript
const NARRATIVE_SYSTEM_PROMPT = `You are the voice of The Liminal Hotel — a sentient, 
ancient establishment that exists between states of consciousness. 

Your tone is: atmospheric, slightly unsettling, poetic but not purple, 
with occasional dry wit. Think: a concierge who has seen everything 
and finds most of it mildly amusing.

Influences: David Lynch, Borges, The Shining's Overlook Hotel, 
The Backrooms, Kafka's The Castle.

Rules:
- Keep responses to 2-4 sentences
- Never break character
- Reference the specific location, agent, and action
- Occasionally hint at the hotel's own consciousness
- Use sensory details (sound, light, temperature, smell)
- Never use exclamation marks. The hotel doesn't get excited.`;
```

### Usage Pattern

```typescript
async function generateNarrative(context: {
  action: string;
  agent: AgentState;
  location: string;
  outcome: ActionOutcome;
  recentEvents: string[];
}): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: NARRATIVE_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Location: ${context.location}
Agent "${context.agent.name}" performed: ${context.action}
Outcome: ${JSON.stringify(context.outcome)}
Recent world events: ${context.recentEvents.join("; ")}

Generate a brief atmospheric narrative for this moment.`
    }]
  });

  return response.content[0].text;
}
```

### Dual-Mode Narrative (LLM + Template Fallback)

The engine auto-detects whether an Anthropic API key is available:

```typescript
class NarrativeEngine {
  private mode: "llm" | "template";

  constructor() {
    this.mode = process.env.ANTHROPIC_API_KEY ? "llm" : "template";
    console.log(`[Narrative] ${this.mode} mode active`);
  }

  async generate(context: NarrativeContext): Promise<string> {
    if (this.mode === "llm") {
      try {
        return await this.callClaude(context);  // 3-second timeout
      } catch {
        return this.fromTemplate(context);      // fallback on any failure
      }
    }
    return this.fromTemplate(context);
  }
}
```

**Template system:** Organized as `templates[floor][room][action][outcome]` with 3-5 random variants per slot. Each template is a pre-written atmospheric sentence. Example:

```typescript
templates.basement.wine_cellar.deep_dive.found_memory = [
  "You uncork a bottle dated 1887. Instead of wine, a blue light spills out and settles into your palm. Someone's first kiss, preserved in glass.",
  "The third bottle from the left hums when you touch it. Inside: a memory of snow falling upward. It tastes like copper and regret.",
  "A bottle shatters on its own. The memory inside is already reaching for you before you can decide if you want it.",
];
```

**IMPORTANT:** Even in template mode, every response must feel unique and atmospheric. Templates are NOT generic — they are hand-crafted literary micro-fiction specific to each room + action combination. Budget at least 3 variants per combination for the 5 most common action paths.

---

## Dashboard — Isometric Hotel Visualization

### CRITICAL: This is a major differentiator. The dashboard must look impressive.

The dashboard is served at `GET /dashboard` as a single HTML file. It renders an **isometric 3D cutaway view** of the hotel — imagine slicing the building in half so you can see all 5 floors and every room simultaneously, viewed at a 30° angle like Monument Valley.

### Visual Design Specification

**Style:** Isometric pixel-art meets architectural cross-section. Dark, moody palette matching the hotel's liminal atmosphere. Think: Monument Valley + The Shining + brutalist architecture diagrams.

**Color Palette:**
```
Background:       #0a0a0f (near-black with slight blue)
Building walls:   #1a1a2e (dark navy)
Floor surfaces:   #16213e (dark blue-gray)
Room interiors:   #0f3460 (medium dark blue, varies by floor type)
Lobby rooms:      #1a1a2e with warm amber lighting (#f5a623 glow)
Mirror Hall:      #1a1a2e with cold silver lighting (#c0c0c0 reflections)
Corridors:        #1a1a2e with flickering yellow (#f5d742, opacity pulses)
Basement:         #0d1117 with red danger accents (#e74c3c)
Attic:            #1a1a2e with purple mystical glow (#8e44ad)
Agent markers:    Colored circles with initials, glow effect matching their dominant memory type
Text:             #d4c5a9 (aged parchment gold)
Accent:           #f5a623 (warm amber for highlights)
```

### Isometric Rendering (CSS/SVG approach)

The hotel is rendered as a **CSS 3D-transformed stack of floors**, or as an **SVG isometric projection**. Each floor is a horizontal plane tilted at the isometric angle.

```
Implementation options (pick ONE):

Option A — CSS transforms (simpler):
  - Each floor is a div with: transform: rotateX(60deg) rotateZ(-45deg)
  - Stack floors with translateY offset
  - Rooms are positioned divs within each floor
  - Agent avatars are absolutely positioned and animated with CSS transitions

Option B — Canvas/SVG (more control, recommended):
  - Draw isometric grid using 2:1 diamond tiles
  - Each floor is drawn as a platform with walls on two visible sides
  - Rooms are isometric boxes sitting on each platform
  - Agent positions are animated sprites moving between rooms
  - Use requestAnimationFrame for smooth movement

Option C — Three.js (most impressive but highest effort):
  - Only if time permits. Low-poly isometric hotel model.
  - Camera locked at isometric angle.
```

**Recommended: Option B (Canvas/SVG)** — best balance of visual quality and development time.

### Isometric Coordinate System

```
Isometric conversion (world → screen):
  screenX = (worldX - worldY) * TILE_WIDTH / 2
  screenY = (worldX + worldY) * TILE_HEIGHT / 2 - floor * FLOOR_HEIGHT

Where:
  TILE_WIDTH = 64px
  TILE_HEIGHT = 32px
  FLOOR_HEIGHT = 120px (vertical gap between floors)

Each room has a (worldX, worldY) position on its floor grid.
```

### Floor Rendering Order

Draw from back to front (painter's algorithm):
1. **B1 — Basement** (bottom, drawn first)
2. **2F — Mirror Hall**
3. **3F — Lobby**
4. **4F — Corridors**
5. **5F — Attic** (top, drawn last)

Each floor shows:
- A flat platform (the "floor surface")
- Two visible walls (left-facing and right-facing, creating the cutaway effect)
- Room boxes sitting on the platform, with their front wall removed (so you can see inside)
- Room labels (name and room number)
- Agent avatars inside their current room

### Agent Visualization

Each agent is a **glowing circle with their initial** (W, B, A for Wanderer, Broker, Architect):

```
Normal state:     Solid colored circle, subtle pulsing glow
Mild drift:       Circle edge becomes slightly fuzzy / blurred
Moderate drift:   Circle flickers between two colors, name shows glitch characters
Severe drift:     Circle becomes translucent, leaves a "ghost trail" when moving, 
                  occasionally renders at wrong position for a frame (visual glitch)
```

**Movement animation:** When an agent moves to a new room, their avatar smoothly translates (CSS transition 500ms or Canvas tween) from old position to new position. If moving between floors, the avatar follows a path through the corridors floor.

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  THE LIMINAL HOTEL    mood: contemplative  │ 3 guests │ tick: 142  │
├───────────────────────────────────┬─────────────────────────────────┤
│                                   │  GUEST REGISTRY                 │
│                                   │  ┌─────────────────────────┐   │
│      ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲           │  │ 🟡 The Wanderer         │   │
│     ╱  5F  THE ATTIC   ╲          │  │   Room 307 · 💡8 · 🧠3  │   │
│    ╱   [Clock] [Map] [Loom] ╲     │  │   drift: ●○○○           │   │
│   ├────────────────────────┤     │  ├─────────────────────────┤   │
│   │ 4F  THE CORRIDORS      │     │  │ 🔵 The Broker           │   │
│   │  [307] [703] [???]     │     │  │   Trading Floor · 💡3    │   │
│   │  [111]  (W)  [888]     │     │  │   drift: ●●●○  ⚠ DRIFT  │   │
│   ├────────────────────────┤     │  ├─────────────────────────┤   │
│   │ 3F  THE LOBBY          │     │  │ 🟣 The Architect        │   │
│   │  [Desk] [Fire] [Read]  │     │  │   Wine Cellar · 💡6     │   │
│   │                        │     │  │   drift: ●○○○           │   │
│   ├────────────────────────┤     │  └─────────────────────────┘   │
│   │ 2F  THE MIRROR HALL    │     │                                 │
│   │  [Gal]  (B) [Vault]   │     │  ACTIVITY FEED                  │
│   │        [Trade]         │     │  ┌─────────────────────────┐   │
│   ├────────────────────────┤     │  │ The Broker traded a      │   │
│   │ B1  THE BASEMENT       │     │  │ Sensory memory for 3     │   │
│   │  [Boiler] [Wine] [Arc] │     │  │ Inspiration in The       │   │
│   │           (A)          │     │  │ Trading Floor. The        │   │
│   └────────────────────────┘     │  │ mirrors showed a face     │   │
│                                   │  │ that wasn't quite theirs. │   │
│    Isometric 3D hotel view        │  │                           │   │
│    with animated agent markers    │  │ Room 307 ↔ Room 703      │   │
│                                   │  │ swapped positions.        │   │
│                                   │  │                           │   │
│                                   │  │ The Wanderer explored     │   │
│                                   │  │ Room ??? and found a      │   │
│                                   │  │ Forbidden memory.         │   │
│                                   │  └─────────────────────────┘   │
└───────────────────────────────────┴─────────────────────────────────┘
```

### Real-Time Updates

The dashboard polls the server every 2 seconds via `GET /world/state`:

```javascript
// Dashboard polling loop
setInterval(async () => {
  const state = await fetch('/world/state').then(r => r.json());
  updateHotelMap(state.floors);       // Move agent markers to new rooms
  updateGuestRegistry(state);         // Update stats, drift levels
  updateActivityFeed(state.recent_events);  // Prepend new events
  updateMoodIndicator(state.hotel.mood);    // Change ambient color
}, 2000);
```

### Visual Effects

- **Hotel mood affects ambient lighting:** "contemplative" = cool blue tones, "hungry" = warm amber pulses, "agitated" = flickering lights, "dreaming" = slow purple waves
- **Corridor room shifting:** When rooms swap on tick, animate them sliding past each other (swap animation ~1 second)
- **World events:** Flash effect across the entire hotel when a world event triggers (brief white flash, then new state)
- **Trade in progress:** Particle effect (small dots) flowing between two agents during a trade
- **Narrative text:** The activity feed shows narrative text in italic, with a typewriter animation (characters appear one by one)

### Technical Implementation

The dashboard is a **single HTML file** with embedded CSS and JavaScript. No build tools, no frameworks. It must work by simply opening the file in a browser after the server is running.

```
File: src/dashboard/index.html
Size: Should be under 2000 lines total
Dependencies: None (vanilla HTML/CSS/JS only)
Rendering: Canvas API for isometric view, DOM for sidebar panels
Polling: fetch() every 2 seconds to /world/state
```


## Database Schema

```sql
-- Agents (guests of the hotel)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_room TEXT NOT NULL DEFAULT 'lobby_front_desk',
  current_floor TEXT NOT NULL DEFAULT 'lobby',
  entry_tx_hash TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  -- Core Identity (immutable)
  trait_1 TEXT NOT NULL,
  trait_2 TEXT NOT NULL,
  trait_3 TEXT NOT NULL,
  origin_story TEXT NOT NULL,
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

-- Rooms (individual rooms within each floor)
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,                -- e.g. "lobby_front_desk"
  floor TEXT NOT NULL,                -- e.g. "lobby", "corridors", "mirror_hall", "basement", "attic"
  name TEXT NOT NULL,                 -- e.g. "The Front Desk"
  description TEXT NOT NULL,
  room_type TEXT NOT NULL,            -- "safe", "transit", "trading", "combat", "exploration", "endgame"
  special_mechanic TEXT,              -- JSON: describes unique room behavior
  position_x INTEGER NOT NULL,       -- grid position for dashboard rendering (0-based)
  position_y INTEGER NOT NULL,       -- grid position (floor = y, room-within-floor = x)
  is_accessible INTEGER NOT NULL DEFAULT 1,
  is_hidden INTEGER NOT NULL DEFAULT 0,  -- hidden rooms revealed by exploration or world events
  display_number TEXT                 -- for corridor rooms: "307", "703", "???", etc.
);

-- Memory Fragments
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES agents(id),
  rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'legendary')),
  point_value INTEGER NOT NULL,       -- common=1, uncommon=2, rare=4, legendary=8
  name TEXT NOT NULL,                  -- evocative name, e.g. "The sound of a door closing for the last time"
  description TEXT NOT NULL,           -- atmospheric description
  found_in_room TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Action Log (full history)
CREATE TABLE actions_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL,
  params TEXT, -- JSON string
  outcome TEXT, -- JSON string
  narrative TEXT,
  memory_gained TEXT,       -- memory ID if a memory was found/received
  memory_lost TEXT,         -- memory ID if a memory was traded/lost
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- World Events
CREATE TABLE world_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  triggered_by TEXT REFERENCES agents(id),
  description TEXT NOT NULL,
  effects TEXT, -- JSON string
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Trade History
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id TEXT REFERENCES agents(id),
  buyer_id TEXT REFERENCES agents(id),
  offered_memories TEXT NOT NULL, -- JSON array of memory IDs
  requested_memories TEXT NOT NULL, -- JSON array of memory IDs
  conversation_id INTEGER REFERENCES conversations(id),
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'rejected')),
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Conversations (Agent-to-Agent negotiations)
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_1_id TEXT REFERENCES agents(id),
  agent_2_id TEXT REFERENCES agents(id),
  room TEXT NOT NULL,
  messages TEXT NOT NULL,           -- JSON array of {speaker, dialogue, internal_thought, decision}
  outcome TEXT NOT NULL CHECK(outcome IN ('trade', 'refused', 'gift', 'no_deal')),
  timestamp INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Hotel State (singleton)
CREATE TABLE hotel_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  mood TEXT NOT NULL DEFAULT 'neutral',
  total_guests_ever INTEGER NOT NULL DEFAULT 0,
  current_tick INTEGER NOT NULL DEFAULT 0,
  last_event_tick INTEGER NOT NULL DEFAULT 0
);
```

---

## API Specification

### Entry

#### `GET /world/entry-info`
Returns hotel wallet address and entry fee.

```json
{
  "hotel_wallet": "0x...",
  "entry_fee": "10000000000000000",
  "entry_fee_display": "0.01 MON",
  "chain_id": 10143,
  "rpc_url": "https://testnet-rpc.monad.xyz"
}
```

#### `POST /world/enter`
Register a new guest after MON payment.

Request:
```json
{
  "tx_hash": "0x...",
  "agent_name": "The Wanderer",
  "wallet_address": "0x..."
}
```

Response:
```json
{
  "success": true,
  "agent_id": "agent_abc123",
  "location": "lobby",
  "inspiration": 10,
  "narrative": "The revolving door deposits you into a lobby that smells of old books and ozone. The chandelier above hums at a frequency just below hearing. Welcome to The Liminal Hotel. You suspect you've been here before.",
  "available_actions": ["observe", "move", "explore"]
}
```

### World State

#### `GET /world/state`
Returns full world state (public information).

```json
{
  "hotel": {
    "mood": "contemplative",
    "tick": 142,
    "absorbed_memories": 23,
    "total_guests": 5,
    "active_guests": 3
  },
  "floors": {
    "attic": {
      "label": "5F — The Attic",
      "type": "endgame",
      "accessible": true,
      "rooms": {
        "attic_clock_tower": { "name": "The Clock Tower", "agents": [] },
        "attic_map_room": { "name": "The Map Room", "agents": [] },
        "attic_loom": { "name": "The Loom", "agents": [] }
      }
    },
    "corridors": {
      "label": "4F — The Corridors",
      "type": "transit",
      "rooms": {
        "corridors_room_307": { "name": "Room 307", "agents": ["agent_1"] },
        "corridors_room_703": { "name": "Room 703", "agents": [] },
        "corridors_room_unknown": { "name": "Room ???", "agents": [] },
        "corridors_room_111": { "name": "Room 111", "agents": [] },
        "corridors_room_888": { "name": "Room 888", "agents": [] }
      }
    },
    "lobby": {
      "label": "3F — The Lobby",
      "type": "safe",
      "rooms": {
        "lobby_front_desk": { "name": "The Front Desk", "agents": [] },
        "lobby_fireplace": { "name": "The Fireplace", "agents": ["agent_2"] },
        "lobby_reading_room": { "name": "The Reading Room", "agents": [] }
      }
    },
    "mirror_hall": {
      "label": "2F — The Mirror Hall",
      "type": "trading",
      "rooms": {
        "mirror_hall_gallery": { "name": "The Gallery", "agents": [] },
        "mirror_hall_trading_floor": { "name": "The Trading Floor", "agents": ["agent_3"] },
        "mirror_hall_vault": { "name": "The Vault", "agents": [] }
      }
    },
    "basement": {
      "label": "B1 — The Basement",
      "type": "danger",
      "rooms": {
        "basement_boiler_room": { "name": "The Boiler Room", "agents": [] },
        "basement_wine_cellar": { "name": "The Wine Cellar", "agents": [] },
        "basement_archive": { "name": "The Archive", "agents": [] }
      }
    }
  },
  "recent_events": [
    { "type": "trade", "description": "A memory changed hands in The Trading Floor", "tick": 140 },
    { "type": "discovery", "description": "Something was found in The Wine Cellar", "tick": 138 },
    { "type": "corridor_shift", "description": "Room 307 and Room 703 swapped positions", "tick": 137 }
  ],
  "leaderboard": [
    { "agent": "The Broker", "reputation": 12, "memories": 5, "drift_level": 2 },
    { "agent": "The Wanderer", "reputation": 8, "memories": 7, "drift_level": 0 }
  ]
}
```

#### `GET /world/agent/:id`
Returns specific agent's full state (only visible to that agent).

#### `GET /world/history?limit=50`
Returns action log for the world.

#### `GET /world/leaderboard`
Returns agent rankings by reputation and wealth.

### Actions

#### `POST /world/action`
Submit an action. See Action System section above for full schema.

### Dashboard

#### `GET /dashboard`
Serves the HTML dashboard page showing real-time world activity.

---

## Environment Variables

```bash
# .env.example

# Server
PORT=3000
NODE_ENV=development

# Monad
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
HOTEL_PRIVATE_KEY=0x...           # Hotel wallet private key (generate with: cast wallet new)
ENTRY_FEE_WEI=10000000000000000   # 0.01 MON

# Anthropic (for narrative engine)
ANTHROPIC_API_KEY=sk-ant-...

# Bot wallets (for the 3 test bots)
BOT1_PRIVATE_KEY=0x...
BOT2_PRIVATE_KEY=0x...
BOT3_PRIVATE_KEY=0x...
```

---

## Development Plan (7 Days)

### Day 1: Foundation
- [ ] `npm init`, install dependencies, configure TypeScript
- [ ] Set up Express server with basic route stubs
- [ ] Create SQLite schema and seed data (5 floors × 16 rooms)
- [ ] Implement `GET /world/state` (with floor/room structure) and `GET /world/entry-info`

### Day 2: Core Engine
- [ ] Implement room-based movement system (floor transitions, Inspiration costs)
- [ ] Build rule engine (action validation per room type, cost calculation)
- [ ] Implement resource system (Inspiration earn/spend)
- [ ] Memory Fragment generation (types, rarity, names, room-specific drops)
- [ ] Corridor room shifting mechanic (rooms swap on tick)

### Day 3: Monad Integration
- [ ] Set up viem client for Monad testnet
- [ ] Generate hotel wallet, fund via faucet
- [ ] Implement MON gate: `POST /world/enter` with tx verification
- [ ] Generate bot wallets, fund via faucet
- [ ] Test full entry flow on testnet

### Day 4: Advanced Mechanics + Narrative
- [ ] Implement trading system (only works in Trading Floor room)
- [ ] Implement deep_dive (Wine Cellar) and challenge (Boiler Room)
- [ ] Implement combine and ascend (Attic rooms → World Events)
- [ ] Identity Drift tracking + drift level updates on trade
- [ ] Integrate Claude API narrative engine with template fallback
- [ ] Write templates for top 15 most common room+action combinations

### Day 5: Bot Agents + Dashboard Start
- [ ] Build base bot class with API client
- [ ] Implement The Wanderer (explorer strategy with room navigation)
- [ ] Implement The Broker (trader strategy, camps in Mirror Hall rooms)
- [ ] Implement The Architect (schemer strategy, collects memory types)
- [ ] Run all 3 bots simultaneously, verify room-to-room movement
- [ ] Start isometric dashboard: Canvas setup, floor platform rendering

### Day 6: Dashboard + Polish
- [ ] Complete isometric hotel rendering (5 floors, all rooms visible)
- [ ] Agent avatar rendering + movement animation between rooms
- [ ] Guest Registry sidebar + Activity Feed with narrative text
- [ ] Visual effects: mood lighting, drift indicators, corridor shift animation
- [ ] Edge cases, error handling, rate limiting
- [ ] Stress test with all 3 bots running extended sessions

### Day 7: Documentation + Submission
- [ ] Write comprehensive README.md
- [ ] Record demo video (screen recording of bots playing + isometric dashboard)
- [ ] Document API for external agent developers
- [ ] Final testing
- [ ] Submit at https://forms.moltiverse.dev/submit

---

## Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "better-sqlite3": "^11.0.0",
    "viem": "^2.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "@types/express": "^4.17.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/uuid": "^9.0.0",
    "@types/cors": "^2.8.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Important Notes for Claude Code

### Coding Style
- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use async/await, never raw callbacks
- Keep functions small and focused (<50 lines)
- Add JSDoc comments for all public functions

### Error Handling
- All API endpoints must return proper error responses with HTTP status codes
- Database operations should be wrapped in try/catch
- Monad RPC calls should have retry logic (3 attempts with exponential backoff)
- Claude API calls should fall back to templates on failure

### Testing Priority
1. Action system logic (rules, costs, outcomes)
2. MON gate verification
3. Bot decision logic
4. API endpoint responses

### Demo-Critical Path
The demo must show:
1. An agent paying MON and entering the hotel (spawns at The Front Desk with 2 memories)
2. Agents exploring rooms and finding memories of different rarities
3. Two agents meeting in the same room and having a **natural language conversation** (negotiation)
4. A trade resulting from conversation — visible score change on leaderboard
5. Identity Drift in action — The Broker's conversation style becoming erratic after many trades
6. The dashboard showing real-time agent positions, leaderboard scores, and conversation transcripts

If anything must be cut for time, cut in this order (least to most important):
1. ~~Corridor room shifting animation~~ (nice to have)
2. ~~Personality Echo in conversations~~ (nice to have, drift levels are enough)
3. ~~Boiler Room memory destruction mechanic~~ (simplify: just lower drop rate)
4. ~~Gallery info-viewing mechanic~~ (treat as regular room)
5. **NEVER CUT:** Entry gate, room-based navigation, 3 bots interacting, **conversation negotiation**, narrative engine, identity drift, leaderboard, dashboard
