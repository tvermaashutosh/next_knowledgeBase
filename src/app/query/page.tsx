"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/lib/use-local-storage";

interface ProductOption {
  name: string;
  slug: string;
}

interface FeatureOption {
  product: string;
  module: string;
  feature: string;
  slug: string;
  moduleSlug: string;
  applicableProducts: string[];
}

interface ContextChunk {
  id: string;
  featureId: string;
  section: string;
  chunkText: string;
  similarity: number;
  // Enriched metadata
  productName?: string;
  moduleSlug?: string;
  featureTitle?: string;
  featureSlug?: string;
  scenarioSlug?: string | null;
  sectionName?: string;
  type?: "feature" | "scenario" | "override";
  tenantSlug?: string | null;
}

interface SmartFix {
  action: "edit";
  chunkId: string;
  currentText: string;
  suggestedText: string;
  reason: string;
}

interface SmartCreate {
  action: "create";
  entityType: "scenario" | "feature";
  moduleSlug: string;
  featureSlug?: string;
  title: string;
  content: string;
  reason: string;
}

type SmartFixPhase = "idle" | "entering" | "analyzing" | "showing" | "applying" | "done";

type QueryMode = "requirements" | "user-stories" | "impact-analysis" | "free-query";

const MODE_PROMPTS: Record<QueryMode, string> = {
  requirements: `You are an expert. Generate structured requirements (REQ-001, REQ-002, etc.) with acceptance criteria in Given/When/Then format.`,
  "user-stories": `You are an expert. Generate user stories in "As a [role], I want [action], so that [value]" format with acceptance criteria checkboxes.`,
  "impact-analysis": `You are an expert. Generate an impact analysis table showing affected features, impact description, and severity (🔴 High, 🟡 Medium, 🟢 Low).`,
  "free-query": `You are an expert in FMCG/distribution software. Answer the question using the Knowledge Base context.`,
};

