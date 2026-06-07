"use client";

import { useState } from "react";

interface AiDraftBoxProps {
  entityType: "feature" | "scenario" | "product" | "tenant" | "override";
  /** For feature/scenario: which product is selected */
  moduleSlug?: string;
  /** For scenario: which feature is selected */
  featureSlug?: string;
  /** For override: which tenant + feature/scenario */
  tenantSlug?: string;
  scenarioSlug?: string;
  /** Callback when draft is generated. Receives the parsed data from the API. */
  onDraftGenerated: (data: unknown) => void;
  /** Placeholder text */
  placeholder?: string;
}

export function AiDraftBox({
  entityType,
  moduleSlug,
  featureSlug,
  tenantSlug,
  scenarioSlug,
  onDraftGenerated,
  placeholder,
}: AiDraftBoxProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultPlaceholders: Record<string, string> = {
    feature:
      "Describe this feature in plain English...\n\ne.g., Order Management lets sales reps create, edit, and track orders at retail outlets. Needs approval for orders above ₹10,000. Supports FIFO inventory deduction. Used by Sales Reps, ASMs, and Finance.\n\nYou can also paste meeting notes or PRD text here.",
    scenario:
      "Describe this scenario...\n\ne.g., Buy X Get Y Free — a promo type where buying a qualifying quantity of a product grants free goods of the same or different product.",
    product:
      "Describe the product...\n\ne.g., DMS — Distribution Management System for FMCG companies to manage stock, orders, delivery, and retailer relationships.",
    tenant:
      "Describe the tenant/client...\n\ne.g., Acme Corp — large distributor in North India, uses custom approval chains, SKU restrictions, and FIFO-only inventory.",
    override:
      "Describe what's different for this tenant...\n\ne.g., Approval threshold is ₹50k instead of ₹10k. No cash orders allowed. Regional manager sign-off required.",
  };

  const actionMap: Record<string, string> = {
    feature: "draft-feature",
    scenario: "draft-scenario",
    product: "draft-product",
    tenant: "draft-tenant",
    override: "draft-override",
  };

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        action: actionMap[entityType],
        description: description.trim(),
      };

      if (moduleSlug) payload.moduleSlug = moduleSlug;
      if (featureSlug) payload.featureSlug = featureSlug;
      if (tenantSlug) payload.tenantSlug = tenantSlug;
      if (scenarioSlug) payload.scenarioSlug = scenarioSlug;

      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Generation failed");
        return;
      }

      onDraftGenerated(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-kb-primary/5 to-kb-primary/10 rounded-xl border border-kb-primary/20 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✨</span>
        <h3 className="text-sm font-semibold text-kb-primary-light">
          AI Draft
        </h3>
        <span className="text-xs text-kb-text-dim bg-kb-surface/50 px-2 py-0.5 rounded-full">
          Describe → Generate → Review
        </span>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="form-input min-h-[100px] bg-kb-surface/80 backdrop-blur text-sm"
        placeholder={placeholder || defaultPlaceholders[entityType]}
      />

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          className="px-5 py-2 bg-kb-primary text-white rounded-lg text-sm font-semibold
                     hover:bg-kb-primary-dark transition-all disabled:opacity-50
                     shadow-lg shadow-kb-primary/20 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>✨ Generate Draft</>
          )}
        </button>

        {error && (
          <span className="text-sm text-kb-danger">{error}</span>
        )}
      </div>

      {loading && (
        <div className="mt-3 text-xs text-kb-text-dim flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-kb-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          Reading KB context, glossary, and generating structured documentation...
        </div>
      )}
    </div>
  );
}
