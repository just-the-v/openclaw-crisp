/**
 * Crisp Channel Plugin for OpenClaw
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { CrispConfigSchema, type CrispConfig, type ResolvedCrispAccount } from "./types.js";
import { createCrispClient } from "./api-client.js";
import { handleCrispWebhookRequest, resolveWebhookPath, setCrispRuntime } from "./monitor.js";

// Default account ID for single-account setups
const DEFAULT_ACCOUNT_ID = "default";

/**
 * Channel metadata for OpenClaw
 */
const meta = {
  id: "crisp",
  label: "Crisp",
  selectionLabel: "Crisp (website chat)",
  detailLabel: "Crisp Chat",
  docsPath: "/channels/crisp",
  docsLabel: "crisp",
  blurb: "Website chat via Crisp webhooks + REST API.",
  aliases: ["crisp-chat"],
  order: 80,
};

/**
 * Resolve account configuration from OpenClaw config
 */
function resolveCrispAccount(params: {
  cfg: Record<string, unknown>;
  accountId?: string;
}): ResolvedCrispAccount {
  const { cfg, accountId = DEFAULT_ACCOUNT_ID } = params;
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const crispConfig = channels?.crisp as Record<string, unknown> | undefined;

  if (!crispConfig) {
    return {
      accountId,
      name: accountId,
      enabled: false,
      configured: false,
      config: {} as CrispConfig,
      baseUrl: "https://api.crisp.chat/v1",
    };
  }

  // Support multi-account via accounts.{accountId}
  const accounts = crispConfig.accounts as Record<string, unknown> | undefined;
  const accountConfig = accountId !== DEFAULT_ACCOUNT_ID && accounts?.[accountId]
    ? { ...crispConfig, ...accounts[accountId] }
    : crispConfig;

  const parsed = CrispConfigSchema.safeParse(accountConfig);
  const config = parsed.success ? parsed.data : ({} as CrispConfig);

  const configured = Boolean(
    config.websiteId &&
    config.apiKeyId &&
    config.apiKeySecret &&
    config.webhookSecret
  );

  return {
    accountId,
    name: (accountConfig.name as string) || accountId,
    enabled: (accountConfig.enabled as boolean) !== false,
    configured,
    config,
    baseUrl: "https://api.crisp.chat/v1",
  };
}

/**
 * List available account IDs
 */
function listCrispAccountIds(cfg: Record<string, unknown>): string[] {
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const crispConfig = channels?.crisp as Record<string, unknown> | undefined;

  if (!crispConfig) return [];

  const accounts = crispConfig.accounts as Record<string, unknown> | undefined;
  if (accounts && Object.keys(accounts).length > 0) {
    return Object.keys(accounts);
  }

  // Single account setup
  if (crispConfig.websiteId) {
    return [DEFAULT_ACCOUNT_ID];
  }

  return [];
}

/**
 * The Crisp channel plugin
 */
