"use client";

import { useState, useEffect } from "react";

interface ProductInfo {
  name: string;
  slug: string;
}

interface DependencyData {
  id: string;
  type: string;
  direction: string;
  what: string;
  when: string;
  impact: string;
  from: { title: string; slug: string; product: { name: string; slug: string } };
  to: { title: string; slug: string; product: { name: string; slug: string } };
}

export default function DependenciesPage() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [deps, setDeps] = useState<DependencyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalFeatures, setTotalFeatures] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    fetch("/api/kb?action=products")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoadingProducts(false); })
      .catch(() => setLoadingProducts(false));
    fetch("/api/kb?action=all-features")
      .then((r) => r.ok ? r.json() : [])
      .then((d: unknown[]) => setTotalFeatures(d.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    setLoading(true);
    fetch(`/api/kb?action=dependencies&product=${selectedProduct}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setDeps(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setDeps([]); setLoading(false); });
  }, [selectedProduct]);

  // Build unique node set from dependency data
  const nodeSet = new Set<string>();
  deps.forEach((d) => {
    nodeSet.add(d.from.title);
    nodeSet.add(d.to.title);
  });
  const nodes = Array.from(nodeSet);

  const typeColors: Record<string, string> = {
    configures: "#6366f1",
    "data-input": "#22d3ee",
    triggers: "#34d399",
    validates: "#fbbf24",
    settlement: "#f87171",
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Feature Dependencies</h1>
        <p className="text-kb-text-muted mt-1">Visualize how features connect and impact each other</p>
      </div>

      {/* Product Selector */}
      <div className="bg-kb-surface rounded-xl border border-kb-border p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-kb-text-muted">Product:</span>
          {loadingProducts ? (
            <div className="h-9 w-64 bg-kb-surface-3 rounded-lg animate-pulse" />
          ) : (
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="form-input w-64">
              <option value="">Select product...</option>
              {products.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
            </select>
          )}
          <span className="text-xs text-kb-text-dim ml-auto">
            {totalFeatures} features across {products.length} products
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-kb-surface rounded-xl border border-kb-border p-4 mb-6">
        <h3 className="text-xs text-kb-text-dim uppercase tracking-wider mb-3">Dependency Types</h3>
        <div className="flex gap-6">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-kb-text-muted">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {!selectedProduct ? (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-12 text-center">
          <div className="text-5xl mb-4">🗺️</div>
          <h2 className="text-xl font-semibold text-kb-text mb-2">Select a product</h2>
          <p className="text-sm text-kb-text-muted max-w-md mx-auto">
            Choose a product to view the dependency graph between its features.
          </p>
        </div>
      ) : loading ? (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-12 text-center">
          <p className="text-kb-text-muted text-sm">Loading dependencies...</p>
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-kb-text mb-2">No dependencies defined</h2>
          <p className="text-sm text-kb-text-muted">Add feature dependencies when contributing features to see the graph.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Visual Graph */}
          <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
            <h3 className="text-sm font-medium text-kb-text mb-4">Dependency Graph ({nodes.length} features)</h3>
            <div className="relative min-h-[400px] flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 400">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="35" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a6a8a" />
                  </marker>
                </defs>
                {/* Draw edges */}
                {deps.map((dep, i) => {
                  const fromIdx = nodes.indexOf(dep.from.title);
                  const toIdx = nodes.indexOf(dep.to.title);
                  if (fromIdx === -1 || toIdx === -1) return null;
                  const angles = nodes.map((_, idx) => (idx / nodes.length) * 2 * Math.PI - Math.PI / 2);
                  const cx = 400, cy = 200, r = 150;
                  const x1 = cx + Math.cos(angles[fromIdx]) * r;
                  const y1 = cy + Math.sin(angles[fromIdx]) * r;
                  const x2 = cx + Math.cos(angles[toIdx]) * r;
                  const y2 = cy + Math.sin(angles[toIdx]) * r;
                  return (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={typeColors[dep.type] || "#3a4a6b"}
                      strokeWidth="2" strokeOpacity="0.6" markerEnd="url(#arrow)"
                    />
                  );
                })}
                {/* Draw nodes */}
                {nodes.map((node, idx) => {
                  const angle = (idx / nodes.length) * 2 * Math.PI - Math.PI / 2;
                  const x = 400 + Math.cos(angle) * 150;
                  const y = 200 + Math.sin(angle) * 150;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r="30" fill="#1a2236" stroke="#6366f1" strokeWidth="2" />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#e8ecf4" fontSize="9" fontWeight="500">
                        {node.length > 12 ? node.slice(0, 12) + "…" : node}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Dependencies Table */}
          <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kb-border">
                  <th className="text-left p-4 text-kb-text-muted font-medium">From</th>
                  <th className="text-left p-4 text-kb-text-muted font-medium">Type</th>
                  <th className="text-left p-4 text-kb-text-muted font-medium">To</th>
                  <th className="text-left p-4 text-kb-text-muted font-medium">What Flows</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((dep, i) => (
                  <tr key={i} className="border-b border-kb-border/50 hover:bg-kb-surface-2 transition-colors">
                    <td className="p-4 font-medium text-kb-text">{dep.from.title}</td>
                    <td className="p-4">
                      <span className="text-xs px-2 py-0.5 rounded-full border"
                        style={{ borderColor: (typeColors[dep.type] || "#3a4a6b") + "50", color: typeColors[dep.type] || "#3a4a6b", background: (typeColors[dep.type] || "#3a4a6b") + "15" }}>
                        {dep.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-kb-text">{dep.to.title}</td>
                    <td className="p-4 text-kb-text-muted">{dep.what || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
