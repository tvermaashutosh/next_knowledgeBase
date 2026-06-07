# LLM Configuration

## Supported Providers

| Provider | Generation | Embeddings | Models |
|----------|-----------|-----------|--------|
| **OpenAI** | ✅ | ✅ | gpt-4o, gpt-4o-mini, text-embedding-3-small/large |
| **Gemini** | ✅ | ✅ | gemini-2.0-flash, gemini-1.5-pro, text-embedding-004 |
| **Claude** | ✅ | ❌ | claude-sonnet-4, claude-3.5-haiku |
| **Bedrock** | 🔜 | 🔜 | Titan, etc. |

## Setup

1. Go to **Admin → LLM Config**
2. Select generation provider + model
3. Paste API key
4. Select embedding provider + model (OpenAI or Gemini — Claude has no embedding API)
5. Paste embedding API key (can be same as generation key for OpenAI)
6. Test connection → Save

## API

### `GET /api/llm-config`
Returns current config (keys hidden) + available options.

### `POST /api/llm-config` (Admin only)
```json
{
  "generationProvider": "openai",
  "generationModel": "gpt-4o",
  "generationApiKey": "sk-...",
  "embeddingProvider": "openai",
  "embeddingModel": "text-embedding-3-small",
  "embeddingApiKey": "sk-..."
}
```

## Cost Estimates (~200 features)

| Operation | Cost |
|-----------|------|
| Full KB embedding (1M tokens) | ~$0.02 |
| Single query (search + generate) | ~$0.01–0.03 |
| Monthly (50 queries/day) | ~$15–45 |

## Adding a New Provider

1. Implement `ILLMProvider` interface in `src/lib/llm-adapter.ts`
2. Add to `providers` registry
3. Add to `getProviderOptions()` return value
4. Install SDK: `npm install @provider/sdk`

```typescript
const myProvider: ILLMProvider = {
  async generate(config, options) { ... },
  async embed(config, text) { ... },
};
providers["myprovider"] = myProvider;
```

## Vision Support (Image Processing)

The **Ingest** feature uses vision-capable models to extract content from uploaded images. The same generation provider is used for vision — no additional config needed.

| Provider | Vision Models | How Images Are Sent |
|----------|--------------|---------------------|
| **OpenAI** | gpt-4o, gpt-4o-mini | `image_url` content parts |
| **Gemini** | gemini-1.5-pro, gemini-2.0-flash | `inlineData` parts |
| **Claude** | claude-3+, claude-sonnet-4 | Base64 image blocks |

> Vision is only used for the Ingest pipeline (image source type). Standard generation and embedding do not require vision support.