export const crispPlugin = {
  id: "crisp",
  meta,

  capabilities: {
    chatTypes: ["direct"] as const,
    media: true,
    reactions: false,
    edit: false,
    unsend: false,
    reply: false,
    effects: false,
    groupManagement: false,
  },

  reload: {
    configPrefixes: ["channels.crisp"],
  },

  config: {
    listAccountIds: (cfg: Record<string, unknown>) => listCrispAccountIds(cfg),
    
    resolveAccount: (cfg: Record<string, unknown>, accountId?: string) =>
      resolveCrispAccount({ cfg, accountId }),
    
    defaultAccountId: (cfg: Record<string, unknown>) => {
      const ids = listCrispAccountIds(cfg);
      return ids[0] ?? DEFAULT_ACCOUNT_ID;
    },

    isConfigured: (account: ResolvedCrispAccount) => account.configured,

    describeAccount: (account: ResolvedCrispAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      baseUrl: account.baseUrl,
    }),
  },

  outbound: {
    deliveryMode: "direct" as const,
    textChunkLimit: 4000,

    resolveTarget: ({ to }: { to?: string }) => {
      const trimmed = to?.trim();
      if (!trimmed) {
        return {
          ok: false as const,
          error: new Error("Crisp requires --to <session_id>"),
        };
      }
      return { ok: true as const, to: trimmed };
    },

    sendText: async (ctx: {
      cfg: Record<string, unknown>;
      to: string;
      text: string;
      accountId?: string;
    }) => {
      const { cfg, to, text, accountId } = ctx;
      const account = resolveCrispAccount({ cfg, accountId });

      if (!account.configured) {
        return { channel: "crisp", ok: false, error: "Crisp not configured" };
      }

      const client = createCrispClient({
        apiKeyId: account.config.apiKeyId,
        apiKeySecret: account.config.apiKeySecret,
      });

      try {
        const result = await client.sendMessage({
          websiteId: account.config.websiteId,
          sessionId: to,
          content: text,
        });

        return {
          channel: "crisp",
          ok: true,
          messageId: String(result.fingerprint),
        };
      } catch (err) {
        return {
          channel: "crisp",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    sendMedia: async (ctx: {
      cfg: Record<string, unknown>;
      to: string;
      mediaUrl: string;
      accountId?: string;
    }) => {
      const { cfg, to, mediaUrl, accountId } = ctx;
      const account = resolveCrispAccount({ cfg, accountId });

      if (!account.configured) {
        return { channel: "crisp", ok: false, error: "Crisp not configured" };
      }

      const client = createCrispClient({
        apiKeyId: account.config.apiKeyId,
        apiKeySecret: account.config.apiKeySecret,
      });

      try {
        const result = await client.sendMessage({
          websiteId: account.config.websiteId,
          sessionId: to,
          content: mediaUrl,
          type: "file",
        });

        return {
          channel: "crisp",
          ok: true,
          messageId: String(result.fingerprint),
        };
      } catch (err) {
        return {
          channel: "crisp",
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  },

  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },

    probeAccount: async (params: { account: ResolvedCrispAccount }) => {
      const { account } = params;
      if (!account.configured) {
        return { ok: false as const, error: "Crisp not configured" };
      }

      const client = createCrispClient({
        apiKeyId: account.config.apiKeyId,
        apiKeySecret: account.config.apiKeySecret,
      });

      return client.probeWebsite(account.config.websiteId);
    },

    buildAccountSnapshot: (params: {
      account: ResolvedCrispAccount;
      runtime?: { running?: boolean; lastStartAt?: number | null };
    }) => {
      const { account, runtime } = params;
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        baseUrl: account.baseUrl,
        running: runtime?.running ?? false,
        connected: runtime?.running ?? false,
        lastStartAt: runtime?.lastStartAt ?? null,
      };
    },
  },

  gateway: {
    startAccount: async (ctx: {
      account: ResolvedCrispAccount;
      accountId: string;
      cfg: Record<string, unknown>;
      runtime: { log?: { info?: (m: string) => void } };
      setStatus: (patch: Record<string, unknown>) => void;
      abortSignal: AbortSignal;
    }) => {
      const { account, runtime, setStatus } = ctx;
      const webhookPath = resolveWebhookPath(account.config);

      runtime.log?.info?.(`[crisp:${account.accountId}] Starting (webhook=${webhookPath})`);

      setStatus({
        accountId: account.accountId,
        baseUrl: account.baseUrl,
        running: true,
        lastStartAt: Date.now(),
      });

      // The actual webhook handling is done via registerHttpHandler
      // This just marks the account as running

      return {
        stop: async () => {
          runtime.log?.info?.(`[crisp:${account.accountId}] Stopping`);
          setStatus({ running: false, lastStopAt: Date.now() });
        },
      };
    },
  },
};

/**
 * Create HTTP handler for Crisp webhooks
 */
export function createCrispHttpHandler(cfg: Record<string, unknown>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    // Find which account this webhook is for
    const accountIds = listCrispAccountIds(cfg);
    
    for (const accountId of accountIds) {
      const account = resolveCrispAccount({ cfg, accountId });
      if (!account.configured || !account.enabled) continue;

      const webhookPath = resolveWebhookPath(account.config);
      const url = new URL(req.url ?? "", `http://${req.headers.host}`);
      
      if (url.pathname.startsWith(webhookPath)) {
        return handleCrispWebhookRequest(req, res, account.config, accountId);
      }
    }

    return false;
  };
}

export { setCrispRuntime };
