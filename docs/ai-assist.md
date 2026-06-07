# AI-Assisted Authoring

> LLM-powered drafting, per-section suggestions, quality review, scenario generation, and tenant override drafting.

## Overview

The AI Assist feature helps author KB content faster and more accurately by integrating LLM assistance at every step of the Contribute workflow. Instead of filling blank forms manually, you can:

1. **Describe** a feature/scenario in plain English
2. **Generate** a structured draft with all fields populated
3. **Review** and refine the AI-generated content

## Capabilities

| # | Capability | Where | How |
|---|-----------|-------|-----|
| 1 | **AI Draft** | All 5 forms (Product, Feature, Scenario, Tenant, Override) | Describe → Generate → all fields filled |
| 2 | **✨ Suggest** per section | Feature form (9 sections) | Click ✨ Suggest next to section title → content appended |
| 3 | **🎯 Scenario Suggester** | Scenario form | Analyzes parent feature → suggests 5-10 scenarios with priorities |
| 4 | **🔍 Quality Review** | Feature + Scenario forms | Checks completeness, consistency, testability before saving |
| 5 | **Override Drafting** | Tenant Override form | Describe what's different → generates comparison table |
| 6 | **Refine Section** | API available (UI later) | Send instruction → LLM modifies specific section |
| 7 | **🔧 Smart KB Fix** | Query & Generate page | Compare actual vs expected answer → AI suggests chunk edits & new entities |

## AI Draft — How It Works

The AI Draft box appears at the top of each form. The flow:

```
1. Type a description (free text, meeting notes, or PRD text)
2. System fetches RAG context from KB (related features, glossary)
3. LLM generates structured JSON matching all form fields
4. Fields are auto-populated in the form
5. Review, edit, and save
```

### What Gets Generated (Feature Draft)

| Field | Format |
|-------|--------|
| Feature Name | String |
| Tags | Array of keywords |
| What It Does | 2-3 sentence summary |
| In Scope / Out of Scope | Arrays of items |
| Who Uses It | Role → description format |
| Rules | Array of testable statements |
| Acceptance Criteria | Given/When/Then objects |
| User Flows | Named flows with numbered steps |
| Data Fields | Field/description/required/example |
| Domain Events | Markdown table |
| Edge Cases | "When [X] → [System should Y]" |
| Open Questions | Things that need clarification |
| Glossary Terms | Term/definition/dontSay |

## Per-Section ✨ Suggest

Each section has a **smart context chain** — the LLM reads related sections to generate relevant content:

```
rules     ← reads: whatItDoes, inScope, whoUsesIt
acceptanceCriteria ← reads: rules, userFlows, whatItDoes
userFlows         ← reads: whatItDoes, rules, whoUsesIt
edgeCases         ← reads: rules, userFlows, acceptanceCriteria
```

**Merge behavior:** New suggestions are **appended** to existing content, never replacing. Empty entries are filtered out first.

## Quality Review

Before saving, you can run a quality check that evaluates:

- **Completeness** — are important sections filled?
- **Testability** — do ACs use Given/When/Then?
- **Consistency** — do rules contradict each other?
- **Terminology** — are glossary terms used correctly?
- **Coverage** — are obvious edge cases missing?

Results show as color-coded items: ⚠️ warnings, 💡 suggestions, ✅ successes.

## API Reference

**Endpoint:** `POST /api/ai-assist`

All requests use JSON body with an `action` field. The `moduleSlug` parameter is used to scope RAG context to a specific module.

### Actions

#### `draft-feature`
```json
{
  "action": "draft-feature",
  "description": "Order management for FMCG distributors...",
  "moduleSlug": "promotion"
}
```
**Response:** `{ "data": { featureName, tags, ... }, "usage": { promptTokens, completionTokens } }`

#### `draft-scenario`
```json
{
  "action": "draft-scenario",
  "description": "BOGOF promotion type — buy X get Y free",
  "moduleSlug": "promotion",
  "featureSlug": "promotions"
}
```

#### `draft-product`
```json
{ "action": "draft-product", "description": "DMS — Distribution Management System..." }
```

#### `draft-tenant`
```json
{ "action": "draft-tenant", "description": "Acme Corp — large distributor in North India..." }
```

#### `draft-override`
```json
{
  "action": "draft-override",
  "description": "Approval threshold is ₹50k instead of ₹10k",
  "tenantSlug": "acme",
  "moduleSlug": "promotion",
  "featureSlug": "orders",
  "scenarioSlug": "approval-flow"
}
```

#### `suggest-section`
```json
{
  "action": "suggest-section",
  "section": "rules",
  "currentForm": { "featureName": "...", "whatItDoes": "..." },
  "moduleSlug": "promotion"
}
```

#### `suggest-scenarios`
```json
{ "action": "suggest-scenarios", "moduleSlug": "promotion", "featureSlug": "promotions" }
```
**Response:** Array of `{ title, description, priority }`.

#### `review-quality`
```json
{ "action": "review-quality", "formData": { ... }, "entityType": "feature" }
```
**Response:** Array of `{ type: "warning"|"suggestion"|"success", section, message }`.