function QueryPageContent() {
  const searchParams = useSearchParams();
  const productParam = searchParams.get("product") || "";
  const featureParam = searchParams.get("feature") || "";

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureOption[]>([]);
  const [tenants, setTenants] = useState<{ name: string; slug: string }[]>([]);

  // URL params take priority (e.g. when navigating from Browse KB)
  const [selectedProduct, setSelectedProduct] = useLocalStorage("kb_query_product", productParam);
  const [selectedModule, setSelectedModule] = useLocalStorage("kb_query_module", "");
  const [selectedFeature, setSelectedFeature] = useState(featureParam);
  const [selectedTenant, setSelectedTenant] = useLocalStorage("kb_query_tenant", "");
  const [queryMode, setQueryMode] = useLocalStorage<QueryMode>("kb_query_mode", "requirements");
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [contextChunks, setContextChunks] = useState<ContextChunk[]>([]);
  const [excludedChunks, setExcludedChunks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [tenantOverrideCount, setTenantOverrideCount] = useState(0);
  const [usage, setUsage] = useState<{ promptTokens: number; completionTokens: number } | null>(null);

  // Chunk modal state
  const [viewingChunk, setViewingChunk] = useState<ContextChunk | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingChunkText, setEditingChunkText] = useState("");
  const [savingChunk, setSavingChunk] = useState(false);
  const [chunkSaveSuccess, setChunkSaveSuccess] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Smart KB Fix state
  const [smartFixPhase, setSmartFixPhase] = useState<SmartFixPhase>("idle");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [smartFixes, setSmartFixes] = useState<SmartFix[]>([]);
  const [smartCreates, setSmartCreates] = useState<SmartCreate[]>([]);
  const [smartFixSummary, setSmartFixSummary] = useState("");
  const [approvedFixes, setApprovedFixes] = useState<Set<number>>(new Set());
  const [approvedCreates, setApprovedCreates] = useState<Set<number>>(new Set());
  const [smartFixError, setSmartFixError] = useState("");
  const [applyResult, setApplyResult] = useState<{ applied: number; skipped: number; errors: number } | null>(null);

  useEffect(() => {
    let remaining = 2;
    const done = () => { remaining--; if (remaining === 0) setLoadingInit(false); };
    fetch("/api/kb?action=products").then((r) => r.json()).then((d) => { setProducts(Array.isArray(d) ? d : []); done(); }).catch(done);
    fetch("/api/kb?action=all-features").then((r) => r.json()).then((d) => { setAllFeatures(Array.isArray(d) ? d : []); done(); }).catch(done);
    fetch("/api/kb?action=tenants").then((r) => r.json()).then(setTenants).catch(() => {});
  }, []);

  // Derive unique modules from allFeatures
  const modules = Array.from(
    new Map(allFeatures.map((f) => [f.moduleSlug, f.module])).entries()
  ).map(([slug, name]) => ({ slug, name }));

  // Filter modules by product (if a product is selected, show modules whose features apply to it)
  const filteredModules = selectedProduct
    ? modules.filter((m) =>
        allFeatures.some(
          (f) => f.moduleSlug === m.slug && (f.applicableProducts ?? []).includes(selectedProduct)
        )
      )
    : modules;

  // Filter features by module first, then by product
  const filteredFeatures = allFeatures.filter((f) => {
    if (selectedModule && f.moduleSlug !== selectedModule) return false;
    if (selectedProduct && !(f.applicableProducts ?? []).includes(selectedProduct)) return false;
    return true;
  });

  const handleGenerate = async () => {
    if (!query.trim()) return;
    setGenerating(true);
    setResult("");
    setError("");
    setContextChunks([]);
    setUsage(null);

    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          product: selectedProduct || undefined,
          module: selectedModule || undefined,
          tenant: selectedTenant || undefined,
          topK: 10,
          excludeChunkIds: excludedChunks,
          customSystemPrompt: MODE_PROMPTS[queryMode],
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      setResult(data.output || "");
      setContextChunks(data.contextChunks || []);
      setModel(data.model || "");
      setUsage(data.usage || null);
      setTenantOverrideCount(data.tenantOverrides || 0);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setGenerating(false);
      // Reset Smart Fix when regenerating
      setSmartFixPhase("idle");
      setSmartFixes([]);
      setSmartCreates([]);
      setExpectedAnswer("");
      setApplyResult(null);
    }
  };

  const toggleExcludeChunk = (chunkId: string) => {
    setExcludedChunks((prev) =>
      prev.includes(chunkId) ? prev.filter((id) => id !== chunkId) : [...prev, chunkId]
    );
  };

  const openChunkView = (chunk: ContextChunk) => {
    setViewingChunk(chunk);
    setIsEditMode(false);
    setEditingChunkText(chunk.chunkText);
    setChunkSaveSuccess(null);
  };

  const openChunkEdit = (chunk: ContextChunk) => {
    setViewingChunk(chunk);
    setIsEditMode(true);
    setEditingChunkText(chunk.chunkText);
    setChunkSaveSuccess(null);
  };

  const closeChunkModal = () => {
    setViewingChunk(null);
    setIsEditMode(false);
    setEditingChunkText("");
  };

  const saveChunkEdit = async () => {
    if (!viewingChunk || !editingChunkText.trim()) return;
    setSavingChunk(true);
    setChunkSaveSuccess(null);

    try {
      let resp: Response;

      if (viewingChunk.id.startsWith("override-")) {
        // Save override via KB API
        const isScenarioOverride = viewingChunk.id.startsWith("override-scenario-");
        const action = isScenarioOverride ? "save-scenario-override" : "save-tenant-override";
        const body: Record<string, string> = {
          action,
          tenantSlug: viewingChunk.tenantSlug || "",
          moduleSlug: viewingChunk.moduleSlug || "",
          featureSlug: viewingChunk.featureSlug || "",
          contentMd: editingChunkText,
        };
        if (isScenarioOverride && viewingChunk.scenarioSlug) {
          body.scenarioSlug = viewingChunk.scenarioSlug;
        }
        resp = await fetch("/api/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        // Save regular chunk via chunks API
        resp = await fetch("/api/chunks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: viewingChunk.id, chunkText: editingChunkText }),
        });
      }

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Failed to save");
        return;
      }

      setContextChunks((prev) =>
        prev.map((c) => (c.id === viewingChunk.id ? { ...c, chunkText: editingChunkText } : c))
      );

      setChunkSaveSuccess(viewingChunk.id);
      setIsEditMode(false);
      setTimeout(() => setChunkSaveSuccess(null), 3000);
    } catch {
      setError("Network error saving");
    } finally {
      setSavingChunk(false);
    }
  };

  // ── Smart KB Fix handlers ──
  const handleSmartFixAnalyze = async () => {
    if (!expectedAnswer.trim()) return;
    setSmartFixPhase("analyzing");
    setSmartFixError("");
    setSmartFixes([]);
    setSmartCreates([]);
    setApplyResult(null);

    try {
      const resp = await fetch("/api/smart-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          actualAnswer: result,
          expectedAnswer,
          contextChunks: contextChunks.map((c) => ({
            id: c.id,
            chunkText: c.chunkText,
            featureTitle: c.featureTitle,
            sectionName: c.sectionName || c.section,
            type: c.type,
            moduleSlug: c.moduleSlug,
            featureSlug: c.featureSlug,
            scenarioSlug: c.scenarioSlug,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSmartFixError(data.error || "Analysis failed");
        setSmartFixPhase("entering");
        return;
      }
      setSmartFixes(data.fixes || []);
      setSmartCreates(data.creates || []);
      setSmartFixSummary(data.summary || "");
      // Auto-approve all by default
      setApprovedFixes(new Set((data.fixes || []).map((_: SmartFix, i: number) => i)));
      setApprovedCreates(new Set((data.creates || []).map((_: SmartCreate, i: number) => i)));
      setSmartFixPhase("showing");
    } catch {
      setSmartFixError("Network error");
      setSmartFixPhase("entering");
    }
  };

  const handleSmartFixApply = async () => {
    setSmartFixPhase("applying");
    try {
      const selectedFixes = smartFixes.filter((_, i) => approvedFixes.has(i));
      const selectedCreates = smartCreates.filter((_, i) => approvedCreates.has(i));

      const resp = await fetch("/api/smart-fix/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixes: selectedFixes, creates: selectedCreates, query }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSmartFixError(data.error || "Apply failed");
        setSmartFixPhase("showing");
        return;
      }
      setApplyResult({ applied: data.applied, skipped: data.skipped, errors: data.errors });
      setSmartFixPhase("done");
    } catch {
      setSmartFixError("Network error applying fixes");
      setSmartFixPhase("showing");
    }
  };

  const toggleApprovedFix = (idx: number) => {
    setApprovedFixes((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleApprovedCreate = (idx: number) => {
    setApprovedCreates((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Query & Generate</h1>
        <p className="text-kb-text-muted mt-1">Search your KB and generate requirements, user stories, or impact analysis</p>
      </div>

      {/* Context Selectors */}
      <div className="bg-kb-surface rounded-xl border border-kb-border p-6 mb-6">
        <h3 className="text-sm font-medium text-kb-text-muted mb-3">Context (helps AI give precise answers)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Product</label>
            {loadingInit ? (
              <div className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />
            ) : (
              <select value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setSelectedModule(""); setSelectedFeature(""); }} className="form-input text-sm">
                <option value="">All products</option>
                {products.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Module</label>
            {loadingInit ? (
              <div className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />
            ) : (
              <select value={selectedModule} onChange={(e) => { setSelectedModule(e.target.value); setSelectedFeature(""); }} className="form-input text-sm">
                <option value="">All modules</option>
                {filteredModules.map((m) => (<option key={m.slug} value={m.slug}>{m.name}</option>))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Feature</label>
            {loadingInit ? (
              <div className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />
            ) : (
              <select value={selectedFeature} onChange={(e) => setSelectedFeature(e.target.value)} className="form-input text-sm">
                <option value="">All features</option>
                {filteredFeatures.map((f) => (<option key={f.slug} value={f.slug}>{f.feature}</option>))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Tenant</label>
            <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="form-input text-sm">
              <option value="">None (product-level)</option>
              {tenants.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Scenario</label>
            <select className="form-input text-sm" disabled>
              <option>Auto-detected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Query Input */}
      <div className="bg-kb-surface rounded-xl border border-kb-border p-6 mb-6">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="form-input min-h-[100px] mb-4"
          placeholder="e.g., Generate requirements for adding percentage-based free goods to BOGOF promotions..."
        />

        <div className="flex items-center gap-6 mb-4">
          <span className="text-xs text-kb-text-dim">Generate:</span>
          {(["requirements", "user-stories", "impact-analysis", "free-query"] as QueryMode[]).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="queryMode"
                checked={queryMode === mode}
                onChange={() => setQueryMode(mode)}
                className="accent-kb-primary"
              />
              <span className={`text-sm ${queryMode === mode ? "text-kb-text font-medium" : "text-kb-text-muted"}`}>
                {mode === "requirements" ? "Requirements" : mode === "user-stories" ? "User Stories" : mode === "impact-analysis" ? "Impact Analysis" : "Free Query"}
              </span>
            </label>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !query.trim()}
          className="px-6 py-2.5 bg-gradient-to-r from-kb-primary to-kb-primary-dark text-white rounded-lg text-sm font-medium hover:from-kb-primary-light hover:to-kb-primary shadow-lg shadow-kb-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Generating...
            </span>
          ) : "Generate →"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 mb-6 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Two-column layout: Result + Context Panel */}
      {(result || contextChunks.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Result (2/3 width) */}
          <div className="lg:col-span-2 bg-kb-surface rounded-xl border border-kb-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-kb-text">Generated Output</h3>
                {model && <p className="text-xs text-kb-text-dim mt-0.5">Model: {model}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="px-3 py-1.5 text-xs bg-kb-surface-2 text-kb-text-muted rounded-lg hover:bg-kb-surface-3 border border-kb-border/50 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-3 py-1.5 text-xs bg-kb-primary/20 text-kb-primary rounded-lg hover:bg-kb-primary/30 border border-kb-primary/30 transition-colors disabled:opacity-50"
                >
                  {generating ? "⏳ Regenerating..." : "🔄 Regenerate"}
                </button>
                <button
                  onClick={() => setSmartFixPhase(smartFixPhase === "idle" ? "entering" : "idle")}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    smartFixPhase !== "idle"
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-kb-surface-2 text-kb-text-muted border-kb-border/50 hover:bg-kb-surface-3"
                  }`}
                >
                  🔧 Smart KB Fix
                </button>
              </div>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-kb-text-muted leading-relaxed bg-kb-surface-2 rounded-lg p-4 border border-kb-border/50">
                {result}
              </pre>
            </div>
            {usage && (
              <div className="mt-3 flex gap-4 text-xs text-kb-text-dim">
                <span>Prompt: {usage.promptTokens} tokens</span>
                <span>Output: {usage.completionTokens} tokens</span>
              </div>
            )}

            {/* ── Smart KB Fix Panel ── */}
            {smartFixPhase !== "idle" && (
              <div className="mt-4 border-t border-kb-border/50 pt-4">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-amber-400">🔧 Smart KB Fix</span>
                  {smartFixPhase === "done" && applyResult && (
                    <span className="text-xs text-green-400">✅ {applyResult.applied} fix{applyResult.applied !== 1 ? "es" : ""} applied</span>
                  )}
                </div>

                {/* Error */}
                {smartFixError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 mb-3 text-xs">
                    ⚠️ {smartFixError}
                  </div>
                )}

                {/* Expected Answer Input */}
                {(smartFixPhase === "entering" || smartFixPhase === "analyzing") && (
                  <div className="space-y-3">
                    <p className="text-xs text-kb-text-dim">Paste the <strong>correct/expected answer</strong> below. The AI will compare it against the generated output and suggest which KB chunks to fix.</p>
                    <textarea
                      value={expectedAnswer}
                      onChange={(e) => setExpectedAnswer(e.target.value)}
                      placeholder="Type what the correct answer should be..."
                      className="w-full bg-kb-surface-3 text-kb-text text-sm rounded-lg p-4 border border-amber-500/20 min-h-[120px] resize-y focus:outline-none focus:border-amber-500/50 leading-relaxed"
                    />
                    <button
                      onClick={handleSmartFixAnalyze}
                      disabled={smartFixPhase === "analyzing" || !expectedAnswer.trim()}
                      className="px-5 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 border border-amber-500/30 transition-colors disabled:opacity-50 font-medium"
                    >
                      {smartFixPhase === "analyzing" ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Analyzing...
                        </span>
                      ) : "🔍 Analyze & Suggest Fixes"}
                    </button>
                  </div>
                )}

                {/* Fixes List */}
                {(smartFixPhase === "showing" || smartFixPhase === "applying" || smartFixPhase === "done") && (
                  <div className="space-y-3">
                    {smartFixSummary && (
                      <p className="text-xs text-kb-text-muted bg-kb-surface-2 rounded-lg p-3 border border-kb-border/50">
                        📝 {smartFixSummary}
                      </p>
                    )}

                    {smartFixes.length === 0 && smartCreates.length === 0 && (
                      <p className="text-xs text-green-400 p-3">✅ No changes needed — the KB already supports the expected answer.</p>
                    )}

                    {/* Edit Fixes */}
                    {smartFixes.map((fix, i) => (
                      <div key={`fix-${i}`} className={`rounded-lg border p-3 transition-all ${approvedFixes.has(i) ? "bg-kb-surface-2 border-amber-500/30" : "bg-kb-surface-2/50 border-kb-border/30 opacity-60"}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={approvedFixes.has(i)}
                            onChange={() => toggleApprovedFix(i)}
                            className="accent-amber-500 mt-1 shrink-0"
                            disabled={smartFixPhase !== "showing"}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">✏️ EDIT</span>
                              <span className="text-[10px] text-kb-text-dim truncate">Chunk: {fix.chunkId.substring(0, 16)}...</span>
                            </div>
                            <p className="text-xs text-kb-text-muted mb-2 italic">{fix.reason}</p>
                            {/* Diff view */}
                            <div className="grid grid-cols-1 gap-1 text-[11px]">
                              <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
                                <span className="text-red-400 font-medium text-[10px]">BEFORE:</span>
                                <pre className="whitespace-pre-wrap font-sans text-red-300/80 mt-1 line-clamp-4">{fix.currentText}</pre>
                              </div>
                              <div className="bg-green-500/10 border border-green-500/20 rounded p-2">
                                <span className="text-green-400 font-medium text-[10px]">AFTER:</span>
                                <pre className="whitespace-pre-wrap font-sans text-green-300/80 mt-1 line-clamp-4">{fix.suggestedText}</pre>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Create Fixes */}
                    {smartCreates.map((create, i) => (
                      <div key={`create-${i}`} className={`rounded-lg border p-3 transition-all ${approvedCreates.has(i) ? "bg-kb-surface-2 border-green-500/30" : "bg-kb-surface-2/50 border-kb-border/30 opacity-60"}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={approvedCreates.has(i)}
                            onChange={() => toggleApprovedCreate(i)}
                            className="accent-green-500 mt-1 shrink-0"
                            disabled={smartFixPhase !== "showing"}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">➕ CREATE {create.entityType.toUpperCase()}</span>
                              <span className="text-[10px] text-kb-text-dim">{create.moduleSlug}{create.featureSlug ? ` › ${create.featureSlug}` : ""}</span>
                            </div>
                            <p className="text-xs font-medium text-kb-text mb-1">{create.title}</p>
                            <p className="text-xs text-kb-text-muted mb-2 italic">{create.reason}</p>
                            <pre className="text-[11px] whitespace-pre-wrap font-sans text-kb-text-dim bg-kb-surface-3 rounded p-2 border border-kb-border/30 line-clamp-6">{create.content}</pre>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Apply button */}
                    {smartFixPhase === "showing" && (smartFixes.length > 0 || smartCreates.length > 0) && (
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={handleSmartFixApply}
                          disabled={approvedFixes.size + approvedCreates.size === 0}
                          className="px-5 py-2 text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                        >
                          ✅ Apply {approvedFixes.size + approvedCreates.size} Fix{(approvedFixes.size + approvedCreates.size) !== 1 ? "es" : ""}
                        </button>
                        <span className="text-[10px] text-kb-text-dim">
                          {approvedFixes.size} edit{approvedFixes.size !== 1 ? "s" : ""}, {approvedCreates.size} create{approvedCreates.size !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {/* Applying spinner */}
                    {smartFixPhase === "applying" && (
                      <div className="flex items-center gap-2 text-sm text-amber-400 py-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Applying fixes...
                      </div>
                    )}

                    {/* Done state */}
                    {smartFixPhase === "done" && applyResult && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-xs text-green-400">
                        <p className="font-medium">✅ Smart Fix Complete</p>
                        <p className="mt-1">{applyResult.applied} applied, {applyResult.skipped} skipped, {applyResult.errors} error{applyResult.errors !== 1 ? "s" : ""}</p>
                        <p className="mt-2 text-kb-text-dim">Click "🔄 Regenerate" above to verify the fix worked.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Context Panel (1/3 width) */}
          <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
            <h3 className="text-xs font-semibold text-kb-text-muted uppercase tracking-wider mb-3">
              Context Chunks Used ({contextChunks.filter((c) => !excludedChunks.includes(c.id)).length}/{contextChunks.length})
            </h3>
            <p className="text-[10px] text-kb-text-dim mb-3">
              Uncheck chunks and click Regenerate. Click ✏️ to edit a chunk.
            </p>

            {/* Show regenerate hint when chunks are excluded */}
            {excludedChunks.length > 0 && (
              <div className="mb-3 p-2 bg-kb-primary/10 border border-kb-primary/20 rounded-lg">
                <p className="text-[10px] text-kb-primary font-medium">
                  {excludedChunks.length} chunk{excludedChunks.length > 1 ? "s" : ""} excluded — click &quot;🔄 Regenerate&quot; above to see updated results
                </p>
              </div>
            )}

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {contextChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className={`p-3 rounded-lg border text-xs transition-all cursor-pointer hover:border-kb-primary/40 ${
                    excludedChunks.includes(chunk.id)
                      ? "bg-kb-surface-2/50 border-kb-border/30 opacity-50"
                      : chunkSaveSuccess === chunk.id
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-kb-surface-2 border-kb-border/50"
                  }`}
                >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!excludedChunks.includes(chunk.id)}
                        onChange={() => toggleExcludeChunk(chunk.id)}
                        className="accent-kb-primary mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1" onClick={() => openChunkView(chunk)}>
                        {/* Type badge + similarity */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            chunk.type === "override"
                              ? "bg-amber-500/20 text-amber-400"
                              : chunk.type === "scenario"
                              ? "bg-purple-500/15 text-purple-400"
                              : "bg-kb-primary/15 text-kb-primary"
                          }`}>
                            {chunk.type === "override" ? "🏢 OVERRIDE" : chunk.type === "scenario" ? "📋 SCENARIO" : "📦 FEATURE"}
                          </span>
                          <span className="text-[10px] text-kb-primary ml-auto shrink-0">
                            {(chunk.similarity * 100).toFixed(0)}%
                          </span>
                          {chunkSaveSuccess === chunk.id && (
                            <span className="text-[10px] text-green-400 shrink-0">✅</span>
                          )}
                        </div>
                        {/* Product > Feature > Scenario breadcrumb */}
                        <div className="text-[10px] text-kb-text-dim mb-1 leading-tight">
                          {chunk.productName && (
                            <span>{chunk.productName}</span>
                          )}
                          {chunk.featureTitle && (
                            <span> › <span className="text-kb-text-muted font-medium">{chunk.featureTitle}</span></span>
                          )}
                          {chunk.scenarioSlug && (
                            <span> › <span className="text-purple-400">{chunk.scenarioSlug}</span></span>
                          )}
                        </div>
                        {/* Section name */}
                        <div className="text-[10px] font-medium text-kb-text mb-1">
                          [{chunk.sectionName || chunk.section}]
                        </div>
                        <p className="text-kb-text-dim text-[10px] line-clamp-2">{chunk.chunkText}</p>
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => openChunkView(chunk)}
                          title="View full chunk"
                          className="p-1 text-kb-text-dim hover:text-kb-primary rounded transition-colors text-xs"
                        >
                          👁
                        </button>
                        <button
                          onClick={() => openChunkEdit(chunk)}
                          title="Edit this chunk"
                          className="p-1 text-kb-text-dim hover:text-kb-primary rounded transition-colors text-xs"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                </div>
              ))}
              {contextChunks.length === 0 && (
                <p className="text-kb-text-dim text-xs text-center py-4">
                  No embeddings found. Save some features first to build the KB index.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chunk View/Edit Modal ── */}
      {viewingChunk && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={closeChunkModal}>
          <div
            className="bg-kb-surface rounded-2xl border border-kb-border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-kb-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                  viewingChunk.type === "override"
                    ? "bg-amber-500/20 text-amber-400"
                    : viewingChunk.type === "scenario"
                    ? "bg-purple-500/15 text-purple-400"
                    : "bg-kb-primary/15 text-kb-primary"
                }`}>
                  {viewingChunk.type === "override" ? "🏢 OVERRIDE" : viewingChunk.type === "scenario" ? "📋 SCENARIO" : "📦 FEATURE"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-kb-primary font-medium">
                    {(viewingChunk.similarity * 100).toFixed(0)}% match
                  </span>
                  <button onClick={closeChunkModal} className="text-kb-text-dim hover:text-kb-text text-lg transition-colors">✕</button>
                </div>
              </div>
              {/* Breadcrumb */}
              <div className="text-xs text-kb-text-dim leading-relaxed">
                {viewingChunk.productName && <span className="text-kb-text-muted">{viewingChunk.productName}</span>}
                {viewingChunk.featureTitle && <span> › <span className="font-medium text-kb-text">{viewingChunk.featureTitle}</span></span>}
                {viewingChunk.scenarioSlug && <span> › <span className="text-purple-400 font-medium">{viewingChunk.scenarioSlug}</span></span>}
              </div>
              <div className="text-xs font-medium text-kb-text mt-1">[{viewingChunk.sectionName || viewingChunk.section}]</div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {isEditMode ? (
                <textarea
                  value={editingChunkText}
                  onChange={(e) => setEditingChunkText(e.target.value)}
                  className="w-full bg-kb-surface-3 text-kb-text text-sm rounded-xl p-4 border border-kb-border/50 min-h-[300px] resize-y focus:outline-none focus:border-kb-primary/50 leading-relaxed"
                />
              ) : (
                <pre className="text-sm text-kb-text-muted whitespace-pre-wrap font-sans leading-relaxed">{viewingChunk.chunkText}</pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-kb-border/50 flex items-center justify-between">
              <div className="text-[10px] text-kb-text-dim">Chunk ID: {viewingChunk.id.substring(0, 20)}...</div>
              <div className="flex gap-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={() => { setIsEditMode(false); setEditingChunkText(viewingChunk.chunkText); }}
                      className="px-4 py-2 text-xs bg-kb-surface-3 text-kb-text-muted rounded-lg hover:bg-kb-surface-2 border border-kb-border/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveChunkEdit}
                      disabled={savingChunk}
                      className="px-4 py-2 text-xs bg-kb-primary text-white rounded-lg hover:bg-kb-primary-light transition-colors disabled:opacity-50 font-medium"
                    >
                      {savingChunk ? "⏳ Saving..." : viewingChunk.id.startsWith("override-") ? "💾 Save Override" : "💾 Save & Re-embed"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="px-4 py-2 text-xs bg-kb-primary/15 text-kb-primary rounded-lg hover:bg-kb-primary/25 border border-kb-primary/20 transition-colors font-medium"
                    >
                      ✏️ {viewingChunk.id.startsWith("override-") ? "Edit Override" : "Edit Chunk"}
                    </button>
                    <button
                      onClick={closeChunkModal}
                      className="px-4 py-2 text-xs bg-kb-surface-3 text-kb-text-muted rounded-lg hover:bg-kb-surface-2 border border-kb-border/50 transition-colors"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QueryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-kb-text-muted">Loading...</div>}>
      <QueryPageContent />
    </Suspense>
  );
}
