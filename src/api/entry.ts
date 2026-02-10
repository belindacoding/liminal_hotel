import { v4 as uuid } from "uuid";

// ─── Trait Pools ─────────────────────────────────────────

const PERSONALITY_TRAITS = [
  "paranoid", "poetic", "hungry", "melancholic", "curious",
  "ruthless", "charming", "detached", "obsessive", "gentle",
];

const QUIRK_TRAITS = [
  "hears_music", "sees_colors", "counts_doors", "talks_to_mirrors",
  "collects_keys", "fears_elevators", "smells_time", "reads_shadows",
  "tastes_words", "feels_architecture",
];

const ORIGIN_TRAITS = [
  "lost_traveler", "escaped_dream", "former_guest", "hotel_creation",
  "memory_thief", "wandering_echo", "displaced_scholar", "forgotten_artist",
  "temporal_refugee", "accidental_tourist",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Agent Identity ──────────────────────────────────────

/** Generate a unique agent ID */
export function generateAgentId(): string {
  return `agent_${uuid().slice(0, 12)}`;
}

/** Assign 3 random traits: personality, quirk, origin */
export function assignTraits(): [string, string, string] {
  return [
    pick(PERSONALITY_TRAITS),
    pick(QUIRK_TRAITS),
    pick(ORIGIN_TRAITS),
  ];
}

// ─── Origin Story Templates ──────────────────────────────

const ORIGIN_TEMPLATES = [
  `{name} arrived through a door that wasn't there yesterday. The hotel had been expecting {pronoun}, or so the concierge claims. {trait_detail}`,
  `No one saw {name} enter. One moment the lobby was empty; the next, {pronoun} stood by the front desk, luggage in hand, though {pronoun} doesn't remember packing. {trait_detail}`,
  `{name} found the hotel at the end of a corridor that shouldn't exist — a hallway that branched off from a perfectly ordinary building. {trait_detail}`,
  `The Guest Registry already contained {name}'s name, written in ink that was still wet, in handwriting that was unmistakably {possessive}. {trait_detail}`,
  `{name} checked in during a thunderstorm that only existed within a three-block radius of the hotel. The rain tasted of copper and forgotten appointments. {trait_detail}`,
  `An elevator in an unrelated building opened onto the hotel lobby. {name} stepped out, and the doors closed behind {pronoun} with a sound like a whispered apology. {trait_detail}`,
  `{name} was drawn here by a memory that doesn't belong to {pronoun} — the smell of a room {pronoun}'s never visited, the echo of a conversation {pronoun}'s never had. {trait_detail}`,
  `The hotel sent {name} an invitation. It arrived in a dream, written on paper made of condensed silence. {trait_detail}`,
];

const TRAIT_DETAILS: Record<string, string[]> = {
  paranoid: [
    "Already, {pronoun} suspects the walls are listening.",
    "{name} checks every shadow twice. The hotel approves of vigilance.",
  ],
  poetic: [
    "The hotel's architecture reads like a poem {pronoun} almost remembers writing.",
    "{name} sees metaphors in the wallpaper. The wallpaper sees them back.",
  ],
  hungry: [
    "There's an emptiness that the hotel promises to fill — but never quite does.",
    "{name} came here looking for something. The hotel came here looking for {pronoun}.",
  ],
  melancholic: [
    "The elevator music seems to have been composed specifically for {possessive} sadness.",
    "A gentle sorrow clings to {name} like perfume. The hotel finds it... appetizing.",
  ],
  curious: [
    "{name} has already noticed that room numbers skip from 237 to 404. This will not be {possessive} last observation.",
    "Questions multiply in {possessive} mind. The hotel has answers, but they come with interest.",
  ],
  ruthless: [
    "The concierge recognizes ambition when it walks through the door. The hotel respects it, cautiously.",
    "{name} did not come here to make friends. The hotel didn't either.",
  ],
  charming: [
    "Even the chandelier seems to lean toward {name} when {pronoun} speaks.",
    "The concierge smiles, genuinely, for the first time in decades. {name} has that effect.",
  ],
  detached: [
    "{name} observes the lobby with the clinical interest of someone cataloguing a dream.",
    "Nothing here surprises {pronoun}. The hotel takes this as a challenge.",
  ],
  obsessive: [
    "{name} has already counted the tiles in the lobby floor. There are more than there should be.",
    "A pattern is forming. {name} can almost see it. The hotel watches {pronoun} try.",
  ],
  gentle: [
    "The hotel softens, imperceptibly, around {name}. Even ancient things can be touched by kindness.",
    "{name} places a hand on the lobby wall. For a moment, the wallpaper stops shifting.",
  ],
};

/** Generate an origin story from templates and traits */
export function generateOriginStory(
  name: string,
  traits: [string, string, string]
): string {
  const template = pick(ORIGIN_TEMPLATES);
  const personality = traits[0];

  // Get a trait-specific detail
  const details = TRAIT_DETAILS[personality] || [
    `The hotel takes note of {name}, as it does all its guests.`,
  ];
  const traitDetail = pick(details);

  // Simple pronoun (default to "they/them" for agent neutrality)
  const pronoun = "they";
  const possessive = "their";

  const story = template
    .replace(/\{name\}/g, name)
    .replace(/\{pronoun\}/g, pronoun)
    .replace(/\{possessive\}/g, possessive)
    .replace(/\{trait_detail\}/g,
      traitDetail
        .replace(/\{name\}/g, name)
        .replace(/\{pronoun\}/g, pronoun)
        .replace(/\{possessive\}/g, possessive)
    );

  return story;
}
