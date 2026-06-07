"use client";

import { useState } from "react";

interface ReviewItem {
  type: "warning" | "suggestion" | "success";
  section: string;
  message: string;
}

interface QualityReviewPanelProps {
  /** Full form data to review */
  formData: Record<string, unknown>;
  /** Entity type being reviewed */
  entityType?: string;
}

export function QualityReviewPanel({
  formData,
  entityType = "feature",
}: QualityReviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const handleReview = async () => {
    setLoading(true);
    setError("");
    setItems([]);

    try {
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review-quality",
          formData,
          entityType,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Review failed");
        return;
      }

      if (Array.isArray(result.data)) {
        setItems(result.data);
      } else {
        setError("Unexpected response format");
      }
      setReviewed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setLoading(false);
    }
  };

  const warnings = items.filter((i) => i.type === "warning");
  const suggestions = items.filter((i) => i.type === "suggestion");
  const successes = items.filter((i) => i.type === "success");

  const icon = (type: string) => {
    switch (type) {
      case "warning": return "⚠️";
      case "suggestion": return "💡";
      case "success": return "✅";
      default: return "•";
    }
  };

  const color = (type: string) => {
    switch (type) {
      case "warning": return "text-kb-warning";
      case "suggestion": return "text-kb-primary-light";
      case "success": return "text-kb-success";
      default: return "text-kb-text-muted";
    }
  };

  return (
    <div className="bg-kb-surface rounded-xl border border-kb-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h3 className="text-base font-semibold text-kb-text">Quality Review</h3>
          {reviewed && items.length > 0 && (
            <span className="text-xs bg-kb-surface-3 px-2 py-0.5 rounded-full text-kb-text-dim">
              {warnings.length} warnings · {suggestions.length} suggestions · {successes.length} good
            </span>
          )}
        </div>
        <button
          onClick={handleReview}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all
                     bg-kb-surface-2 text-kb-text border border-kb-border
                     hover:bg-kb-surface-3 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-kb-text-dim/30 border-t-kb-text-dim rounded-full animate-spin" />
              Reviewing...
            </>
          ) : reviewed ? (
            "🔄 Re-check"
          ) : (
            "🔍 Check Quality"
          )}
        </button>
      </div>

      {error && (
        <div className="text-sm text-kb-danger bg-kb-danger/10 rounded-lg p-3 border border-kb-danger/20">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                item.type === "warning"
                  ? "bg-kb-warning/5"
                  : item.type === "suggestion"
                  ? "bg-kb-primary/5"
                  : "bg-kb-success/5"
              }`}
            >
              <span className="text-sm mt-0.5">{icon(item.type)}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-semibold ${color(item.type)}`}>
                  {item.section}
                </span>
                <p className="text-sm text-kb-text mt-0.5">{item.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!reviewed && !loading && (
        <p className="text-xs text-kb-text-dim">
          Run a quality check before saving to catch missing content, inconsistencies, and terminology issues.
        </p>
      )}
    </div>
  );
}
