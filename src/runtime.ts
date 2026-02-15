/**
 * Crisp Plugin Runtime Bridge
 * 
 * Stores the Clawdbot plugin runtime for use in webhook handlers.
 */

import type { PluginRuntime } from "clawdbot/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setCrispRuntime(next: PluginRuntime): void {
  runtime = next;
}

export function getCrispRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Crisp runtime not initialized");
  }
  return runtime;
}

export function hasCrispRuntime(): boolean {
  return runtime !== null;
}
