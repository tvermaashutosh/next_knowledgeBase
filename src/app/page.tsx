"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProductInfo {
  name: string;
  slug: string;
  moduleCount: number;
  featureCount: number;
  scenarioCount: number;
  featureOverrideCount: number;
  scenarioOverrideCount: number;
}

interface KBStats {
  totalFeatures: number;
  totalScenarios: number;
  totalProducts: number;
  totalModules: number;
  totalTenants: number;
  draftCount: number;
  reviewCount: number;
  approvedCount: number;
  staleCount: number;
  products: ProductInfo[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kb?action=stats")
      .then((r) => {
        if (!r.ok) throw new Error("stats failed");
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-kb-text tracking-tight">Dashboard</h1>
          <p className="text-kb-text-muted mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-kb-surface rounded-xl border border-kb-border p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center py-20">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-kb-text-muted">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Dashboard</h1>
        <p className="text-kb-text-muted mt-1">Knowledge Base health at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard label="Features" value={stats.totalFeatures} icon="📋" color="primary" />
        <StatCard label="Modules" value={stats.totalModules} icon="🧩" color="accent" />
        <StatCard label="Draft" value={stats.draftCount} icon="📝" color="draft" />
        <StatCard label="Stale Docs" value={stats.staleCount} icon="⏰" color="warning" />
        <StatCard label="Tenants" value={stats.totalTenants} icon="🏢" color="accent" />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatusPill label="Draft" count={stats.draftCount} color="kb-draft" />
        <StatusPill label="In Review" count={stats.reviewCount} color="kb-review" />
        <StatusPill label="Approved" count={stats.approvedCount} color="kb-approved" />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-kb-text">Products</h2>
            <Link
              href="/contribute?type=product"
              className="text-xs text-kb-primary-light hover:text-kb-accent transition-colors"
            >
              + Add Product
            </Link>
          </div>

          {(stats.products || []).length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-kb-text-muted text-sm mb-4">No products yet</p>
              <Link
                href="/contribute?type=product"
                className="inline-flex items-center gap-2 px-4 py-2 bg-kb-primary/15 text-kb-primary-light rounded-lg text-sm font-medium hover:bg-kb-primary/25 transition-colors border border-kb-primary/20"
              >
                Add your first product
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(stats.products || []).map((product) => (
                <Link
                  key={product.slug}
                  href={`/browse?product=${product.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-kb-surface-2 hover:bg-kb-surface-3 border border-kb-border/50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-kb-primary/10 flex items-center justify-center text-sm">
                      📦
                    </div>
                    <div>
                      <div className="text-sm font-medium text-kb-text group-hover:text-kb-primary-light transition-colors">
                        {product.name}
                      </div>
                      <div className="text-xs text-kb-text-dim">
                        {product.moduleCount} module{product.moduleCount !== 1 ? "s" : ""} · {product.featureCount} features · {product.scenarioCount} scenarios
                      </div>
                      {(product.featureOverrideCount > 0 || product.scenarioOverrideCount > 0) && (
                        <div className="text-[10px] text-amber-400/80 mt-0.5">
                          🏢 {product.featureOverrideCount} feature override{product.featureOverrideCount !== 1 ? "s" : ""} · {product.scenarioOverrideCount} scenario override{product.scenarioOverrideCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-4 h-4 text-kb-text-dim group-hover:text-kb-text-muted transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
          <h2 className="text-lg font-semibold text-kb-text mb-5">Quick Actions</h2>
          <div className="space-y-3">
            <QuickAction
              href="/contribute?type=module"
              icon="🧩"
              label="Add Module"
              description="Create a module to group features"
            />
            <QuickAction
              href="/contribute?type=feature"
              icon="✏️"
              label="Add Feature"
              description="Document a new feature with rules"
            />
            <QuickAction
              href="/contribute?type=scenario"
              icon="📋"
              label="Add Scenario"
              description="Add a scenario to a complex feature"
            />
            <QuickAction
              href="/query"
              icon="🔍"
              label="Query KB"
              description="Ask questions or generate requirements"
            />
            <QuickAction
              href="/dependencies"
              icon="🗺️"
              label="Dependency Map"
              description="Visualize feature dependencies"
            />
            <QuickAction
              href="/admin"
              icon="📖"
              label="Manage Glossary"
              description="Add or edit terms"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "from-kb-primary/10 to-kb-primary/5 border-kb-primary/20",
    draft: "from-kb-draft/10 to-kb-draft/5 border-kb-draft/20",
    warning: "from-kb-danger/10 to-kb-danger/5 border-kb-danger/20",
    accent: "from-kb-accent/10 to-kb-accent/5 border-kb-accent/20",
  };

  const textColorMap: Record<string, string> = {
    primary: "text-kb-primary-light",
    draft: "text-kb-draft",
    warning: "text-kb-danger",
    accent: "text-kb-accent",
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-lg">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${textColorMap[color]} mb-1`}>{value}</div>
      <div className="text-xs text-kb-text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 bg-kb-surface rounded-xl border border-kb-border p-4">
      <div className={`w-2.5 h-2.5 rounded-full bg-${color}`} />
      <div>
        <div className="text-sm font-medium text-kb-text">{count}</div>
        <div className="text-xs text-kb-text-dim">{label}</div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, description }: { href: string; icon: string; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-kb-surface-2 border border-transparent hover:border-kb-border/50 transition-all duration-200 group"
    >
      <div className="w-10 h-10 rounded-lg bg-kb-surface-2 group-hover:bg-kb-surface-3 flex items-center justify-center text-lg transition-colors">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-kb-text group-hover:text-kb-primary-light transition-colors">
          {label}
        </div>
        <div className="text-xs text-kb-text-dim">{description}</div>
      </div>
    </Link>
  );
}
