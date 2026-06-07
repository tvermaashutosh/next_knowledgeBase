# API Reference

Base URL: `http://localhost:3000/api`

> **Authentication**: All endpoints (except `/login` and `/api/auth/callback`) require a valid Supabase session cookie. Unauthenticated requests are redirected to `/login` (307).

---

## KB API (`/api/kb`)

### GET — Read Operations

All GET requests use query parameters: `?action=<action>&param=value`

#### Get Stats
```
GET /api/kb?action=stats
```
**Response:**
```json
{
  "totalFeatures": 17,
  "totalScenarios": 33,
  "totalProducts": 5,
  "totalModules": 1,
  "totalTenants": 1,
  "draftCount": 0,
  "reviewCount": 17,
  "approvedCount": 0,
  "staleCount": 0,
  "products": [
    { "id": "...", "name": "DMS", "slug": "dms", "moduleCount": 1, "featureCount": 5, "scenarioCount": 3, "featureOverrideCount": 0, "scenarioOverrideCount": 0 }
  ]
}
```

#### Get Dashboard Analytics
```
GET /api/kb?action=dashboard-analytics
```
**Response:** Stats + `pendingReviews`, `totalUsers`, `recentActivity` (last 10 audit log entries).

#### Get User Profile
```
GET /api/kb?action=user-profile
```
**Response:** Current user's profile (`email`, `name`, `avatarUrl`, `role`). Creates user if first login.

#### Get Products
```
GET /api/kb?action=products
```
**Response:** `ProductInfo[]` — includes `moduleCount`, `featureCount`, `scenarioCount`, `featureOverrideCount`, `scenarioOverrideCount` per product.

#### Get Modules (by product)
```
GET /api/kb?action=modules&product=dms
```
**Response:** `Module[]` — modules linked to the given product via `ProductModule`.

#### Get Features (by module)
```
GET /api/kb?action=features&module=promotion
```
**Response:** `FeatureData[]` — features belonging to the given module.

> **Legacy**: `&product=dms` is still accepted — returns features from all modules linked to that product.

#### Get Single Feature
```
GET /api/kb?action=feature&module=promotion&feature=order-management
```
**Response:** Feature with module, dependencies, and scenarios included.

#### Get Scenarios
```
GET /api/kb?action=scenarios&module=promotion&feature=promotions
```
**Response:** `ScenarioData[]`

#### Get Tenants
```
GET /api/kb?action=tenants
```
**Response:** `Tenant[]`

#### Get Tenant Overrides
```
GET /api/kb?action=tenant-overrides&tenant=coca-cola
```
**Response:** `TenantOverride[]` with feature info included.

#### Get Feature Overrides (by feature)
```
GET /api/kb?action=feature-overrides&featureId=<id>
```
**Response:**
```json
[
  { "id": "...", "tenantSlug": "acme", "tenantName": "Acme Corp", "contentMd": "...", "updatedAt": "..." }
]
```
> Returns all tenant overrides for a specific feature. Used by Browse KB's Feature Override Panel.

#### Get Glossary
```
GET /api/kb?action=glossary
```
**Response:** `GlossaryEntry[]`

#### Get All Features (flat, for search)
```
GET /api/kb?action=all-features
```
**Response:**
```json
[
  { "id": "...", "feature": "Order Management", "slug": "order-management", "module": "Promotion", "moduleSlug": "promotion", "applicableProducts": ["dms", "sfa"] }
]
```

#### Get All Modules
```
GET /api/kb?action=all-modules
```
**Response:** `ModuleData[]` — all modules with `productSlugs` and `featureCount`. Used by Registry page.

#### Get All Scenarios (flat)
```
GET /api/kb?action=all-scenarios
```
**Response:**
```json
[
  { "id": "...", "title": "BOGOF Flow", "slug": "bogof-flow", "status": "DRAFT", "featureTitle": "Promotions", "featureSlug": "promotions", "moduleName": "Promotion", "moduleSlug": "promotion" }
]
```

#### Get All Overrides (flat)
```
GET /api/kb?action=all-overrides
```
**Response:** `{ featureOverrides: [...], scenarioOverrides: [...] }` — all tenant overrides with tenant/feature/scenario info. Used by Registry page.

#### Get Scenario Overrides (for a specific scenario)
```
GET /api/kb?action=scenario-overrides&scenarioId=<id>
```
**Response:** `ScenarioOverride[]` with tenant name included.

