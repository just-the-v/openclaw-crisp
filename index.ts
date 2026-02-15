/**
 * OpenClaw Crisp Channel Plugin
 * 
 * Receive and respond to Crisp website chat conversations.
 * 
 * @see https://github.com/just-the-v/openclaw-crisp
 * @see https://crisp.chat
 */

import { crispPlugin, createCrispHttpHandler, setCrispRuntime } from "./src/channel.js";

// Re-export types for consumers
export * from "./src/types.js";
export { createCrispClient } from "./src/api-client.js";

/**
 * Plugin definition for OpenClaw
 */
const plugin = {
  id: "crisp",
  name: "Crisp",
  description: "Crisp website chat channel for OpenClaw",

  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  /**
   * Register the plugin with OpenClaw
   */
  register(api: {
    runtime: unknown;
    config: Record<string, unknown>;
    registerChannel: (opts: { plugin: typeof crispPlugin }) => void;
    registerHttpHandler: (
      handler: (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse
      ) => Promise<boolean>
    ) => void;
  }) {
    // Set runtime for webhook handler
    setCrispRuntime(api.runtime as Parameters<typeof setCrispRuntime>[0]);

    // Register the channel plugin
    api.registerChannel({ plugin: crispPlugin });

    // Register HTTP handler for webhooks
    const httpHandler = createCrispHttpHandler(api.config);
    api.registerHttpHandler(httpHandler);
  },
};

export default plugin;
