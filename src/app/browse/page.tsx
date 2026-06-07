"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocalStorage } from "@/lib/use-local-storage";

interface ProductInfo {
  name: string;
  slug: string;
  moduleCount: number;
  featureCount: number;
  scenarioCount: number;
}

interface ModuleInfo {
  id: string;
  name: string;
  slug: string;
  overview: string;
  featureCount?: number;
  products?: { product: { name: string; slug: string } }[];
}

interface FeatureData {
  id: string;
  slug: string;
  title: string;
  status: string;
  contentMd: string;
  tags: string[];
  applicableProducts: string[];
  completeness: number;
  reviewCycle: string;
  tenantConfigurable: boolean;
  tenantConfigPoints: string[];
  updatedAt: string;
  module?: { name: string; slug: string };
}

interface ScenarioData {
  id: string;
  slug: string;
  title: string;
  contentMd: string;
  status: string;
  tags: string[];
}

function BrowsePageContent() {
  const searchParams = useSearchParams();
  const productParam = searchParams.get("product");

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [selectedProduct, setSelectedProduct] = useLocalStorage("kb_browse_product", productParam || "");
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<FeatureData | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioData[]>([]);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [loadingFeature, setLoadingFeature] = useState(false);

  useEffect(() => {
    fetch("/api/kb?action=products")
      .then((r) => r.json())
      .then((data) => { setProducts(Array.isArray(data) ? data : []); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
  }, []);

  // Load modules when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setLoadingModules(true);
      fetch(`/api/kb?action=product-modules&product=${selectedProduct}`)
        .then((r) => r.json())
        .then((data) => { setModules(Array.isArray(data) ? data : []); setLoadingModules(false); })
        .catch(() => setLoadingModules(false));
    } else {
      setModules([]);
    }
    setSelectedModule("");
    setFeatures([]);
    setSelectedFeature(null);
  }, [selectedProduct]);

  // Load features when module is expanded
  const loadModuleFeatures = async (moduleSlug: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleSlug)) {
        next.delete(moduleSlug);
        return next;
      }
      next.add(moduleSlug);
      return next;
    });

    if (!expandedModules.has(moduleSlug)) {
      setLoadingFeatures(true);
      setSelectedModule(moduleSlug);
      const resp = await fetch(`/api/kb?action=features&module=${moduleSlug}`);
      const data = await resp.json();
      setFeatures(Array.isArray(data) ? data : []);
      setLoadingFeatures(false);
    }
  };

  const loadScenarios = async (featureSlug: string, feature: FeatureData) => {
    setLoadingFeature(true);
    setSelectedFeature(feature);
    const moduleSlug = feature.module?.slug || selectedModule;
    const resp = await fetch(`/api/kb?action=scenarios&module=${moduleSlug}&feature=${featureSlug}`);
    const data = await resp.json();
    setScenarios(data);
    setLoadingFeature(false);
    setExpandedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureSlug)) {
        next.delete(featureSlug);
      } else {
        next.clear();
        next.add(featureSlug);
      }
      return next;
    });
  };

  const statusBadge = (status: string) => {
    const s = status?.toLowerCase() || "draft";
    const colors: Record<string, string> = {
      draft: "bg-kb-draft/15 text-kb-draft border-kb-draft/30",
      review: "bg-kb-review/15 text-kb-review border-kb-review/30",
      approved: "bg-kb-approved/15 text-kb-approved border-kb-approved/30",
    };
    return (
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[s] || colors.draft}`}>
        {s}
      </span>
    );
  };

  // Parse markdown sections from contentMd
  const parseSections = (contentMd: string): { title: string; content: string }[] => {
    if (!contentMd) return [];
    const sections: { title: string; content: string }[] = [];
    const lines = contentMd.split("\n");
    let currentTitle = "";
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (currentTitle) {
          sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
        }
        currentTitle = line.replace("## ", "");
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentTitle) {
      sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
    }
    return sections;
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar Tree */}
      <div className="w-72 bg-kb-surface border-r border-kb-border flex flex-col shrink-0">
        <div className="p-4 border-b border-kb-border">
          <h2 className="text-sm font-semibold text-kb-text mb-3">Browse KB</h2>
          {/* Product dropdown */}
          {loadingProducts ? (
            <div className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setSelectedFeature(null); }}
              className="form-input text-sm"
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingModules && (
            <div className="space-y-2 mt-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-8 bg-kb-surface-3 rounded-lg animate-pulse" style={{opacity: 1 - i * 0.15}} />
              ))}
            </div>
          )}
          {!loadingModules && modules.length === 0 && selectedProduct && (
            <div className="text-center py-8">
              <p className="text-sm text-kb-text-dim">No modules yet</p>
              <Link href={`/contribute?type=module`} className="text-xs text-kb-primary-light hover:text-kb-accent mt-2 inline-block">
                Add first module →
              </Link>
            </div>
          )}
          {!loadingModules && !selectedProduct && (
            <div className="text-center py-8">
              <p className="text-sm text-kb-text-dim">Select a product to browse</p>
            </div>
          )}
          {/* Module → Feature → Scenario tree */}
          {!loadingModules && modules.map((mod) => {
            const isModExpanded = expandedModules.has(mod.slug);
            return (
              <div key={mod.slug} className="mb-1">
                <button
                  onClick={() => loadModuleFeatures(mod.slug)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    selectedModule === mod.slug
                      ? "bg-kb-accent/10 text-kb-accent border border-kb-accent/20"
                      : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
                  }`}
                >
                  <span className="text-xs">{isModExpanded ? "▼" : "▸"}</span>
                  <span className="text-xs">🧩</span>
                  <span className="truncate flex-1">{mod.name}</span>
                </button>
                {isModExpanded && (
                  <div className="ml-4 mt-1">
                    {loadingFeatures && selectedModule === mod.slug && (
                      <div className="space-y-1 ml-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="h-6 bg-kb-surface-3 rounded animate-pulse" style={{opacity: 1 - i * 0.2}} />
                        ))}
                      </div>
                    )}
                    {!loadingFeatures && features.filter((f) => f.module?.slug === mod.slug || selectedModule === mod.slug).map((f) => {
                      const isExpanded = expandedFeatures.has(f.slug);
                      return (
                        <div key={f.slug}>
                          <button
                            onClick={() => { loadScenarios(f.slug, f); }}
                            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                              selectedFeature?.slug === f.slug
                                ? "bg-kb-primary/15 text-kb-primary-light border border-kb-primary/20"
                                : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
                            }`}
                          >
                            <span className="text-[10px]">{isExpanded ? "▼" : "▸"}</span>
                            <span className="truncate flex-1">{f.title}</span>
                            {statusBadge(f.status)}
                          </button>
                          {isExpanded && scenarios.length > 0 && (
                            <div className="ml-6 mt-0.5 space-y-0.5">
                              {scenarios.map((s) => (
                                <div key={s.id} className="px-3 py-1 text-[11px] text-kb-text-dim hover:text-kb-text-muted cursor-pointer rounded hover:bg-kb-surface-2 transition-colors">
                                  ◆ {s.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Preview */}
      <div className="flex-1 overflow-y-auto p-8">
        {loadingFeature ? (
          <div className="max-w-3xl">
            <div className="h-8 w-64 bg-kb-surface-3 rounded-lg animate-pulse mb-4" />
            <div className="h-4 w-40 bg-kb-surface-3 rounded animate-pulse mb-6" />
            {[1,2,3].map(i => (
              <div key={i} className="mb-6">
                <div className="h-5 w-32 bg-kb-surface-3 rounded animate-pulse mb-2" />
                <div className="bg-kb-surface rounded-lg border border-kb-border p-4 space-y-2">
                  <div className="h-3 bg-kb-surface-3 rounded animate-pulse" />
                  <div className="h-3 bg-kb-surface-3 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-kb-surface-3 rounded animate-pulse w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : !selectedFeature ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">📂</div>
            <h2 className="text-xl font-semibold text-kb-text mb-2">Select a feature</h2>
            <p className="text-sm text-kb-text-muted max-w-md">
              Choose a product, expand a module, and select a feature from the sidebar to view its documentation.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl">
            {/* Feature Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-kb-text">
                  {selectedFeature.title}
                </h1>
                {statusBadge(selectedFeature.status)}
              </div>
              <div className="flex items-center gap-4 text-xs text-kb-text-dim flex-wrap">
                <span>Updated: {selectedFeature.updatedAt ? new Date(selectedFeature.updatedAt).toLocaleDateString() : "—"}</span>
                <span>Module: {selectedFeature.module?.name || "—"}</span>
                {selectedFeature.tenantConfigurable && (
                  <span className="text-kb-accent">🔧 Tenant Configurable</span>
                )}
              </div>
              {/* Applicable Products Badge */}
              {selectedFeature.applicableProducts && selectedFeature.applicableProducts.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-kb-text-dim">Applicable to:</span>
                  {selectedFeature.applicableProducts.map((ps) => {
                    const p = products.find((pr) => pr.slug === ps);
                    return (
                      <span key={ps} className="text-[10px] px-2 py-0.5 rounded-full bg-kb-primary/10 text-kb-primary border border-kb-primary/20">
                        {p?.name || ps}
                      </span>
                    );
                  })}
                </div>
              )}
              {selectedFeature.tags && selectedFeature.tags.length > 0 && (
                <div className="flex gap-1.5 mt-3">
                  {selectedFeature.tags.map((tag: string) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-kb-surface-2 text-kb-text-dim border border-kb-border/50">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Completeness */}
            <div className="bg-kb-surface rounded-lg border border-kb-border p-3 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-kb-text-muted">Completeness</span>
                <span className={selectedFeature.completeness >= 80 ? "text-kb-success" : selectedFeature.completeness >= 50 ? "text-kb-warning" : "text-kb-danger"}>
                  {selectedFeature.completeness}%
                </span>
              </div>
              <div className="w-full bg-kb-surface-3 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full transition-all ${selectedFeature.completeness >= 80 ? "bg-kb-success" : selectedFeature.completeness >= 50 ? "bg-kb-warning" : "bg-kb-danger"}`}
                  style={{ width: `${selectedFeature.completeness}%` }}
                />
              </div>
            </div>

            {/* Sections (parsed from markdown) */}
            {parseSections(selectedFeature.contentMd).map((section) => (
              <div key={section.title} className="mb-6">
                <h2 className="text-base font-semibold text-kb-text mb-2 flex items-center gap-2">
                  {section.title}
                </h2>
                <div className="bg-kb-surface rounded-lg border border-kb-border p-4">
                  <pre className="text-sm text-kb-text-muted whitespace-pre-wrap font-sans leading-relaxed">
                    {section.content}
                  </pre>
                </div>
              </div>
            ))}

            {/* Feature-Level Tenant Overrides */}
            <FeatureOverridePanel
              featureId={selectedFeature.id}
              moduleSlug={selectedFeature.module?.slug || selectedModule}
              featureSlug={selectedFeature.slug}
            />

            {/* Scenarios Section */}
            {scenarios.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-semibold text-kb-text mb-3 flex items-center gap-2">
                  📋 Scenarios ({scenarios.length})
                </h2>
                <div className="space-y-4">
                  {scenarios.map((s) => (
                    <div key={s.id} className="bg-kb-surface rounded-lg border border-kb-border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-kb-text">{s.title}</h3>
                        <Link
                          href={`/contribute?type=scenario&module=${selectedFeature.module?.slug || selectedModule}&feature=${selectedFeature.slug}&scenario=${s.slug}`}
                          className="text-[10px] px-2 py-1 bg-kb-surface-2 text-kb-text-dim rounded hover:bg-kb-surface-3 border border-kb-border transition-colors"
                        >
                          ✏️ Edit
                        </Link>
                      </div>
                      {s.tags && s.tags.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {s.tags.map((tag: string) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-kb-surface-2 text-kb-text-dim border border-kb-border/50">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <pre className="text-xs text-kb-text-muted whitespace-pre-wrap font-sans leading-relaxed">
                        {s.contentMd}
                      </pre>
                      <ScenarioOverridePanel scenarioId={s.id} moduleSlug={selectedFeature.module?.slug || selectedModule} featureSlug={selectedFeature.slug} scenarioSlug={s.slug} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feature Glossary Terms */}
            {(() => {
              const terms = (selectedFeature as unknown as { glossaryTerms?: { term: string; definition: string; dontSay: string[] }[] }).glossaryTerms || [];
              if (terms.length === 0) return null;
              return (
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-kb-text mb-3 flex items-center gap-2">
                    📖 Terms &amp; Definitions
                    <span className="text-xs font-normal text-kb-text-dim">({terms.length} feature-specific terms)</span>
                  </h2>
                  <div className="grid grid-cols-1 gap-3">
                    {terms.map((t, i) => (
                      <div key={i} className="bg-kb-surface rounded-lg border border-kb-border p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-kb-text">{t.term}</span>
                            <p className="text-sm text-kb-text-muted mt-1 leading-relaxed">{t.definition}</p>
                          </div>
                          {t.dontSay && t.dontSay.length > 0 && (
                            <div className="shrink-0 text-right">
                              <span className="text-[10px] text-kb-text-dim">Don&apos;t say:</span>
                              <div className="flex flex-wrap gap-1 mt-0.5 justify-end">
                                {t.dontSay.map((s) => (
                                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-kb-danger/10 text-kb-danger border border-kb-danger/20 line-through">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* No content fallback */}
            {!selectedFeature.contentMd && (
              <div className="bg-kb-surface rounded-lg border border-kb-border p-8 text-center mb-6">
                <p className="text-sm text-kb-text-dim">No documentation content yet.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-kb-border">
              <Link
                href={`/contribute?type=feature&module=${selectedFeature.module?.slug || selectedModule}&feature=${selectedFeature.slug}`}
                className="px-4 py-2 bg-kb-surface-2 text-kb-text-muted text-sm rounded-lg hover:bg-kb-surface-3 border border-kb-border transition-colors"
              >
                ✏️ Edit Feature
              </Link>
              <Link
                href={`/query?product=${selectedProduct}&feature=${selectedFeature.slug}`}
                className="px-4 py-2 bg-kb-primary/15 text-kb-primary-light text-sm rounded-lg hover:bg-kb-primary/25 border border-kb-primary/20 transition-colors"
              >
                🔍 Query this Feature
              </Link>

              {/* Review Actions */}
              {selectedFeature.status?.toUpperCase() === "REVIEW" && (
                <>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/kb", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "update-feature-status", moduleSlug: selectedFeature.module?.slug || selectedModule, featureSlug: selectedFeature.slug, status: "APPROVED" }),
                      });
                      if (res.ok) {
                        setSelectedFeature({ ...selectedFeature, status: "APPROVED" });
                        const updated = await fetch(`/api/kb?action=features&module=${selectedFeature.module?.slug || selectedModule}`).then(r => r.json());
                        setFeatures(updated);
                      }
                    }}
                    className="px-4 py-2 bg-green-500/15 text-green-400 text-sm rounded-lg hover:bg-green-500/25 border border-green-500/20 transition-colors font-medium"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/kb", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "update-feature-status", moduleSlug: selectedFeature.module?.slug || selectedModule, featureSlug: selectedFeature.slug, status: "DRAFT" }),
                      });
                      if (res.ok) {
                        setSelectedFeature({ ...selectedFeature, status: "DRAFT" });
                        const updated = await fetch(`/api/kb?action=features&module=${selectedFeature.module?.slug || selectedModule}`).then(r => r.json());
                        setFeatures(updated);
                      }
                    }}
                    className="px-4 py-2 bg-red-500/15 text-red-400 text-sm rounded-lg hover:bg-red-500/25 border border-red-500/20 transition-colors font-medium"
                  >
                    ↩️ Reject (Back to Draft)
                  </button>
                </>
              )}

              {selectedFeature.status?.toUpperCase() === "DRAFT" && (
                <button
                  onClick={async () => {
                    const res = await fetch("/api/kb", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "update-feature-status", moduleSlug: selectedFeature.module?.slug || selectedModule, featureSlug: selectedFeature.slug, status: "REVIEW" }),
                    });
                    if (res.ok) {
                      setSelectedFeature({ ...selectedFeature, status: "REVIEW" });
                      const updated = await fetch(`/api/kb?action=features&module=${selectedFeature.module?.slug || selectedModule}`).then(r => r.json());
                      setFeatures(updated);
                    }
                  }}
                  className="px-4 py-2 bg-yellow-500/15 text-yellow-400 text-sm rounded-lg hover:bg-yellow-500/25 border border-yellow-500/20 transition-colors font-medium"
                >
                  📤 Send to Review
                </button>
              )}

              {selectedFeature.status?.toUpperCase() === "APPROVED" && (
                <span className="px-4 py-2 bg-green-500/10 text-green-400 text-sm rounded-lg border border-green-500/20 font-medium">
                  ✅ Approved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feature Override Panel ───────────────────────────────

function FeatureOverridePanel({ featureId, moduleSlug, featureSlug }: { featureId: string; moduleSlug: string; featureSlug: string }) {
  const [overrides, setOverrides] = useState<{ id: string; tenantSlug: string; tenantName: string; contentMd: string; updatedAt: string }[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    fetch(`/api/kb?action=feature-overrides&featureId=${featureId}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setOverrides(d) : [])
      .catch(() => {});
  }, [featureId]);

  if (overrides.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-kb-text flex items-center gap-2">
            🏢 Tenant Overrides
            <span className="text-xs font-normal text-kb-text-dim">(0)</span>
          </h2>
          <Link
            href={`/contribute?type=tenant-override&module=${moduleSlug}&feature=${featureSlug}`}
            className="text-[10px] px-2 py-1 bg-kb-primary/10 text-kb-primary rounded-lg hover:bg-kb-primary/20 border border-kb-primary/20 transition-colors"
          >
            + Add Override
          </Link>
        </div>
        <div className="bg-kb-surface rounded-lg border border-kb-border/50 p-4 text-center">
          <p className="text-xs text-kb-text-dim">No tenant-specific overrides for this feature yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setOpen(!open)}
          className="text-base font-semibold text-kb-text flex items-center gap-2 hover:text-kb-primary-light transition-colors"
        >
          <span className="text-sm">{open ? "▼" : "▸"}</span>
          🏢 Tenant Overrides
          <span className="text-xs font-normal text-kb-text-dim">({overrides.length})</span>
        </button>
        <Link
          href={`/contribute?type=tenant-override&module=${moduleSlug}&feature=${featureSlug}`}
          className="text-[10px] px-2 py-1 bg-kb-primary/10 text-kb-primary rounded-lg hover:bg-kb-primary/20 border border-kb-primary/20 transition-colors"
        >
          + Add Override
        </Link>
      </div>
      {open && (
        <div className="space-y-3">
          {overrides.map((o) => (
            <div key={o.id} className="bg-kb-surface rounded-lg border border-kb-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-kb-primary">{o.tenantName}</span>
                  <span className="text-[9px] text-kb-text-dim">
                    Updated {new Date(o.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <Link
                  href={`/contribute?type=tenant-override&module=${moduleSlug}&feature=${featureSlug}&tenant=${o.tenantSlug}`}
                  className="text-[10px] px-2 py-1 bg-kb-surface-2 text-kb-text-dim rounded hover:bg-kb-surface-3 border border-kb-border transition-colors"
                >
                  ✏️ Edit
                </Link>
              </div>
              <pre className="text-xs text-kb-text-muted whitespace-pre-wrap font-sans leading-relaxed">{o.contentMd}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Scenario Override Panel ──────────────────────────────

function ScenarioOverridePanel({ scenarioId, moduleSlug, featureSlug, scenarioSlug }: { scenarioId: string; moduleSlug: string; featureSlug: string; scenarioSlug: string }) {
  const [overrides, setOverrides] = useState<{ id: string; tenantSlug: string; tenantName: string; contentMd: string; updatedAt: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/kb?action=scenario-overrides&scenarioId=${scenarioId}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) ? setOverrides(d) : [])
      .catch(() => {});
  }, [scenarioId]);

  if (overrides.length === 0) return null;

  return (
    <div className="mt-3 border-t border-kb-border/40 pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs text-kb-text-dim hover:text-kb-text transition-colors"
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>🏢 Tenant Notes ({overrides.length})</span>
        </button>
        <Link
          href={`/contribute?type=tenant-override&scope=scenario&module=${moduleSlug}&feature=${featureSlug}&scenario=${scenarioSlug}`}
          className="text-[9px] px-1.5 py-0.5 bg-kb-primary/10 text-kb-primary rounded hover:bg-kb-primary/20 border border-kb-primary/20 transition-colors"
        >
          + Add
        </Link>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {overrides.map((o) => (
            <div key={o.id} className="bg-kb-surface-2 rounded-lg border border-kb-border/50 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-kb-primary">{o.tenantName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-kb-text-dim">
                    {new Date(o.updatedAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/contribute?type=tenant-override&scope=scenario&module=${moduleSlug}&feature=${featureSlug}&scenario=${scenarioSlug}&tenant=${o.tenantSlug}`}
                    className="text-[9px] px-1.5 py-0.5 bg-kb-surface-3 text-kb-text-dim rounded hover:bg-kb-surface-2 border border-kb-border transition-colors"
                  >
                    ✏️
                  </Link>
                </div>
              </div>
              <pre className="text-xs text-kb-text-muted whitespace-pre-wrap font-sans leading-relaxed">{o.contentMd}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="p-8 text-kb-text-muted">Loading...</div>}>
      <BrowsePageContent />
    </Suspense>
  );
}
