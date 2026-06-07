/**
 * LLM Adapter — Groq (chat) + Ollama (embeddings).
 *
 * One provider per task:
 *  - Generation: Groq, via its OpenAI-compatible API (Llama models).
 *  - Embeddings: Ollama (self-hosted — e.g. localhost in dev, or a Hugging Face
 *    Docker Space in prod).
 *
 * Ollama has no API key, so its `apiKey` config slot is repurposed to hold the
 * server base URL (e.g. http://localhost:11434 or https://<user>-<space>.hf.space).
 */

export type LLMProvider = "groq" | "ollama";

export type LLMConfig = {
  generationProvider: LLMProvider;
  generationModel: string;
  generationApiKey: string;
  embeddingProvider: LLMProvider;
  embeddingModel: string;
  embeddingApiKey: string; // for Ollama this holds the base URL, not a secret key
};

export type GenerateOptions = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
};

export type GenerateResult = {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
};

export type EmbedResult = {
  embedding: number[];
  dimensions: number;
};

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_OLLAMA_URL = "http://localhost:11434";

function ollamaBaseUrl(apiKey: string): string {
  // Be forgiving if a full endpoint URL was pasted (e.g. ".../api/embeddings"):
  // reduce to the origin so we don't double up the path.
  return (apiKey || DEFAULT_OLLAMA_URL).trim().replace(/\/api\/.*$/, "").replace(/\/+$/, "");
}

// ─── Provider Interface ──────────────────────────────────

interface ILLMProvider {
  generate(config: { apiKey: string; model: string }, options: GenerateOptions): Promise<GenerateResult>;
  embed(config: { apiKey: string; model: string }, text: string): Promise<EmbedResult>;
}

// ─── Groq Provider (generation) ──────────────────────────

const groqProvider: ILLMProvider = {
  async generate(config, options) {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.apiKey, baseURL: GROQ_BASE_URL });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
      ],
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.3,
    });

    return {
      text: response.choices[0]?.message?.content || "",
      usage: response.usage
        ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens }
        : undefined,
    };
  },

  async embed() {
    throw new Error("Groq does not provide embeddings — embeddings are handled by Ollama.");
  },
};

// ─── Ollama Provider (embeddings, also supports generation) ──

const ollamaProvider: ILLMProvider = {
  async generate(config, options) {
    const res = await fetch(`${ollamaBaseUrl(config.apiKey)}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        system: options.systemPrompt,
        prompt: options.userPrompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.3,
          num_predict: options.maxTokens || 4096,
        },
      }),
    });
    if (!res.ok) throw new Error(`Ollama generate failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { response?: string };
    return { text: data.response || "" };
  },

  async embed(config, text) {
    const res = await fetch(`${ollamaBaseUrl(config.apiKey)}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama embedding failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { embedding?: number[] };
    const embedding = data.embedding ?? [];
    if (embedding.length === 0) throw new Error("Ollama returned an empty embedding — is the model pulled?");
    return { embedding, dimensions: embedding.length };
  },
};

// ─── Provider Registry ──────────────────────────────────

const providers: Record<string, ILLMProvider> = {
  groq: groqProvider,
  ollama: ollamaProvider,
};

// ─── Public API ─────────────────────────────────────────

export async function generate(llmConfig: LLMConfig, options: GenerateOptions): Promise<GenerateResult> {
  const provider = providers[llmConfig.generationProvider];
  if (!provider) throw new Error(`Unknown generation provider: ${llmConfig.generationProvider}`);

  return provider.generate(
    { apiKey: llmConfig.generationApiKey, model: llmConfig.generationModel },
    options
  );
}

export async function embed(llmConfig: LLMConfig, text: string): Promise<EmbedResult> {
  const provider = providers[llmConfig.embeddingProvider];
  if (!provider) throw new Error(`Unknown embedding provider: ${llmConfig.embeddingProvider}`);

  return provider.embed(
    { apiKey: llmConfig.embeddingApiKey, model: llmConfig.embeddingModel },
    text
  );
}

// ─── Vision Support ─────────────────────────────────────

export type VisionImage = {
  base64: string;
  mimeType: string; // "image/png" | "image/jpeg" | "image/webp" | "image/gif"
};

export type VisionGenerateOptions = GenerateOptions & {
  images: VisionImage[];
};

/**
 * Generate with vision — sends images alongside text. Requires a vision-capable
 * Groq model (e.g. a Llama 4 / Llama Vision model). The default text model
 * (llama-3.3-70b-versatile) does NOT accept images and will error if used here.
 */
export async function generateWithVision(
  llmConfig: LLMConfig,
  options: VisionGenerateOptions
): Promise<GenerateResult> {
  if (llmConfig.generationProvider !== "groq") {
    throw new Error(`Vision is only supported via Groq. Current provider: ${llmConfig.generationProvider}`);
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: llmConfig.generationApiKey, baseURL: GROQ_BASE_URL });

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: options.userPrompt },
  ];
  for (const img of options.images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
    });
  }

  const response = await client.chat.completions.create({
    model: llmConfig.generationModel,
    messages: [
      { role: "system", content: options.systemPrompt },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { role: "user", content: userContent as any },
    ],
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.3,
  });

  return {
    text: response.choices[0]?.message?.content || "",
    usage: response.usage
      ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens }
      : undefined,
  };
}

export function getProviderOptions() {
  return {
    generation: [
      { provider: "groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
    ],
    embedding: [
      { provider: "ollama", models: ["nomic-embed-text"] },
    ],
  };
}