#### Get Dependencies
```
GET /api/kb?action=dependencies&module=promotion
```
**Response:** `Dependency[]` with from/to feature info.

---

### POST — Write Operations

All POST requests use JSON body with `action` field.

#### Save Product
```json
POST /api/kb
{
  "action": "save-product",
  "slug": "dms",
  "name": "DMS",
  "overview": "Distribution Management System..."
}
```

#### Save Module
```json
POST /api/kb
{
  "action": "save-module",
  "slug": "promotion",
  "name": "Promotion",
  "overview": "Handles all promotion-related features...",
  "productSlugs": ["dms", "sfa"]
}
```
> Creates or updates a module. `productSlugs` determines which products this module is linked to via `ProductModule`.

#### Save Feature
```json
POST /api/kb
{
  "action": "save-feature",
  "moduleSlug": "promotion",
  "featureSlug": "order-management",
  "title": "Order Management",
  "status": "DRAFT",
  "contentMd": "## What It Does\n...",
  "tags": ["orders", "sales"],
  "completeness": 75,
  "tenantConfigurable": true,
  "tenantConfigPoints": ["min_order_value"],
  "applicableProducts": ["dms", "sfa"],
  "glossaryTerms": [
    { "term": "FOC", "definition": "Free of Cost goods", "dontSay": ["free goods", "freebies"] }
  ],
  "dependencies": [
    {
      "toSlug": "inventory",
      "toModuleSlug": "promotion",
      "type": "VALIDATES",
      "direction": "outgoing",
      "what": "stock levels",
      "when": "order placed",
      "impact": "order fails if no stock"
    }
  ]
}
```
> **Auto-embedding**: When `contentMd` is provided and LLM is configured, the feature is automatically chunked and embedded in the background.

#### Save Scenario
```json
POST /api/kb
{
  "action": "save-scenario",
  "moduleSlug": "promotion",
  "featureSlug": "promotions",
  "scenarioSlug": "bogof-flow",
  "title": "BOGOF Flow",
  "contentMd": "## Step-by-Step\n1. Rep selects...",
  "status": "DRAFT",
  "tags": ["promotions"],
  "applicableProducts": []
}
```
> **Auto-embedding**: Scenario `contentMd` is embedded as `[Feature > Scenario] [Section]` chunks, stored under the parent feature's `featureId`. This makes scenario content discoverable via semantic search.

#### Save Tenant Override (Feature-level)
```json
POST /api/kb
{
  "action": "save-tenant-override",
  "tenantSlug": "unilever-india",
  "moduleSlug": "promotion",
  "featureSlug": "promotions",
  "contentMd": "## Config Differences\n- Custom slab logic..."
}
```

#### Save Scenario Override (Scenario-level)
```json
POST /api/kb
{
  "action": "save-scenario-override",
  "tenantSlug": "unilever-india",
  "moduleSlug": "promotion",
  "featureSlug": "promotions",
  "scenarioSlug": "bogof-flow",
  "contentMd": "## Custom Flow Steps\n1. Extra approval step at ₹50,000..."
}
```

#### Delete Operations

All delete operations use `POST /api/kb` with a JSON body.

| Action | Body | Notes |
|--------|------|-------|
| `delete-product` | `{ slug }` | Removes ProductModule links |
| `delete-module` | `{ slug }` | Fails if module has features |
| `delete-feature` | `{ moduleSlug, featureSlug }` | Cascades: scenarios, embeddings, deps, overrides |
| `delete-scenario` | `{ moduleSlug, featureSlug, scenarioSlug }` | Cascades: embeddings, overrides |
| `delete-tenant` | `{ slug }` | Cascades: all feature + scenario overrides |
| `delete-tenant-override` | `{ tenantSlug, featureSlug, moduleSlug }` | Deletes single feature override |
| `delete-scenario-override` | `{ tenantSlug, scenarioSlug, featureSlug, moduleSlug }` | Deletes single scenario override |

---

## AI Assist API (`/api/ai-assist`)

> **Requires**: LLM config set in Admin. All actions use `POST` with JSON body.

