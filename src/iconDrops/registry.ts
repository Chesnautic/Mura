import type { IconShapeId } from "./shapes";

export interface IconDropType {
  id: IconShapeId;
  name: string;
  description: string;
}

/**
 * The 10 falling-icon designs. Requested explicitly: falling crosses,
 * falling Murakami-pillow-style flowers, and falling "E"s -- rounded out
 * to 10 with the rest of a cohesive Y2K/kawaii sticker-rain set.
 */
export const ICON_DROP_TYPES: IconDropType[] = [
  { id: "cross", name: "Crosses", description: "Falling crucifix-style crosses." },
  { id: "flower", name: "Murakami Flowers", description: "Falling multi-petal blooms, pillow-style." },
  { id: "letter_e", name: "Letter E", description: "Falling chunky block letter E's." },
  { id: "star", name: "Stars", description: "Falling 5-point stars." },
  { id: "heart", name: "Hearts", description: "Falling hearts." },
  { id: "diamond", name: "Diamonds", description: "Falling rotated diamonds." },
  { id: "music_note", name: "Music Notes", description: "Falling eighth notes." },
  { id: "lightning_bolt", name: "Lightning Bolts", description: "Falling jagged lightning bolts." },
  { id: "spark", name: "Sparks", description: "Falling 4-point sparkle spins." },
  { id: "smiley", name: "Smileys", description: "Falling smiley faces." },
];

export const DEFAULT_ACTIVE_ICON_DROPS: IconShapeId[] = ["flower"];

export const ICON_DROP_BY_ID = new Map(ICON_DROP_TYPES.map((d) => [d.id, d]));
