/**
 * Type declarations for clawdbot/plugin-sdk
 */

declare module "clawdbot/plugin-sdk" {
  export interface ClawdbotConfig {
    [key: string]: unknown;
  }

  export interface PluginRuntime {
    version: string;
    channel: {
      text: {
        chunkMarkdownText(text: string, limit: number): string[];
        resolveTextChunkLimit(cfg: ClawdbotConfig, channel: string, accountId?: string): number;
        hasControlCommand(text: string, cfg: ClawdbotConfig): boolean;
        resolveMarkdownTableMode(params: { cfg: ClawdbotConfig; channel: string; accountId?: string }): string;
        convertMarkdownTables(text: string, mode: string): string;
      };
      reply: {
        dispatchReplyWithBufferedBlockDispatcher(params: {
          ctx: Record<string, unknown>;
          cfg: ClawdbotConfig;
          dispatcherOptions: {
            deliver: (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string; replyToId?: string }) => void | Promise<void>;
            onError?: (err: unknown, info?: { kind: string }) => void;
          };
        }): Promise<void>;
        formatAgentEnvelope(params: {
          channel: string;
          from?: string;
          timestamp?: number;
          previousTimestamp?: number;
          envelope?: unknown;
          body: string;
        }): string;
        resolveEnvelopeFormatOptions(cfg: ClawdbotConfig): unknown;
      };
      routing: {
        resolveAgentRoute(params: {
          cfg: ClawdbotConfig;
          channel: string;
          accountId: string;
          peer: { kind: "dm" | "group" | "channel"; id: string };
        }): { sessionKey: string; accountId: string; agentId: string };
      };
      pairing: {
        buildPairingReply(params: { channel: string; idLine: string; code: string }): string;
        readAllowFromStore(channel: string): Promise<string[]>;
        upsertPairingRequest(params: {
          channel: string;
          id: string;
          meta?: { name?: string };
        }): Promise<{ code: string; created: boolean }>;
      };
      media: {
        fetchRemoteMedia(params: { url: string }): Promise<{ buffer: Buffer; contentType?: string }>;
        saveMediaBuffer(
          buffer: Uint8Array,
          contentType: string | undefined,
          direction: "inbound" | "outbound",
          maxBytes: number
        ): Promise<{ path: string; contentType?: string }>;
      };
      session: {
        resolveStorePath(store: unknown, params: { agentId: string }): string;
        readSessionUpdatedAt(params: { storePath: string; sessionKey: string }): number | null;
      };
      mentions: {
        buildMentionRegexes(cfg: ClawdbotConfig, agentId?: string): RegExp[];
        matchesMentionPatterns(text: string, regexes: RegExp[]): boolean;
      };
      groups: {
        resolveRequireMention(params: {
          cfg: ClawdbotConfig;
          channel: string;
          groupId: string;
          accountId?: string;
        }): boolean;
      };
    };
    logging: {
      shouldLogVerbose(): boolean;
    };
    system: {
      enqueueSystemEvent(message: string, params: { sessionKey: string; contextKey?: string }): void;
    };
  }

  export interface ClawdbotPluginApi {
    runtime: PluginRuntime;
    config: ClawdbotConfig;
    registerChannel(opts: { plugin: unknown }): void;
    registerHttpHandler(
      handler: (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse
      ) => Promise<boolean>
    ): void;
  }

  export function emptyPluginConfigSchema(): { type: "object"; additionalProperties: boolean; properties: Record<string, never> };
}