#### Draft Feature
```json
POST /api/ai-assist
{
  "action": "draft-feature",
  "description": "Order management for FMCG...",
  "moduleSlug": "promotion"
}
```
**Response:** `{ "data": { featureName, tags, whatItDoes, rules, ... }, "usage": { promptTokens, completionTokens } }`

#### Draft Scenario
```json
{ "action": "draft-scenario", "description": "...", "moduleSlug": "promotion", "featureSlug": "promotions" }
```

#### Draft Product / Tenant
```json
{ "action": "draft-product", "description": "DMS — Distribution Management System..." }
{ "action": "draft-tenant", "description": "Acme Corp — large North India distributor..." }
```

#### Draft Override
```json
{
  "action": "draft-override",
  "description": "Approval threshold is ₹50k instead of ₹10k",
  "tenantSlug": "acme", "moduleSlug": "promotion", "featureSlug": "orders"
}
```

#### Suggest Section
```json
{ "action": "suggest-section", "section": "rules", "currentForm": { ... }, "moduleSlug": "promotion" }
```
> Uses smart context chain: reads related sections (e.g., rules reads whatItDoes, inScope, whoUsesIt). Merges into existing content.

#### Suggest Scenarios
```json
{ "action": "suggest-scenarios", "moduleSlug": "promotion", "featureSlug": "promotions" }
```
**Response:** Array of `{ title, description, priority }` — excludes already-documented scenarios.

#### Review Quality
```json
{ "action": "review-quality", "formData": { ... }, "entityType": "feature" }
```
**Response:** Array of `{ type: "warning"|"suggestion"|"success", section, message }`.

#### Refine Section
```json
{ "action": "refine-section", "section": "rules", "currentContent": [...], "instruction": "add inventory rules" }
```

> See [AI Assist docs](ai-assist.md) for full details on all 9 actions.

---

## Search API (`/api/search`)

#### Vector Similarity Search
```
GET /api/search?q=order+management&module=promotion&topK=10
```
**Response:**
```json
{
  "query": "order management",
  "results": [
    { "id": "...", "featureId": "...", "section": "Rules", "chunkText": "...", "similarity": 0.94 }
  ]
}
```
> Requires LLM config with embedding provider set. Filter by `module` slug instead of product.

---

## Generate API (`/api/generate`)

#### RAG Generation
```json
POST /api/generate
{
  "query": "How does BOGOF work for Unilever India?",
  "product": "dms",
  "tenant": "unilever-india",
  "topK": 10,
  "excludeChunkIds": ["chunk-id-1"],
  "customSystemPrompt": "You are an expert..."
}
```
**Response:**
```json
{
  "output": "## REQ-001: ...",
  "model": "openai/gpt-4o",
  "tenant": "unilever-india",
  "tenantOverrides": 3,
  "usage": { "promptTokens": 1800, "completionTokens": 550 },
  "contextChunks": [
    { "id": "...", "featureId": "...", "section": "Rules", "chunkText": "...", "similarity": 0.94, "moduleSlug": "promotion", "moduleName": "Promotion" }
  ],
  "totalChunksFound": 10,
  "chunksUsed": 9,
  "chunksExcluded": 1
}
```
> **Context assembly order**: Global Glossary → Feature-Specific Terms → KB Chunks (feature + scenario) → Scenario Overrides → Feature Overrides. Tenant overrides always take priority.

---

## LLM Config API (`/api/llm-config`)

#### Get Config + Options
```
GET /api/llm-config
```
**Response:** Current config (keys hidden) + available provider/model options.

#### Save Config (Admin only)
```json
POST /api/llm-config
{
  "generationProvider": "openai",
  "generationModel": "gpt-4o",
  "generationApiKey": "sk-...",
  "embeddingProvider": "openai",
  "embeddingModel": "text-embedding-3-small",
  "embeddingApiKey": "sk-..."
}
```

---

## Reviews API (`/api/reviews`)

#### List Reviews
```
GET /api/reviews?status=pending
```

#### Submit / Approve / Reject
```json
POST /api/reviews
{ "action": "submit", "featureId": "..." }

POST /api/reviews
{ "action": "approve", "reviewId": "...", "comments": "Looks good" }

POST /api/reviews
{ "action": "reject", "reviewId": "...", "comments": "Missing edge cases" }
```

---

## Users API (`/api/users`) — Admin only

#### List Users
```
GET /api/users
```

#### Update Role
```json
POST /api/users
{ "email": "user@example.com", "role": "CONTRIBUTOR" }
```

