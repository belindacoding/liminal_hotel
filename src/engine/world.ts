/**
 * World Engine — orchestrates the game systems.
 * Re-exports the key interfaces and ties together actions, events, and narrative.
 */

export { processAction } from "./actions";
export type { ActionResponse } from "./actions";
export type { ActionRequest, ActionType } from "./rules";
export { startWorldTick, worldTick, closeHotel, stopWorldTick } from "./events";
