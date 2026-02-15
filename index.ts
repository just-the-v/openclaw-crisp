/**
 * Clawdbot Crisp Channel Plugin
 * 
 * Receive and respond to Crisp website chat conversations.
 * 
 * @see https://github.com/just-the-v/openclaw-crisp
 * @see https://crisp.chat
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { crispPlugin, createCrispHttpHandler } from "./src/channel.js";
import { setCrispRuntime } from "./src/runtime.js";

// Re-export types for consumers
export * from "./src/types.js";
export { createCrispClient } from "./src/api-client.js";
export { 
  getPendingReply, 
  removePendingReply, 
  sendCrispReply,
} from "./src/monitor.js";
export type { PendingReply } from "./src/pending-replies.js";

/**
 * Plugin definition for Clawdbot
 */
const plugin = {
  id: "crisp",
  name: "Crisp",
  description: "Crisp website chat channel for Clawdbot",
  configSchema: emptyPluginConfigSchema(),

  /**
   * Register the plugin with Clawdbot
   */
  register(api: ClawdbotPluginApi) {
    // Set runtime for webhook handler
    setCrispRuntime(api.runtime);

    // Register the channel plugin
    api.registerChannel({ plugin: crispPlugin });

    // Register HTTP handler for webhooks
    const httpHandler = createCrispHttpHandler(api.config);
    api.registerHttpHandler(httpHandler);
  },
};

export default plugin;