---

## Audit API (`/api/audit`) — Admin only

```
GET /api/audit?entity=feature&limit=50&offset=0
```

---

## Ingest API (`/api/ingest`)

> **Requires**: LLM config set in Admin. All actions use `POST` with JSON body.

### Classify Sources

```
POST /api/ingest
```

**Request:**
```json
{
  "action": "classify",
  "sources": [
    { "type": "text", "content": "Meeting notes about Order Management..." },
    { "type": "confluence", "content": "12345", "meta": { "pageTitle": "Order Spec", "pageUrl": "..." } },
    { "type": "image", "content": "<base64>", "meta": { "mimeType": "image/png", "fileName": "wireframe.png" } }
  ]
}
```

**Response:**
```json
{
  "jobId": "cuid-job-id",
  "entities": [
    {
      "id": "e1",
      "action": "create",
      "entityType": "feature",
      "targetModuleSlug": "orders",
      "data": { "featureName": "Order Management", "whatItDoes": "...", "rules": ["..."] },
      "confidence": 0.92,
      "reason": "Content describes a new Order Management feature"
    }
  ],
  "summary": "Extracted 3 entities from meeting notes"
}
```

> Source types: `text` (raw paste), `confluence` (page ID — fetched server-side), `image` (base64 — described via LLM vision).

### Confirm & Apply

```
POST /api/ingest
```

**Request:**
```json
{
  "action": "confirm",
  "jobId": "cuid-job-id",
  "entities": [ ...selected entities from classify step... ]
}
```

**Response:**
```json
{
  "applied": [
    { "id": "e1", "entityType": "feature", "slug": "order-management", "success": true },
    { "id": "e2", "entityType": "scenario", "slug": "bogof-flow", "success": true }
  ]
}
```

> Creates entities using existing `db-store` methods, auto-embeds content, and logs audits with `action: "ingested"`.

---

## Confluence API (`/api/confluence`)

### Search Pages

```
GET /api/confluence?action=search&q=order+management
```

**Response:** Array of `{ id, title, spaceKey, excerpt, url }`.

### Fetch Page Content

```
GET /api/confluence?action=page&id=12345
```

**Response:** `{ title, body, url }` — body is converted from Confluence storage HTML to plain text.

### Check Config

```
GET /api/confluence?action=config
```

**Response:** `{ configured: true/false, baseUrl?, email? }`.

### Save Config (Admin only)

```json
POST /api/confluence
{ "baseUrl": "https://company.atlassian.net/wiki", "email": "user@company.com", "apiToken": "at-..." }
```

---

## Auth API

#### OAuth Callback
```
GET /api/auth/callback?code=...
```
Exchanges auth code → creates session → syncs user → redirects.

---

## Smart Fix API (`/api/smart-fix`)

### Analyze Fixes

```
POST /api/smart-fix
```

**Request:**
```json
{
  "query": "original user query",
  "actualAnswer": "what the AI generated",
  "expectedAnswer": "what the user expected",
  "contextChunks": [{ "id", "chunkText", "featureTitle", "sectionName", "type", "moduleSlug", "featureSlug", "scenarioSlug" }]
}
```

**Response:**
```json
{
  "fixes": [{ "action": "edit", "chunkId": "...", "currentText": "...", "suggestedText": "...", "reason": "..." }],
  "creates": [{ "action": "create", "entityType": "scenario", "moduleSlug": "...", "featureSlug": "...", "title": "...", "content": "...", "reason": "..." }],
  "summary": "Brief summary of changes"
}
```

### Apply Fixes

```
POST /api/smart-fix/apply
```

**Request:**
```json
{
  "fixes": [{ "action": "edit", "chunkId": "...", "suggestedText": "...", ... }],
  "creates": [{ "action": "create", "entityType": "scenario", ... }],
  "query": "original query for audit trail"
}
```

**Response:**
```json
{
  "success": true,
  "applied": 3,
  "skipped": 0,
  "errors": 0,
  "results": [{ "type": "edit", "id": "...", "status": "applied" }]
}
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 307 | Redirect to `/login` (not authenticated) |
| 400 | Missing required parameters or unknown action |
| 401 | Not authenticated |
| 403 | Forbidden (insufficient role) |
| 404 | Entity not found |
| 500 | Internal server error |
