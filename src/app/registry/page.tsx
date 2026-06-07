"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

type RegistryTab = "products" | "modules" | "features" | "scenarios" | "tenants" | "overrides";

// ─── Types ────────────────────────────────────────────────

interface ProductRow { id: string; name: string; slug: string; overview: string; moduleCount: number; featureCount: number; scenarioCount: number; }
interface ModuleRow { id: string; name: string; slug: string; overview: string; featureCount: number; productSlugs: string[]; }
interface FeatureRow { id: string; feature: string; slug: string; module: string; moduleSlug: string; applicableProducts: string[]; status?: string; completeness?: number; tags?: string[]; }
interface ScenarioRow { id: string; title: string; slug: string; status: string; tags: string[]; featureTitle: string; featureSlug: string; moduleName: string; moduleSlug: string; updatedAt: string; }
interface TenantRow { id: string; name: string; slug: string; overview: string; overrideCount?: number; }
interface OverrideRow { id: string; type: "feature" | "scenario"; tenantName: string; tenantSlug: string; featureTitle: string; featureSlug: string; moduleName: string; moduleSlug: string; scenarioTitle?: string; scenarioSlug?: string; updatedAt: string; }

const tabs: { key: RegistryTab; label: string; icon: string }[] = [
  { key: "products", label: "Products", icon: "📦" },
  { key: "modules", label: "Modules", icon: "🧩" },
  { key: "features", label: "Features", icon: "⚡" },
  { key: "scenarios", label: "Scenarios", icon: "🎯" },
  { key: "tenants", label: "Tenants", icon: "🏢" },
  { key: "overrides", label: "Overrides", icon: "🔀" },
];

