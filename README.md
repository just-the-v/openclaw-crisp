# 🦞 OpenClaw Crisp Channel

[![npm version](https://badge.fury.io/js/openclaw-crisp.svg)](https://www.npmjs.com/package/openclaw-crisp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [OpenClaw](https://github.com/openclaw/openclaw) channel plugin for [Crisp](https://crisp.chat) website chat.

Receive messages from your Crisp chatbox and let your AI assistant respond automatically, or get notified on Telegram/Discord/etc when a new conversation starts.

## Features

- 📥 **Inbound webhooks** - Receive Crisp messages in real-time
- 📤 **Outbound messaging** - Send replies via Crisp REST API
- 🤖 **Auto-reply** - AI responds to visitors automatically
- 🔔 **Cross-channel notifications** - Get alerted on Telegram when a new conversation starts
- 🔒 **Secure** - Webhook secret validation, no exposed credentials

## Installation

```bash
# Install via npm
openclaw plugins install openclaw-crisp

# Or clone locally for development
git clone https://github.com/just-the-v/openclaw-crisp.git
openclaw plugins install -l ./openclaw-crisp
```

## Configuration

### 1. Get Crisp API Credentials

1. Go to [Crisp Dashboard](https://app.crisp.chat) → Settings → API
2. Create a new API token with scopes:
   - `website:conversation:messages` (read + write)
   - `website:conversation:sessions` (read)
3. Note your **Website ID** from Settings → Website Settings

### 2. Configure OpenClaw

Add to your `openclaw.yaml`:

```yaml
channels:
  crisp:
    enabled: true
    websiteId: "your-website-uuid"
    apiKeyId: "your-api-key-id"
    apiKeySecret: "your-api-key-secret"
    webhookSecret: "generate-a-random-32-char-string"
    
    # AI behavior
    autoReply: true
    operatorName: "Assistant"
    historyLimit: 10
    
    # Optional: notifications
    notifyOnNew: true
    notifyTarget: "telegram:123456789"
```

### 3. Configure Crisp Webhook

1. Go to Crisp Dashboard → Settings → Advanced → Web Hooks
2. Add a new webhook:
   - **URL**: `https://your-gateway.com/crisp-webhook?secret=YOUR_WEBHOOK_SECRET`
   - **Events**: `message:send`, `session:set_state`

### 4. Restart Gateway

```bash
openclaw gateway restart
```

## Usage

Once configured, the plugin will:

1. **Receive visitor messages** via webhook
2. **Route to OpenClaw** for AI processing
3. **Send replies** back to Crisp
4. **Notify you** (optional) when a new conversation starts

### Manual message sending

```bash
# Send a message to a Crisp conversation
openclaw message send --channel crisp --to "session_xxx" --message "Hello!"
```

## Development

```bash
# Clone the repo
git clone https://github.com/just-the-v/openclaw-crisp.git
cd openclaw-crisp

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Link for local development
openclaw plugins install -l .
```

## Architecture

```
Crisp Chatbox → Webhook POST → OpenClaw Gateway → AI Agent → Crisp REST API
                                      ↓
                              Telegram/Discord notification
```

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `websiteId` | string | required | Crisp website UUID |
| `apiKeyId` | string | required | Crisp API key identifier |
| `apiKeySecret` | string | required | Crisp API key secret |
| `webhookSecret` | string | required | Secret for webhook validation |
| `webhookPath` | string | `/crisp-webhook` | Webhook endpoint path |
| `autoReply` | boolean | `true` | AI auto-responds to visitors |
| `operatorName` | string | `Assistant` | Name shown in Crisp |
| `notifyOnNew` | boolean | `false` | Notify on new conversations |
| `notifyTarget` | string | - | Target for notifications (e.g., `telegram:123`) |
| `historyLimit` | number | `10` | Messages for AI context |

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT © [Hugo Vast](https://github.com/just-the-v)

## Related

- [OpenClaw](https://github.com/openclaw/openclaw) - The personal AI assistant
- [Crisp](https://crisp.chat) - Business messaging platform
- [Crisp API Docs](https://docs.crisp.chat) - Official Crisp API documentation
