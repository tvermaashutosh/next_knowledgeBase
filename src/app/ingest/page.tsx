"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────

type SourceType = "text" | "confluence" | "image";

interface SourceItem {
  id: string;
  type: SourceType;
  content: string;
  meta?: {
    pageTitle?: string;
    pageUrl?: string;
    mimeType?: string;
    fileName?: string;
  };
  preview?: string; // short display text
}

interface ClassifiedEntity {
  id: string;
  action: "create" | "append";
  entityType: "product" | "module" | "feature" | "scenario";
  targetSlug?: string;
  targetModuleSlug?: string;
  data: Record<string, unknown>;
  confidence: number;
  reason: string;
  selected: boolean; // UI state
}

interface ConfluenceSearchResult {
  id: string;
  title: string;
  spaceKey: string;
  excerpt: string;
  url: string;
}

type WizardStep = 1 | 2 | 3;

// ─── Component ──────────────────────────────────────────

export default function IngestPage() {
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 — Sources
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [activeSourceType, setActiveSourceType] = useState<SourceType>("text");
  const [textInput, setTextInput] = useState("");
  const [confluenceQuery, setConfluenceQuery] = useState("");
  const [confluenceResults, setConfluenceResults] = useState<ConfluenceSearchResult[]>([]);
  const [confluenceSearching, setConfluenceSearching] = useState(false);
  const [confluenceConfigured, setConfluenceConfigured] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Classified
  const [entities, setEntities] = useState<ClassifiedEntity[]>([]);
  const [summary, setSummary] = useState("");
  const [jobId, setJobId] = useState("");
  const [classifying, setClassifying] = useState(false);

  // Step 3 — Applied
  const [applying, setApplying] = useState(false);
  const [applyResults, setApplyResults] = useState<Array<{ id: string; entityType: string; slug: string; success: boolean; error?: string }>>([]);

  const [error, setError] = useState("");

  // Check Confluence config on mount
  useEffect(() => {
    fetch("/api/confluence?action=config")
      .then((r) => r.json())
      .then((d) => setConfluenceConfigured(d.configured))
      .catch(() => setConfluenceConfigured(false));
  }, []);

  // ─── Source Management ────────────────────────────────

  const addTextSource = useCallback(() => {
    if (!textInput.trim()) return;
    setSources((prev) => [
      ...prev,
      {
        id: `src-${Date.now()}`,
        type: "text",
        content: textInput.trim(),
        preview: textInput.trim().slice(0, 100) + (textInput.length > 100 ? "..." : ""),
      },
    ]);
    setTextInput("");
  }, [textInput]);

  const searchConfluence = useCallback(async () => {
    if (!confluenceQuery.trim()) return;
    setConfluenceSearching(true);
    try {
      const res = await fetch(`/api/confluence?action=search&q=${encodeURIComponent(confluenceQuery)}`);
      const data = await res.json();
      if (res.ok) {
        setConfluenceResults(data);
      } else {
        setError(data.error || "Confluence search failed");
      }
    } catch {
      setError("Confluence search failed");
    }
    setConfluenceSearching(false);
  }, [confluenceQuery]);

  const addConfluenceSource = useCallback((result: ConfluenceSearchResult) => {
    setSources((prev) => [
      ...prev,
      {
        id: `src-${Date.now()}`,
        type: "confluence",
        content: result.id, // page ID
        meta: { pageTitle: result.title, pageUrl: result.url },
        preview: `📄 ${result.title}`,
      },
    ]);
    setConfluenceResults([]);
    setConfluenceQuery("");
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1]; // strip data:...,
        setSources((prev) => [
          ...prev,
          {
            id: `src-${Date.now()}-${file.name}`,
            type: "image",
            content: base64,
            meta: { mimeType: file.type, fileName: file.name },
            preview: `📷 ${file.name}`,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ─── Classify ─────────────────────────────────────────

  const handleClassify = async () => {
    if (sources.length === 0) return;
    setClassifying(true);
    setError("");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "classify",
          sources: sources.map((s) => ({
            type: s.type,
            content: s.content,
            meta: s.meta,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Classification failed");
        return;
      }

      setJobId(data.jobId);
      setEntities(
        (data.entities || []).map((e: ClassifiedEntity) => ({ ...e, selected: true }))
      );
      setSummary(data.summary || "");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setClassifying(false);
    }
  };

  // ─── Apply ────────────────────────────────────────────

  const handleApply = async () => {
    const selected = entities.filter((e) => e.selected);
    if (selected.length === 0) return;
    setApplying(true);
    setError("");

    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          jobId,
          entities: selected,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Apply failed");
        return;
      }

      setApplyResults(data.applied || []);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  // ─── Entity Editing ───────────────────────────────────

  const toggleEntity = (id: string) => {
    setEntities((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  };

  const removeEntity = (id: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEntityField = (entityId: string, field: string, value: unknown) => {
    setEntities((prev) =>
      prev.map((e) =>
        e.id === entityId ? { ...e, data: { ...e.data, [field]: value } } : e
      )
    );
  };

  // ─── Reset ────────────────────────────────────────────

  const handleReset = () => {
    setSources([]);
    setEntities([]);
    setSummary("");
    setJobId("");
    setApplyResults([]);
    setError("");
    setStep(1);
  };

  // ─── Render ───────────────────────────────────────────

  const entityTypeIcons: Record<string, string> = {
    product: "📦",
    module: "🧩",
    feature: "⚡",
    scenario: "🎯",
  };

  const entityTypeColors: Record<string, string> = {
    product: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    module: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    feature: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    scenario: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Ingest</h1>
        <p className="text-kb-text-muted mt-1">
          Drop raw content — AI structures and classifies it into the KB
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { n: 1, label: "Add Sources" },
          { n: 2, label: "Review" },
          { n: 3, label: "Done" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step >= n
                  ? "bg-kb-primary text-white shadow-lg shadow-kb-primary/30"
                  : "bg-kb-surface-2 text-kb-text-dim border border-kb-border"
              }`}
            >
              {step > n ? "✓" : n}
            </div>
            <span
              className={`text-sm font-medium ${
                step >= n ? "text-kb-text" : "text-kb-text-dim"
              }`}
            >
              {label}
            </span>
            {n < 3 && (
              <div
                className={`w-12 h-0.5 ${
                  step > n ? "bg-kb-primary" : "bg-kb-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <span className="text-red-400 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-400/60 hover:text-red-400 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* ═══════════════ STEP 1: Add Sources ═══════════════ */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Source Type Selector */}
          <div className="flex gap-2 bg-kb-surface rounded-xl border border-kb-border p-1.5">
            {(
              [
                { type: "text" as SourceType, icon: "📝", label: "Text" },
                { type: "confluence" as SourceType, icon: "🔗", label: "Confluence" },
                { type: "image" as SourceType, icon: "📷", label: "Image" },
              ] as const
            ).map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => setActiveSourceType(type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeSourceType === type
                    ? "bg-kb-primary text-white shadow-lg shadow-kb-primary/20"
                    : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
                }`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Text Input */}
          {activeSourceType === "text" && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
              <h3 className="text-sm font-semibold text-kb-text mb-3">
                📝 Paste Text Content
              </h3>
              <p className="text-xs text-kb-text-dim mb-3">
                Meeting notes, PRD text, requirements doc, Jira descriptions…
              </p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="form-input min-h-[200px] text-sm"
                placeholder="Paste your content here. This can be meeting notes, PRD text, feature descriptions, rules, or any unstructured documentation...

Example:
We need an Order Management module that lets sales reps create and track orders at retail outlets. Orders above ₹10,000 need manager approval. The system should support FIFO inventory deduction and generate invoices automatically."
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={addTextSource}
                  disabled={!textInput.trim()}
                  className="px-4 py-2 bg-kb-primary text-white rounded-lg text-sm font-medium hover:bg-kb-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-kb-primary/20"
                >
                  + Add Text Source
                </button>
              </div>
            </div>
          )}

          {/* Confluence Input */}
          {activeSourceType === "confluence" && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
              <h3 className="text-sm font-semibold text-kb-text mb-3">
                🔗 Import from Confluence
              </h3>
              {confluenceConfigured === false ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-400">
                  <p className="font-medium mb-1">Confluence not configured</p>
                  <p className="text-xs text-amber-400/70">
                    Go to <strong>Admin → Confluence</strong> to set up your Atlassian credentials.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <input
                      value={confluenceQuery}
                      onChange={(e) => setConfluenceQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchConfluence()}
                      className="form-input flex-1"
                      placeholder="Search Confluence pages..."
                    />
                    <button
                      onClick={searchConfluence}
                      disabled={confluenceSearching || !confluenceQuery.trim()}
                      className="px-4 py-2 bg-kb-primary text-white rounded-lg text-sm font-medium hover:bg-kb-primary-dark transition-all disabled:opacity-50"
                    >
                      {confluenceSearching ? "Searching..." : "🔍 Search"}
                    </button>
                  </div>

                  {confluenceResults.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {confluenceResults.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between bg-kb-surface-2 rounded-lg px-4 py-3 border border-kb-border/50 hover:border-kb-primary/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-kb-text truncate">
                              {r.title}
                            </div>
                            <div className="text-xs text-kb-text-dim mt-0.5">
                              Space: {r.spaceKey}
                            </div>
                          </div>
                          <button
                            onClick={() => addConfluenceSource(r)}
                            className="ml-3 px-3 py-1.5 bg-kb-primary/15 text-kb-primary-light text-xs rounded-lg hover:bg-kb-primary/25 border border-kb-primary/20 transition-colors font-medium shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Image Input */}
          {activeSourceType === "image" && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
              <h3 className="text-sm font-semibold text-kb-text mb-3">
                📷 Upload Images
              </h3>
              <p className="text-xs text-kb-text-dim mb-3">
                Screenshots, wireframes, Jira tickets, flow diagrams — AI will
                describe and extract content using vision.
              </p>
              <div
                className="border-2 border-dashed border-kb-border rounded-xl p-8 text-center hover:border-kb-primary/40 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-4xl mb-2">📁</div>
                <p className="text-sm text-kb-text-muted">
                  Click to upload or drag images here
                </p>
                <p className="text-xs text-kb-text-dim mt-1">
                  PNG, JPG, WebP, GIF — up to 20MB each
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Added Sources List */}
          {sources.length > 0 && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
              <h3 className="text-sm font-medium text-kb-text-muted mb-3">
                📋 Added Sources ({sources.length})
              </h3>
              <div className="space-y-2">
                {sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-kb-surface-2 rounded-lg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">
                        {s.type === "text" ? "📝" : s.type === "confluence" ? "🔗" : "📷"}
                      </span>
                      <span className="text-sm text-kb-text truncate">
                        {s.preview || s.content.slice(0, 80)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeSource(s.id)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded transition-all shrink-0"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classify Button */}
          <div className="flex justify-end">
            <button
              onClick={handleClassify}
              disabled={sources.length === 0 || classifying}
              className="px-6 py-3 bg-gradient-to-r from-kb-primary to-kb-primary-dark text-white rounded-xl text-sm font-bold
                         hover:shadow-xl hover:shadow-kb-primary/30 transition-all disabled:opacity-50
                         flex items-center gap-2"
            >
              {classifying ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing & Classifying...
                </>
              ) : (
                <>🚀 Analyze & Classify</>
              )}
            </button>
          </div>

          {classifying && (
            <div className="bg-kb-surface rounded-xl border border-kb-primary/20 p-6 text-center">
              <div className="flex justify-center gap-1 mb-3">
                <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm text-kb-text-muted">
                Reading sources, fetching KB context, and classifying with AI...
              </p>
              <p className="text-xs text-kb-text-dim mt-1">
                This may take 15-30 seconds depending on content size.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STEP 2: Review Classified ═══════════════ */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary Banner */}
          {summary && (
            <div className="bg-gradient-to-r from-kb-primary/10 to-emerald-500/10 rounded-xl border border-kb-primary/20 p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <p className="text-sm font-medium text-kb-text">{summary}</p>
                  <p className="text-xs text-kb-text-dim mt-0.5">
                    Found {entities.length} entities —{" "}
                    {entities.filter((e) => e.action === "create").length} new,{" "}
                    {entities.filter((e) => e.action === "append").length} updates
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Entity Cards */}
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onToggle={toggleEntity}
              onRemove={removeEntity}
              onUpdateField={updateEntityField}
              entityTypeIcons={entityTypeIcons}
              entityTypeColors={entityTypeColors}
            />
          ))}

          {entities.length === 0 && (
            <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
              <p className="text-kb-text-muted">
                No entities were classified. Try adding more detailed sources.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-kb-text-muted hover:text-kb-text text-sm font-medium transition-colors"
            >
              ← Back to Sources
            </button>
            <button
              onClick={handleApply}
              disabled={applying || entities.filter((e) => e.selected).length === 0}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold
                         hover:shadow-xl hover:shadow-emerald-500/30 transition-all disabled:opacity-50
                         flex items-center gap-2"
            >
              {applying ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  ✅ Push {entities.filter((e) => e.selected).length} to KB
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: Done ═══════════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-kb-text mb-2">
              Content Ingested Successfully!
            </h2>
            <p className="text-sm text-kb-text-muted max-w-md mx-auto">
              {applyResults.filter((r) => r.success).length} of{" "}
              {applyResults.length} entities were created in the KB.
            </p>
          </div>

          {/* Results */}
          <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
            <h3 className="text-sm font-medium text-kb-text-muted mb-3">
              Results
            </h3>
            <div className="space-y-2">
              {applyResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                    r.success
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span>{r.success ? "✅" : "❌"}</span>
                    <div>
                      <span className="text-sm font-medium text-kb-text">
                        {entityTypeIcons[r.entityType]} {r.entityType}: {r.slug}
                      </span>
                      {r.error && (
                        <p className="text-xs text-red-400 mt-0.5">
                          {r.error}
                        </p>
                      )}
                    </div>
                  </div>
                  {r.success && (
                    <a
                      href={`/browse`}
                      className="text-xs text-kb-primary-light hover:underline"
                    >
                      View in Browse →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-kb-primary text-white rounded-xl text-sm font-bold hover:bg-kb-primary-dark transition-all shadow-lg shadow-kb-primary/20"
            >
              🔄 Ingest More Content
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Entity Card Component ──────────────────────────────

function EntityCard({
  entity,
  onToggle,
  onRemove,
  onUpdateField,
  entityTypeIcons,
  entityTypeColors,
}: {
  entity: ClassifiedEntity;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateField: (entityId: string, field: string, value: unknown) => void;
  entityTypeIcons: Record<string, string>;
  entityTypeColors: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const d = entity.data;

  const displayName =
    (d.featureName as string) ||
    (d.scenarioName as string) ||
    (d.name as string) ||
    (d.title as string) ||
    (d.productName as string) ||
    (d.moduleName as string) ||
    "Untitled";

  return (
    <div
      className={`bg-kb-surface rounded-xl border transition-all ${
        entity.selected
          ? "border-kb-primary/30 shadow-lg shadow-kb-primary/5"
          : "border-kb-border opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <input
          type="checkbox"
          checked={entity.selected}
          onChange={() => onToggle(entity.id)}
          className="w-4 h-4 rounded accent-kb-primary"
        />

        <span className="text-xl">
          {entityTypeIcons[entity.entityType]}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase ${
                entityTypeColors[entity.entityType]
              }`}
            >
              {entity.entityType}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                entity.action === "create"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/20"
              }`}
            >
              {entity.action === "create" ? "🆕 Create" : "✏️ Append"}
            </span>
            <span className="text-[10px] text-kb-text-dim">
              {Math.round(entity.confidence * 100)}% confidence
            </span>
          </div>
          <div className="text-sm font-semibold text-kb-text truncate">
            {displayName}
          </div>
          {entity.targetModuleSlug && (
            <div className="text-xs text-kb-text-dim mt-0.5">
              → Module: {entity.targetModuleSlug}
              {entity.targetSlug && ` → ${entity.entityType}: ${entity.targetSlug}`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-kb-text-dim hover:text-kb-text px-2 py-1 rounded transition-colors"
          >
            {expanded ? "▼ Collapse" : "▶ Details"}
          </button>
          <button
            onClick={() => onRemove(entity.id)}
            className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-all"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Reason */}
      {entity.reason && (
        <div className="px-4 pb-3">
          <p className="text-xs text-kb-text-dim italic">
            💡 {entity.reason}
          </p>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-kb-border p-4 space-y-3">
          {Object.entries(d).map(([key, value]) => {
            if (value === null || value === undefined) return null;

            // Render string fields as editable textarea/input
            if (typeof value === "string") {
              return (
                <div key={key}>
                  <label className="text-xs text-kb-text-dim block mb-1 font-medium">
                    {key}
                  </label>
                  {value.length > 100 ? (
                    <textarea
                      value={value}
                      onChange={(e) =>
                        onUpdateField(entity.id, key, e.target.value)
                      }
                      className="form-input text-xs min-h-[60px]"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) =>
                        onUpdateField(entity.id, key, e.target.value)
                      }
                      className="form-input text-xs"
                    />
                  )}
                </div>
              );
            }

            // Render arrays as JSON textarea
            if (Array.isArray(value)) {
              return (
                <div key={key}>
                  <label className="text-xs text-kb-text-dim block mb-1 font-medium">
                    {key} ({value.length} items)
                  </label>
                  <textarea
                    value={JSON.stringify(value, null, 2)}
                    onChange={(e) => {
                      try {
                        onUpdateField(entity.id, key, JSON.parse(e.target.value));
                      } catch { /* ignore parse errors while typing */ }
                    }}
                    className="form-input text-xs min-h-[60px] font-mono"
                  />
                </div>
              );
            }

            // Boolean
            if (typeof value === "boolean") {
              return (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      onUpdateField(entity.id, key, e.target.checked)
                    }
                    className="accent-kb-primary"
                  />
                  <label className="text-xs text-kb-text-dim">{key}</label>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
