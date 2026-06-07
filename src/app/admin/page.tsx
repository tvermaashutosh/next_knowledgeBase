"use client";

import { useState, useEffect } from "react";

interface GlossaryEntry {
  term: string;
  definition: string;
  dontSay: string[];
}

interface FeatureInfo {
  product: string;
  feature: string;
  slug: string;
  moduleSlug: string;
}

interface ReviewFeature {
  id: string;
  slug: string;
  title: string;
  status: string;
  completeness: number;
  updatedAt: string;
  module?: { name: string; slug: string };
}

interface LLMConfigData {
  id?: string;
  generationProvider: string;
  generationModel: string;
  hasGenerationKey: boolean;
  embeddingProvider: string;
  embeddingModel: string;
  hasEmbeddingKey: boolean;
}

interface ProviderOption {
  provider: string;
  models: string[];
}

type AdminTab = "glossary" | "review" | "stale" | "llm" | "confluence";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("glossary");
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureInfo[]>([]);
  const [reviewFeatures, setReviewFeatures] = useState<ReviewFeature[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // New term form
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");
  const [newDontSay, setNewDontSay] = useState("");

  // LLM Config
  const [llmConfig, setLlmConfig] = useState<LLMConfigData | null>(null);
  const [llmOptions, setLlmOptions] = useState<{ generation: ProviderOption[]; embedding: ProviderOption[] }>({ generation: [], embedding: [] });
  const [genProvider, setGenProvider] = useState("groq");
  const [genModel, setGenModel] = useState("llama-3.3-70b-versatile");
  const [genApiKey, setGenApiKey] = useState("");
  const [embProvider, setEmbProvider] = useState("ollama");
  const [embModel, setEmbModel] = useState("nomic-embed-text");
  const [embApiKey, setEmbApiKey] = useState("");
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmMsg, setLlmMsg] = useState("");

  // Confluence Config
  const [confBaseUrl, setConfBaseUrl] = useState("");
  const [confEmail, setConfEmail] = useState("");
  const [confApiToken, setConfApiToken] = useState("");
  const [confConfigured, setConfConfigured] = useState(false);
  const [confSaving, setConfSaving] = useState(false);
  const [confMsg, setConfMsg] = useState("");

  useEffect(() => {
    let remaining = 2;
    const done = () => { remaining--; if (remaining === 0) setLoadingInit(false); };
    fetch("/api/kb?action=glossary").then((r) => r.json()).then((d) => { setGlossary(Array.isArray(d) ? d : []); done(); }).catch(done);
    fetch("/api/llm-config").then((r) => r.json()).then((data) => {
      setLlmOptions(data.options || { generation: [], embedding: [] });
      if (data.config) {
        setLlmConfig(data.config);
        setGenProvider(data.config.generationProvider);
        setGenModel(data.config.generationModel);
        setEmbProvider(data.config.embeddingProvider);
        setEmbModel(data.config.embeddingModel);
      }
      done();
    }).catch(done);
    fetch("/api/kb?action=all-features").then((r) => r.json()).then(setAllFeatures).catch(() => {});
    // Load Confluence config
    fetch("/api/confluence?action=config").then((r) => r.json()).then((d) => {
      if (d.configured) {
        setConfConfigured(true);
        setConfBaseUrl(d.baseUrl || "");
        setConfEmail(d.email || "");
      }
    }).catch(() => {});
  }, []);

  // When provider changes, reset model to first available
  useEffect(() => {
    const p = llmOptions.generation.find((o) => o.provider === genProvider);
    if (p && p.models.length > 0 && !p.models.includes(genModel)) {
      setGenModel(p.models[0]);
    }
  }, [genProvider, llmOptions.generation, genModel]);

  useEffect(() => {
    const p = llmOptions.embedding.find((o) => o.provider === embProvider);
    if (p && p.models.length > 0 && !p.models.includes(embModel)) {
      setEmbModel(p.models[0]);
    }
  }, [embProvider, llmOptions.embedding, embModel]);

  const addTerm = async () => {
    if (!newTerm.trim() || !newDef.trim()) return;
    const updated = [...glossary, {
      term: newTerm,
      definition: newDef,
      dontSay: newDontSay.split(",").map((s) => s.trim()).filter(Boolean),
    }];
    setSaving(true);
    await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-glossary", entries: updated }),
    });
    setGlossary(updated);
    setNewTerm("");
    setNewDef("");
    setNewDontSay("");
    setSaving(false);
    setSaveMsg("✅ Term added!");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  const removeTerm = async (index: number) => {
    const updated = glossary.filter((_, i) => i !== index);
    await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-glossary", entries: updated }),
    });
    setGlossary(updated);
  };

  const saveLlmConfig = async () => {
    setLlmSaving(true);
    setLlmMsg("");
    try {
      const resp = await fetch("/api/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationProvider: genProvider,
          generationModel: genModel,
          generationApiKey: genApiKey || undefined,
          embeddingProvider: embProvider,
          embeddingModel: embModel,
          embeddingApiKey: embApiKey || undefined,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setLlmConfig({
          ...data.config,
          hasGenerationKey: true,
          hasEmbeddingKey: true,
        });
        setGenApiKey("");
        setEmbApiKey("");
        setLlmMsg("✅ LLM configuration saved!");
      } else {
        const err = await resp.json();
        setLlmMsg(`❌ ${err.error || "Failed to save"}`);
      }
    } catch {
      setLlmMsg("❌ Network error");
    }
    setLlmSaving(false);
    setTimeout(() => setLlmMsg(""), 4000);
  };

  const loadReviewFeatures = async () => {
    setReviewLoading(true);
    try {
      const resp = await fetch("/api/kb?action=review-queue");
      const data = await resp.json();
      setReviewFeatures(data);
    } catch {
      setReviewFeatures([]);
    }
    setReviewLoading(false);
  };

  // Load review features when switching to review tab
  useEffect(() => {
    if (activeTab === "review") loadReviewFeatures();
  }, [activeTab]);

  const handleReviewAction = async (moduleSlug: string, featureSlug: string, newStatus: string) => {
    const res = await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-feature-status", moduleSlug, featureSlug, status: newStatus }),
    });
    if (res.ok) {
      // Remove from review list
      setReviewFeatures((prev) => prev.filter((f) => f.slug !== featureSlug));
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Admin</h1>
        <p className="text-kb-text-muted mt-1">Manage glossary, review queue, LLM config, and KB health</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-kb-surface rounded-xl border border-kb-border p-1.5 overflow-x-auto">
        {[
          { key: "glossary" as AdminTab, label: "📖 Glossary", count: glossary.length },
          { key: "llm" as AdminTab, label: "🤖 LLM Config", count: 0 },
          { key: "confluence" as AdminTab, label: "🔗 Confluence", count: 0 },
          { key: "review" as AdminTab, label: "📝 Review Queue", count: reviewFeatures.length },
          { key: "stale" as AdminTab, label: "⏰ Stale Docs", count: 0 },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-kb-primary text-white shadow-lg shadow-kb-primary/20"
                : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/20" : "bg-kb-surface-3"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Glossary Tab */}
      {activeTab === "glossary" && (
        <div className="space-y-6">
          {/* Add Term */}
          <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
            <h3 className="text-base font-semibold text-kb-text mb-4">Add Term</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-kb-text-dim mb-1 block">Term</label>
                <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="form-input" placeholder="e.g., Outlet" />
              </div>
              <div>
                <label className="text-xs text-kb-text-dim mb-1 block">Definition</label>
                <input value={newDef} onChange={(e) => setNewDef(e.target.value)} className="form-input" placeholder="A retail point that sells to consumers" />
              </div>
              <div>
                <label className="text-xs text-kb-text-dim mb-1 block">Don&apos;t Say (comma-separated)</label>
                <input value={newDontSay} onChange={(e) => setNewDontSay(e.target.value)} className="form-input" placeholder="Store, Shop, Retail Point" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={addTerm} disabled={saving} className="px-4 py-2 bg-kb-primary text-white rounded-lg text-sm font-medium hover:bg-kb-primary-dark transition-colors disabled:opacity-50">
                {saving ? "Adding..." : "+ Add Term"}
              </button>
              {saveMsg && <span className="text-sm text-kb-success">{saveMsg}</span>}
            </div>
          </div>

          {/* Glossary Table */}
          <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border">
                  <th className="text-left p-4 text-kb-text-muted font-medium">Term</th>
                  <th className="text-left p-4 text-kb-text-muted font-medium">Definition</th>
                  <th className="text-left p-4 text-kb-text-muted font-medium">❌ Don&apos;t Say</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {loadingInit ? (
                  <tr>
                    <td colSpan={4} className="p-4">
                      <div className="space-y-2">
                        {[1,2,3,4].map(i => <div key={i} className="h-8 bg-kb-surface-3 rounded animate-pulse" />)}
                      </div>
                    </td>
                  </tr>
                ) : glossary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-kb-text-dim">
                      No glossary terms yet. Add your first term above.
                    </td>
                  </tr>
                ) : (
                  glossary.map((entry, i) => (
                    <tr key={i} className="border-b border-kb-border/50 hover:bg-kb-surface-2 transition-colors">
                      <td className="p-4 font-medium text-kb-text">{entry.term}</td>
                      <td className="p-4 text-kb-text-muted">{entry.definition}</td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {entry.dontSay.map((ds, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-kb-danger/10 text-kb-danger border border-kb-danger/20">
                              {ds}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <button onClick={() => removeTerm(i)} className="text-kb-text-dim hover:text-kb-danger transition-colors text-xs">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "llm" && (
        <div className="space-y-6">
          {loadingInit ? (
            <div className="space-y-4">
              <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
                <div className="h-5 w-48 bg-kb-surface-3 rounded animate-pulse mb-4" />
                <div className="grid grid-cols-3 gap-4">
                  {[1,2,3].map(i => <div key={i} className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />)}
                </div>
              </div>
              <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
                <div className="h-5 w-48 bg-kb-surface-3 rounded animate-pulse mb-4" />
                <div className="grid grid-cols-3 gap-4">
                  {[1,2,3].map(i => <div key={i} className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />)}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Current Status */}
              {llmConfig && (
                <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-kb-success animate-pulse" />
                    <span className="text-sm text-kb-text">
                      Currently using <strong>{llmConfig.generationProvider}/{llmConfig.generationModel}</strong> for generation
                      and <strong>{llmConfig.embeddingProvider}/{llmConfig.embeddingModel}</strong> for embeddings.
                    </span>
                  </div>
                </div>
              )}

              {/* Generation Config */}
              <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
                <h3 className="text-base font-semibold text-kb-text mb-1">🧠 Generation Provider</h3>
                <p className="text-xs text-kb-text-dim mb-4">Used for AI-powered content generation, queries, and BRD/PRD output.</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">Provider</label>
                    <select value={genProvider} onChange={(e) => setGenProvider(e.target.value)} className="form-input">
                      {llmOptions.generation.map((o) => (
                        <option key={o.provider} value={o.provider}>{o.provider.charAt(0).toUpperCase() + o.provider.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">Model</label>
                    <select value={genModel} onChange={(e) => setGenModel(e.target.value)} className="form-input">
                      {(llmOptions.generation.find((o) => o.provider === genProvider)?.models || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">
                      API Key {llmConfig?.hasGenerationKey && <span className="text-kb-success">(saved ✓)</span>}
                    </label>
                    <input type="password" value={genApiKey} onChange={(e) => setGenApiKey(e.target.value)} className="form-input"
                      placeholder={llmConfig?.hasGenerationKey ? "••••••••••• (leave blank to keep)" : "gsk_... (Groq API key)"} />
                  </div>
                </div>
              </div>

              {/* Embedding Config */}
              <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
                <h3 className="text-base font-semibold text-kb-text mb-1">📐 Embedding Provider</h3>
                <p className="text-xs text-kb-text-dim mb-4">Embeddings run on your self-hosted Ollama server (Groq has no embeddings).</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">Provider</label>
                    <select value={embProvider} onChange={(e) => setEmbProvider(e.target.value)} className="form-input">
                      {llmOptions.embedding.map((o) => (
                        <option key={o.provider} value={o.provider}>{o.provider.charAt(0).toUpperCase() + o.provider.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">Model</label>
                    <select value={embModel} onChange={(e) => setEmbModel(e.target.value)} className="form-input">
                      {(llmOptions.embedding.find((o) => o.provider === embProvider)?.models || []).map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-kb-text-dim mb-1 block">
                      Base URL {llmConfig?.hasEmbeddingKey && <span className="text-kb-success">(saved ✓)</span>}
                    </label>
                    <input type="text" value={embApiKey} onChange={(e) => setEmbApiKey(e.target.value)} className="form-input"
                      placeholder={llmConfig?.hasEmbeddingKey ? "••••••••••• (leave blank to keep)" : "https://<you>-<space>.hf.space  (Ollama base URL)"} />
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex items-center gap-4 flex-wrap">
                <button onClick={saveLlmConfig} disabled={llmSaving}
                  className="px-6 py-2.5 bg-kb-primary text-white rounded-lg text-sm font-semibold hover:bg-kb-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-kb-primary/20">
                  {llmSaving ? "Saving..." : "💾 Save LLM Configuration"}
                </button>
                <button
                  onClick={async () => {
                    setLlmMsg("🔄 Re-embedding all features & scenarios...");
                    try {
                      const resp = await fetch("/api/kb", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "re-embed-all" }),
                      });
                      const data = await resp.json();
                      if (!resp.ok) { setLlmMsg(`❌ ${data.error}`); return; }
                      setLlmMsg(`✅ Re-embedded ${data.chunksEmbedded ?? 0} chunks (${data.features ?? 0} features, ${data.scenarios ?? 0} scenarios, ${data.failed ?? 0} failed)`);
                    } catch { setLlmMsg("❌ Network error"); }
                  }}
                  disabled={llmSaving}
                  className="px-5 py-2.5 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 border border-amber-500/30 transition-all disabled:opacity-50"
                >
                  🔄 Re-embed All
                </button>
                {llmMsg && (
                  <span className={`text-sm ${llmMsg.startsWith("✅") ? "text-kb-success" : llmMsg.startsWith("🔄") ? "text-amber-400" : "text-kb-danger"}`}>{llmMsg}</span>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-kb-surface-2 rounded-xl border border-kb-border/50 p-5 text-sm text-kb-text-muted space-y-2">
                <p className="font-medium text-kb-text">💡 How it works:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Generation</strong> — Powers the Query &amp; Generate page (RAG), BRD/PRD output, and AI suggestions.</li>
                  <li><strong>Embeddings</strong> — Converts your KB features into vectors stored in pgvector.</li>
                  <li>When you save/update a feature, its content is automatically embedded.</li>
                  <li>Queries search these vectors to find relevant context before generating.</li>
                  <li>You can use different providers for generation vs embeddings.</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}



      {/* Review Queue Tab */}
      {activeTab === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-kb-text">Review Queue</h3>
              <p className="text-xs text-kb-text-dim">Features submitted for review — approve or send back to draft</p>
            </div>
            <button
              onClick={loadReviewFeatures}
              className="px-3 py-1.5 bg-kb-surface-2 text-kb-text-muted text-xs rounded-lg hover:bg-kb-surface-3 border border-kb-border transition-colors"
            >
              🔄 Refresh
            </button>
          </div>

          {reviewLoading ? (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
              <p className="text-sm text-kb-text-muted">Loading review queue...</p>
            </div>
          ) : reviewFeatures.length === 0 ? (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-lg font-semibold text-kb-text mb-2">All clear!</h3>
              <p className="text-sm text-kb-text-muted">No features pending review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewFeatures.map((f) => (
                <div key={f.id} className="bg-kb-surface rounded-xl border border-kb-border p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-kb-text truncate">{f.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">review</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-kb-text-dim">
                      <span>🧩 {f.module?.name || 'Unknown'}</span>
                      <span>· {f.completeness}% complete</span>
                      <span>· Updated {new Date(f.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleReviewAction(f.module?.slug || '', f.slug, 'APPROVED')}
                      className="px-4 py-2 bg-green-500/15 text-green-400 text-sm rounded-lg hover:bg-green-500/25 border border-green-500/20 transition-colors font-medium"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReviewAction(f.module?.slug || '', f.slug, 'DRAFT')}
                      className="px-3 py-2 bg-red-500/15 text-red-400 text-sm rounded-lg hover:bg-red-500/25 border border-red-500/20 transition-colors"
                    >
                      ↩️ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confluence Config Tab */}
      {activeTab === "confluence" && (
        <div className="space-y-6">
          {confConfigured && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-kb-success animate-pulse" />
                <span className="text-sm text-kb-text">
                  Connected to <strong>{confBaseUrl}</strong> as <strong>{confEmail}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
            <h3 className="text-base font-semibold text-kb-text mb-1">🔗 Confluence Connection</h3>
            <p className="text-xs text-kb-text-dim mb-4">Connect your Atlassian Confluence to import pages directly into the Ingest pipeline.</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-kb-text-dim mb-1 block">Confluence Base URL</label>
                <input value={confBaseUrl} onChange={(e) => setConfBaseUrl(e.target.value)} className="form-input" placeholder="https://yourcompany.atlassian.net/wiki" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-kb-text-dim mb-1 block">Atlassian Email</label>
                  <input value={confEmail} onChange={(e) => setConfEmail(e.target.value)} className="form-input" placeholder="you@company.com" />
                </div>
                <div>
                  <label className="text-xs text-kb-text-dim mb-1 block">API Token {confConfigured && <span className="text-kb-success">(saved ✓)</span>}</label>
                  <input type="password" value={confApiToken} onChange={(e) => setConfApiToken(e.target.value)} className="form-input" placeholder={confConfigured ? "••••••••••• (leave blank to keep)" : "Atlassian API token"} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={async () => {
                if (!confBaseUrl || !confEmail || (!confApiToken && !confConfigured)) {
                  setConfMsg("❌ All fields are required");
                  return;
                }
                setConfSaving(true);
                setConfMsg("");
                try {
                  const res = await fetch("/api/confluence", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ baseUrl: confBaseUrl, email: confEmail, apiToken: confApiToken || "__keep__" }),
                  });
                  if (res.ok) {
                    setConfConfigured(true);
                    setConfApiToken("");
                    setConfMsg("✅ Confluence connected!");
                  } else {
                    const err = await res.json();
                    setConfMsg(`❌ ${err.error || "Failed to save"}`);
                  }
                } catch {
                  setConfMsg("❌ Network error");
                }
                setConfSaving(false);
                setTimeout(() => setConfMsg(""), 4000);
              }}
              disabled={confSaving}
              className="px-6 py-2.5 bg-kb-primary text-white rounded-lg text-sm font-semibold hover:bg-kb-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-kb-primary/20"
            >
              {confSaving ? "Saving..." : "💾 Save Confluence Config"}
            </button>
            {confMsg && <span className={`text-sm ${confMsg.startsWith("✅") ? "text-kb-success" : "text-kb-danger"}`}>{confMsg}</span>}
          </div>

          <div className="bg-kb-surface-2 rounded-xl border border-kb-border/50 p-5 text-sm text-kb-text-muted space-y-2">
            <p className="font-medium text-kb-text">💡 How to get an API token:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Go to <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" className="text-kb-primary-light underline">Atlassian API Tokens</a></li>
              <li>Click &ldquo;Create API token&rdquo;</li>
              <li>Give it a label (e.g., &ldquo;Knowledge Base&rdquo;) and copy the token</li>
              <li>Paste it here along with your Atlassian email</li>
            </ol>
          </div>
        </div>
      )}

      {/* Stale Docs Tab */}
      {activeTab === "stale" && (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
          <div className="text-4xl mb-3">⏰</div>
          <h3 className="text-lg font-semibold text-kb-text mb-2">Stale Documents Report</h3>
          <p className="text-sm text-kb-text-muted max-w-md mx-auto">
            Documents not updated beyond their review cycle will appear here.
            Quarterly reviews help keep your KB accurate and current.
          </p>
        </div>
      )}
    </div>
  );
}
