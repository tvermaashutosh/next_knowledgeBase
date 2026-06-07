"use client";

import { useState } from "react";

interface AiSuggestButtonProps {
  /** Which section to generate for */
  section: string;
  /** Current form data — used as context */
  currentForm: Record<string, unknown>;
  /** Product slug for RAG context */
  moduleSlug?: string;
  /** Callback with the generated data for this section */
  onSuggestion: (data: unknown) => void;
  /** Label override */
  label?: string;
}

export function AiSuggestButton({
  section,
  currentForm,
  moduleSlug,
  onSuggestion,
  label,
}: AiSuggestButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSuggest = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suggest-section",
          section,
          currentForm,
          moduleSlug,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Suggestion failed");
        return;
      }

      onSuggestion(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suggestion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSuggest}
        disabled={loading}
        className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all
                   bg-kb-primary/10 text-kb-primary-light border border-kb-primary/20
                   hover:bg-kb-primary/20 hover:border-kb-primary/30
                   disabled:opacity-50 flex items-center gap-1.5"
        title={`AI suggest content for ${section}`}
      >
        {loading ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-kb-primary/30 border-t-kb-primary rounded-full animate-spin" />
            Thinking...
          </>
        ) : (
          <>{label || "✨ Suggest"}</>
        )}
      </button>
      {error && (
        <span className="text-xs text-kb-danger">{error}</span>
      )}
    </div>
  );
}
