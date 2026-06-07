"use client";

import { useState } from "react";

interface SuggestedScenario {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface ScenarioSuggesterProps {
  moduleSlug: string;
  featureSlug: string;
  /** Called when user picks scenarios and clicks generate — for each scenario */
  onScenarioSelected: (scenario: SuggestedScenario) => void;
}

export function ScenarioSuggester({
  moduleSlug,
  featureSlug,
  onScenarioSelected,
}: ScenarioSuggesterProps) {
  const [loading, setLoading] = useState(false);
  const [scenarios, setScenarios] = useState<SuggestedScenario[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    setError("");
    setScenarios([]);
    setSelected(new Set());

    try {
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-scenarios",
          moduleSlug,
          featureSlug,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Failed to suggest scenarios");
        return;
      }

      if (Array.isArray(result.data)) {
        setScenarios(result.data);
        // Pre-select high priority ones
        const highPriority = new Set<number>();
        result.data.forEach((s: SuggestedScenario, i: number) => {
          if (s.priority === "high") highPriority.add(i);
        });
        setSelected(highPriority);
      }
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest scenarios");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (idx: number) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  const handleUseSelected = () => {
    for (const idx of selected) {
      if (scenarios[idx]) {
        onScenarioSelected(scenarios[idx]);
      }
    }
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case "high":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-kb-danger/10 text-kb-danger">HIGH</span>;
      case "medium":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-kb-warning/10 text-kb-warning">MED</span>;
      case "low":
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-kb-text-dim/10 text-kb-text-dim">LOW</span>;
      default:
        return null;
    }
  };

  if (!moduleSlug || !featureSlug) return null;

  return (
    <div className="bg-gradient-to-br from-kb-primary/5 to-kb-primary/10 rounded-xl border border-kb-primary/20 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="text-sm font-semibold text-kb-primary-light">
            Scenario Suggestions
          </h3>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-all
                     bg-kb-primary text-white hover:bg-kb-primary-dark
                     disabled:opacity-50 flex items-center gap-1.5
                     shadow-sm shadow-kb-primary/20"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing feature...
            </>
          ) : fetched ? (
            "🔄 Re-suggest"
          ) : (
            "🎯 Suggest Scenarios"
          )}
        </button>
      </div>

      {error && (
        <div className="text-sm text-kb-danger bg-kb-danger/10 rounded-lg p-3 border border-kb-danger/20">
          {error}
        </div>
      )}

      {scenarios.length > 0 && (
        <>
          <div className="space-y-2 mb-4">
            {scenarios.map((sc, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                  selected.has(i)
                    ? "bg-kb-primary/10 border-kb-primary/30"
                    : "bg-kb-surface/50 border-transparent hover:bg-kb-surface/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleSelect(i)}
                  className="mt-1 rounded accent-kb-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-kb-text">{sc.title}</span>
                    {priorityBadge(sc.priority)}
                  </div>
                  <p className="text-xs text-kb-text-muted mt-0.5">{sc.description}</p>
                </div>
              </label>
            ))}
          </div>
          <button
            onClick={handleUseSelected}
            disabled={selected.size === 0}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all
                       bg-kb-primary text-white hover:bg-kb-primary-dark
                       disabled:opacity-50 shadow-lg shadow-kb-primary/20"
          >
            Use Selected ({selected.size})
          </button>
        </>
      )}

      {!fetched && !loading && (
        <p className="text-xs text-kb-text-dim">
          AI will analyze the parent feature and suggest distinct scenarios to document.
        </p>
      )}
    </div>
  );
}