#### `refine-section`
```json
{
  "action": "refine-section",
  "section": "rules",
  "currentContent": ["Rule 1", "Rule 2"],
  "instruction": "Add rules about inventory validation"
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 400 | Missing required parameters or LLM not configured |
| 404 | Feature/scenario not found (suggest-scenarios) |
| 500 | LLM call failed |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Contribute  │────▶│  /api/ai-assist  │────▶│  LLM Adapter │
│   Page UI    │     │   (9 actions)    │     │ (OpenAI/     │
│              │◀────│                  │◀────│  Gemini/     │
│  AiDraftBox  │     │  RAG Context +   │     │  Claude)     │
│  AiSuggest   │     │  Glossary +      │     └─────────────┘
│  QualityRev  │     │  System Prompts  │
│  ScenarioSug │     └──────────────────┘
└─────────────┘              │
                             ▼
                    ┌──────────────────┐
                    │    pgvector      │
                    │  (RAG search —   │
                    │  module-scoped)  │
                    └──────────────────┘
```

### Component Props

All AI components accept `moduleSlug` (not `productSlug`) to scope RAG context:

| Component | Key Props |
|-----------|-----------|
| `AiDraftBox` | `entityType`, `moduleSlug?`, `featureSlug?`, `onDraftGenerated` |
| `AiSuggestButton` | `section`, `currentForm`, `moduleSlug?`, `onSuggestion` |
| `ScenarioSuggester` | `moduleSlug`, `featureSlug`, `onScenarioSelected` |
| `QualityReviewPanel` | `formData`, `entityType` |

## Configuration

AI Assist requires an LLM to be configured in **Admin → LLM Config**. Both a generation provider (for drafting) and an embedding provider (for RAG context) should be set up.

Supported providers: OpenAI, Gemini, Claude.

---

## Smart KB Fix

Automated KB correction loop on the **Query & Generate** page. When the AI generates a wrong answer, users provide the expected correct answer and the system identifies which KB chunks to edit or whether new features/scenarios need to be created.

### Flow

```
1. Generate response → see incorrect output
2. Click 🔧 Smart KB Fix
3. Paste expected correct answer
4. Click "Analyze & Suggest Fixes"
5. LLM compares actual vs expected, returns:
   - EDIT fixes: chunk id + before/after text + reason
   - CREATE fixes: new scenario/feature + content + reason
6. Review diff view (red = before, green = after)
7. Approve/reject individual fixes via checkboxes
8. Click "Apply Selected Fixes" → batch update
9. Regenerate to verify
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/smart-fix` | POST | Analyze actual vs expected, return structured fixes |
| `/api/smart-fix/apply` | POST | Apply approved fixes (edit chunks + create entities) |

### Audit Trail

Every applied fix is logged in `AuditLog` with:
- `action: "smart-fix"`
- `entity: "embedding" | "scenario" | "feature"`  
- `details`: JSON with query, fixType, before/after text, reason

---

## Content Ingestion (Ingest)

Drop raw source material — AI structures and classifies it into KB entities in seconds.

### Source Types

| Source | How It Works |
|--------|-------------|
| 📝 **Text** | Paste meeting notes, PRDs, requirements — any unstructured text |
| 🔗 **Confluence** | Search & select Confluence pages — content auto-extracted via REST API |
| 📷 **Image** | Upload screenshots, wireframes, Jira tickets — LLM vision describes the content |

### Flow

```
1. Add one or more sources (text, Confluence pages, images)
2. Click "🚀 Analyze & Classify"
3. AI reads KB structure + glossary + RAG context
4. Returns classified entities: new products, modules, features, scenarios
5. Review, edit, or remove entities
6. Click "✅ Push to KB" to create them
7. Auto-embeds content for RAG search
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest` | POST | `action: "classify"` — Analyze sources and return classified entities |
| `/api/ingest` | POST | `action: "confirm"` — Apply selected entities to KB |
| `/api/confluence` | GET | `action=search&q=...` — Search Confluence pages |
| `/api/confluence` | GET | `action=page&id=...` — Fetch page content |
| `/api/confluence` | GET | `action=config` — Check Confluence connection |
| `/api/confluence` | POST | Save Confluence credentials (admin only) |

### Confluence Setup

1. Go to **Admin → Confluence** tab
2. Enter your Atlassian base URL (e.g., `https://company.atlassian.net/wiki`)
3. Enter your Atlassian email
4. Generate an API token at [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
5. Save — the Ingest page will show Confluence search

### Image/Vision Support

Images are processed using the configured generation LLM's vision capabilities:
- **OpenAI**: GPT-4o, GPT-4o-mini (image_url content parts)
- **Gemini**: Gemini 1.5/2.0 (inlineData parts)
- **Claude**: Claude 3+ (base64 image blocks)

The LLM describes the image content in detail, then that description is included alongside text sources for classification.

### Audit Trail

Every entity created via Ingest is logged in `AuditLog` with `action: "ingested"`.