export default function RegistryPage() {
  const [activeTab, setActiveTab] = useState<RegistryTab>("products");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [featureOverrides, setFeatureOverrides] = useState<OverrideRow[]>([]);
  const [scenarioOverrides, setScenarioOverrides] = useState<OverrideRow[]>([]);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: string;
    name: string;
    warning?: string;
    onConfirm: () => Promise<void>;
  }>({ open: false, type: "", name: "", onConfirm: async () => {} });
  const [deleting, setDeleting] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchData = useCallback(async (tab: RegistryTab) => {
    setLoading(true);
    setError("");
    try {
      switch (tab) {
        case "products": {
          const res = await fetch("/api/kb?action=stats");
          const data = await res.json();
          setProducts(data.products || []);
          break;
        }
        case "modules": {
          const res = await fetch("/api/kb?action=all-modules");
          const data = await res.json();
          setModules(data || []);
          break;
        }
        case "features": {
          const res = await fetch("/api/kb?action=all-features");
          const data = await res.json();
          setFeatures(data || []);
          break;
        }
        case "scenarios": {
          const res = await fetch("/api/kb?action=all-scenarios");
          const data = await res.json();
          setScenarios(data || []);
          break;
        }
        case "tenants": {
          const res = await fetch("/api/kb?action=tenants");
          const data = await res.json();
          setTenants(data || []);
          break;
        }
        case "overrides": {
          const res = await fetch("/api/kb?action=all-overrides");
          const data = await res.json();
          setFeatureOverrides(data.featureOverrides || []);
          setScenarioOverrides(data.scenarioOverrides || []);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  // ─── Delete Handlers ────────────────────────────────────

  const doDelete = async (action: string, body: Record<string, string>) => {
    const res = await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Delete failed");
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteModal.onConfirm();
      setDeleteModal({ open: false, type: "", name: "", onConfirm: async () => {} });
      fetchData(activeTab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Filtered Data ──────────────────────────────────────

  const q = search.toLowerCase();

  const filteredProducts = useMemo(() =>
    products.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q)),
    [products, q]
  );
  const filteredModules = useMemo(() =>
    modules.filter((m) => m.name.toLowerCase().includes(q) || m.slug.includes(q)),
    [modules, q]
  );
  const filteredFeatures = useMemo(() =>
    features.filter((f) => f.feature.toLowerCase().includes(q) || f.slug.includes(q) || f.module.toLowerCase().includes(q)),
    [features, q]
  );
  const filteredScenarios = useMemo(() =>
    scenarios.filter((s) => s.title.toLowerCase().includes(q) || s.featureTitle.toLowerCase().includes(q) || s.moduleName.toLowerCase().includes(q)),
    [scenarios, q]
  );
  const filteredTenants = useMemo(() =>
    tenants.filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q)),
    [tenants, q]
  );
  const filteredOverrides = useMemo(() => {
    const all: OverrideRow[] = [
      ...featureOverrides.map((o) => ({ ...o, type: "feature" as const })),
      ...scenarioOverrides.map((o) => ({ ...o, type: "scenario" as const })),
    ];
    return all.filter((o) =>
      o.tenantName.toLowerCase().includes(q) ||
      o.featureTitle.toLowerCase().includes(q) ||
      (o.scenarioTitle && o.scenarioTitle.toLowerCase().includes(q))
    );
  }, [featureOverrides, scenarioOverrides, q]);

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Registry</h1>
        <p className="text-kb-text-muted mt-1">
          Manage all KB entities — edit, delete, and browse
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-kb-surface rounded-xl border border-kb-border p-1.5 mb-6">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-kb-primary text-white shadow-lg shadow-kb-primary/20"
                : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
            }`}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input w-full"
          placeholder={`Search ${activeTab}...`}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-red-400">⚠️</span>
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-red-400/60 hover:text-red-400 text-sm">✕</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-12 text-center">
          <div className="flex justify-center gap-1 mb-3">
            <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-sm text-kb-text-muted">Loading {activeTab}...</p>
        </div>
      ) : (
        <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
          {/* ─── Products Tab ─── */}
          {activeTab === "products" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Name</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Slug</th>
                  <th className="text-center p-3 text-kb-text-muted font-medium">Modules</th>
                  <th className="text-center p-3 text-kb-text-muted font-medium">Features</th>
                  <th className="text-center p-3 text-kb-text-muted font-medium">Scenarios</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.slug} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-kb-text">{p.name}</td>
                    <td className="p-3 text-kb-text-dim font-mono text-xs">{p.slug}</td>
                    <td className="p-3 text-center text-kb-text-muted">{p.moduleCount}</td>
                    <td className="p-3 text-center text-kb-text-muted">{p.featureCount}</td>
                    <td className="p-3 text-center text-kb-text-muted">{p.scenarioCount}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contribute?type=product&edit=${p.slug}`} className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium">✏️ Edit</Link>
                        <button onClick={() => setDeleteModal({ open: true, type: "Product", name: p.name, warning: p.featureCount > 0 ? `This product has ${p.moduleCount} module(s) linked. Module links will be removed.` : undefined, onConfirm: async () => doDelete("delete-product", { slug: p.slug }) })} className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-kb-text-dim">No products found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ─── Modules Tab ─── */}
          {activeTab === "modules" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Name</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Slug</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Products</th>
                  <th className="text-center p-3 text-kb-text-muted font-medium">Features</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((m) => (
                  <tr key={m.slug} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-kb-text">{m.name}</td>
                    <td className="p-3 text-kb-text-dim font-mono text-xs">{m.slug}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(m.productSlugs || []).map((ps) => (
                          <span key={ps} className="text-[10px] px-1.5 py-0.5 bg-kb-primary/10 text-kb-primary-light rounded">{ps}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-center text-kb-text-muted">{m.featureCount}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contribute?type=module&edit=${m.slug}`} className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium">✏️ Edit</Link>
                        <button onClick={() => setDeleteModal({ open: true, type: "Module", name: m.name, warning: m.featureCount > 0 ? `Cannot delete — has ${m.featureCount} feature(s). Remove features first.` : undefined, onConfirm: async () => { if (m.featureCount > 0) throw new Error("Remove features first"); await doDelete("delete-module", { slug: m.slug }); } })} className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredModules.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-kb-text-dim">No modules found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ─── Features Tab ─── */}
          {activeTab === "features" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Title</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Module</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Slug</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Products</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatures.map((f) => (
                  <tr key={f.id} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-kb-text">{f.feature}</td>
                    <td className="p-3 text-kb-text-muted">{f.module}</td>
                    <td className="p-3 text-kb-text-dim font-mono text-xs">{f.slug}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(f.applicableProducts || []).map((ps) => (
                          <span key={ps} className="text-[10px] px-1.5 py-0.5 bg-kb-primary/10 text-kb-primary-light rounded">{ps}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contribute?type=feature&module=${f.moduleSlug}&feature=${f.slug}`} className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium">✏️ Edit</Link>
                        <button onClick={() => setDeleteModal({ open: true, type: "Feature", name: f.feature, warning: "This will also delete all scenarios, embeddings, dependencies, and overrides for this feature.", onConfirm: async () => doDelete("delete-feature", { moduleSlug: f.moduleSlug, featureSlug: f.slug }) })} className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredFeatures.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-kb-text-dim">No features found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ─── Scenarios Tab ─── */}
          {activeTab === "scenarios" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Title</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Feature</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Module</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Status</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScenarios.map((s) => (
                  <tr key={s.id} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-kb-text">{s.title}</td>
                    <td className="p-3 text-kb-text-muted">{s.featureTitle}</td>
                    <td className="p-3 text-kb-text-dim">{s.moduleName}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        s.status === "APPROVED" ? "bg-emerald-500/15 text-emerald-400" :
                        s.status === "REVIEW" ? "bg-amber-500/15 text-amber-400" :
                        "bg-kb-surface-3 text-kb-text-dim"
                      }`}>{s.status}</span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contribute?type=scenario&module=${s.moduleSlug}&feature=${s.featureSlug}&scenario=${s.slug}`} className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium">✏️ Edit</Link>
                        <button onClick={() => setDeleteModal({ open: true, type: "Scenario", name: s.title, warning: "Scenario embeddings and overrides will also be deleted.", onConfirm: async () => doDelete("delete-scenario", { moduleSlug: s.moduleSlug, featureSlug: s.featureSlug, scenarioSlug: s.slug }) })} className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredScenarios.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-kb-text-dim">No scenarios found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ─── Tenants Tab ─── */}
          {activeTab === "tenants" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Name</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Slug</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Overview</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => (
                  <tr key={t.slug} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3 font-medium text-kb-text">{t.name}</td>
                    <td className="p-3 text-kb-text-dim font-mono text-xs">{t.slug}</td>
                    <td className="p-3 text-kb-text-muted text-xs truncate max-w-[300px]">{t.overview || "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/contribute?type=tenant&edit=${t.slug}`} className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium">✏️ Edit</Link>
                        <button onClick={() => setDeleteModal({ open: true, type: "Tenant", name: t.name, warning: "This will delete ALL feature and scenario overrides for this tenant.", onConfirm: async () => doDelete("delete-tenant", { slug: t.slug }) })} className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium">🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTenants.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-kb-text-dim">No tenants found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* ─── Overrides Tab ─── */}
          {activeTab === "overrides" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border bg-kb-surface-2">
                  <th className="text-left p-3 text-kb-text-muted font-medium">Type</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Tenant</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Target</th>
                  <th className="text-left p-3 text-kb-text-muted font-medium">Module</th>
                  <th className="text-right p-3 text-kb-text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOverrides.map((o) => (
                  <tr key={o.id} className="border-b border-kb-border/50 hover:bg-kb-surface-2/50 transition-colors">
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                        o.type === "feature"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      }`}>
                        {o.type === "feature" ? "Feature" : "Scenario"}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-kb-text">{o.tenantName}</td>
                    <td className="p-3 text-kb-text-muted">
                      {o.type === "scenario" ? (
                        <span>{o.featureTitle} → {o.scenarioTitle}</span>
                      ) : (
                        <span>{o.featureTitle}</span>
                      )}
                    </td>
                    <td className="p-3 text-kb-text-dim">{o.moduleName}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={o.type === "feature"
                            ? `/contribute?type=tenant-override&tenant=${o.tenantSlug}&module=${o.moduleSlug}&feature=${o.featureSlug}`
                            : `/contribute?type=tenant-override&tenant=${o.tenantSlug}&module=${o.moduleSlug}&feature=${o.featureSlug}&scenario=${o.scenarioSlug}`
                          }
                          className="px-2.5 py-1 text-xs text-kb-primary hover:bg-kb-primary/10 rounded-md transition-colors font-medium"
                        >
                          ✏️ Edit
                        </Link>
                        <button
                          onClick={() => setDeleteModal({
                            open: true,
                            type: o.type === "feature" ? "Feature Override" : "Scenario Override",
                            name: `${o.tenantName} → ${o.type === "scenario" ? o.scenarioTitle : o.featureTitle}`,
                            onConfirm: async () => {
                              if (o.type === "feature") {
                                await doDelete("delete-tenant-override", { tenantSlug: o.tenantSlug, featureSlug: o.featureSlug, moduleSlug: o.moduleSlug });
                              } else {
                                await doDelete("delete-scenario-override", { tenantSlug: o.tenantSlug, scenarioSlug: o.scenarioSlug!, featureSlug: o.featureSlug, moduleSlug: o.moduleSlug });
                              }
                            },
                          })}
                          className="px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-md transition-colors font-medium"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOverrides.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-kb-text-dim">No overrides found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Count footer */}
      {!loading && (
        <div className="mt-3 text-xs text-kb-text-dim text-right">
          {activeTab === "products" && `${filteredProducts.length} product(s)`}
          {activeTab === "modules" && `${filteredModules.length} module(s)`}
          {activeTab === "features" && `${filteredFeatures.length} feature(s)`}
          {activeTab === "scenarios" && `${filteredScenarios.length} scenario(s)`}
          {activeTab === "tenants" && `${filteredTenants.length} tenant(s)`}
          {activeTab === "overrides" && `${filteredOverrides.length} override(s)`}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => !deleting && setDeleteModal({ open: false, type: "", name: "", onConfirm: async () => {} })}>
          <div className="bg-kb-surface rounded-2xl border border-kb-border shadow-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-kb-text">Delete {deleteModal.type}?</h3>
              <p className="text-sm text-kb-text-muted mt-2">
                Are you sure you want to delete <strong className="text-kb-text">{deleteModal.name}</strong>?
              </p>
              {deleteModal.warning && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400 text-left">
                  ⚠️ {deleteModal.warning}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteModal({ open: false, type: "", name: "", onConfirm: async () => {} })}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-kb-surface-2 text-kb-text-muted rounded-xl text-sm font-medium hover:bg-kb-surface-3 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "🗑 Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
