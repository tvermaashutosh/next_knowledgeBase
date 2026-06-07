"use client";

import { useState } from "react";
import Link from "next/link";

type DocSection = "quickstart" | "products" | "modules" | "features" | "ai-assist" | "ingest" | "registry" | "scenarios" | "dependencies" | "tenants" | "glossary" | "query" | "faq";

const sections: { key: DocSection; label: string; icon: string }[] = [
  { key: "quickstart", label: "Quick Start", icon: "🚀" },
  { key: "products", label: "Managing Products", icon: "📦" },
  { key: "modules", label: "Managing Modules", icon: "🧩" },
  { key: "features", label: "Writing Features", icon: "✏️" },
  { key: "ai-assist", label: "AI-Assisted Authoring", icon: "✨" },
  { key: "ingest", label: "Content Ingestion", icon: "📥" },
  { key: "registry", label: "Entity Registry", icon: "🗂️" },
  { key: "scenarios", label: "Scenarios (Large Features)", icon: "📋" },
  { key: "dependencies", label: "Mapping Dependencies", icon: "🔗" },
  { key: "tenants", label: "Tenant Overrides", icon: "🏢" },
  { key: "glossary", label: "Glossary", icon: "📖" },
  { key: "query", label: "Querying & Generating", icon: "🔍" },
  { key: "faq", label: "FAQ", icon: "❓" },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("quickstart");

  return (
    <div className="flex h-screen">
      {/* Doc Sidebar */}
      <div className="w-64 bg-kb-surface border-r border-kb-border flex flex-col shrink-0">
        <div className="p-4 border-b border-kb-border">
          <h2 className="text-sm font-semibold text-kb-text">📚 Documentation</h2>
          <p className="text-[10px] text-kb-text-dim mt-1">Everything you need to know</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                activeSection === s.key
                  ? "bg-kb-primary/15 text-kb-primary-light font-medium border border-kb-primary/20"
                  : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Doc Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {activeSection === "quickstart" && <QuickStart />}
          {activeSection === "products" && <ManagingProducts />}
          {activeSection === "modules" && <ManagingModules />}
          {activeSection === "features" && <WritingFeatures />}
          {activeSection === "ai-assist" && <AiAssist />}
          {activeSection === "ingest" && <ContentIngestion />}
          {activeSection === "registry" && <RegistryGuide />}
          {activeSection === "scenarios" && <Scenarios />}
          {activeSection === "dependencies" && <Dependencies />}
          {activeSection === "tenants" && <TenantOverrides />}
          {activeSection === "glossary" && <Glossary />}
          {activeSection === "query" && <QueryGenerate />}
          {activeSection === "faq" && <FAQ />}
        </div>
      </div>
    </div>
  );
}

// ─── Section Components ──────────────────────────────────

function DocHeading({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold text-kb-text tracking-tight mb-2">{children}</h1>;
}

function DocSubheading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-kb-text mt-8 mb-3 flex items-center gap-2">{children}</h2>;
}

function DocText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-kb-text-muted leading-relaxed mb-4">{children}</p>;
}

function DocNote({ type, children }: { type: "info" | "tip" | "warning"; children: React.ReactNode }) {
  const styles = {
    info: "border-kb-info/30 bg-kb-info/5 text-kb-info",
    tip: "border-kb-primary/30 bg-kb-primary/5 text-kb-primary-light",
    warning: "border-kb-accent/30 bg-kb-accent/5 text-kb-accent",
  };
  const icons = { info: "ℹ️", tip: "💡", warning: "⚠️" };
  return (
    <div className={`border-l-4 rounded-r-lg p-4 mb-4 ${styles[type]}`}>
      <div className="flex items-start gap-2 text-sm">
        <span>{icons[type]}</span>
        <div>{children}</div>
      </div>
    </div>
  );
}

function StepCard({ number, title, description, link, linkLabel }: { number: number; title: string; description: string; link?: string; linkLabel?: string }) {
  return (
    <div className="flex gap-4 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-kb-primary to-kb-primary-dark flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-kb-text mb-1">{title}</h3>
        <p className="text-sm text-kb-text-muted leading-relaxed">{description}</p>
        {link && (
          <Link href={link} className="text-sm text-kb-primary hover:text-kb-primary-light mt-2 inline-block font-medium">
            {linkLabel || "Go →"}
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Quick Start ──────────────────────────────────────────

function QuickStart() {
  return (
    <>
      <DocHeading>🚀 Quick Start Guide</DocHeading>
      <DocText>
        Welcome to the Knowledge Base! This is your central hub for all feature documentation.
        Here&apos;s how to get started in 5 minutes.
      </DocText>

      <DocNote type="info">
        This KB is designed to document feature knowledge so that LLMs can generate
        precise requirements, user stories, and impact analysis — without re-explaining context every time.
      </DocNote>

      <DocSubheading>Entity Hierarchy</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6 font-mono text-sm text-kb-text-muted">
        <pre>{`Product (top-level — e.g., DMS, SFA, eB2B)
  └── Module (feature grouping — e.g., Promotion, Inventory)
        └── Feature (knowledge document)
              └── Scenario (real-world workflow/flow)`}</pre>
      </div>
      <DocText>
        <strong>Products</strong> are your top-level entities (DMS, SFA). <strong>Modules</strong> group related features — a module can belong to multiple products (e.g., &quot;Promotion&quot; is shared by DMS and SFA). <strong>Features</strong> are the core KB documents. <strong>Scenarios</strong> break large features into individual workflows.
      </DocText>

      <DocSubheading>Your First 5 Minutes</DocSubheading>

      <StepCard
        number={1}
        title="Add a Product"
        description="Start by adding your product (e.g., DMS, SFA). Go to Contribute → select 'Product' tab → fill in the name and a brief overview."
        link="/contribute?type=product"
        linkLabel="Add Product →"
      />

      <StepCard
        number={2}
        title="Create a Module"
        description="Modules group features (e.g., Promotion, Inventory). Go to Contribute → 'Module' tab → name it, add an overview, and check which products it belongs to."
        link="/contribute?type=module"
        linkLabel="Add Module →"
      />

      <StepCard
        number={3}
        title="Set Up the Glossary"
        description="Add your company's canonical terms (e.g., Outlet, Beat, SKU, Scheme). This ensures everyone uses the same language — including AI. Go to Admin → Glossary."
        link="/admin"
        linkLabel="Manage Glossary →"
      />

      <StepCard
        number={4}
        title="Document Your First Feature"
        description="Pick a feature you know well (e.g., Order Management). Go to Contribute → 'Feature' tab → select the module → fill in the sections. The completeness meter will guide you."
        link="/contribute?type=feature"
        linkLabel="Add Feature →"
      />

      <StepCard
        number={5}
        title="Query Your KB"
        description="Go to Query & Generate. Select your product and ask a question like 'Generate requirements for adding a new approval workflow.' The system assembles context from your KB and generates output."
        link="/query"
        linkLabel="Try Querying →"
      />

      <DocSubheading>What Happens Under the Hood</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl mb-2">✏️</div>
            <div className="text-sm font-medium text-kb-text mb-1">You Fill the Form</div>
            <div className="text-xs text-kb-text-dim">Section-by-section, guided by templates</div>
          </div>
          <div>
            <div className="text-2xl mb-2">📄</div>
            <div className="text-sm font-medium text-kb-text mb-1">Structured Markdown</div>
            <div className="text-xs text-kb-text-dim">YAML frontmatter + Markdown body created</div>
          </div>
          <div>
            <div className="text-2xl mb-2">🤖</div>
            <div className="text-sm font-medium text-kb-text mb-1">AI Gets Context</div>
            <div className="text-xs text-kb-text-dim">Precise context assembled from KB for LLM</div>
          </div>
        </div>
      </div>

      <DocSubheading>Pages Overview</DocSubheading>
      <div className="space-y-2">
        {[
          { icon: "📊", name: "Dashboard", desc: "KB health: feature counts, module counts, drafts, products" },
          { icon: "📂", name: "Browse KB", desc: "Navigate Products → Modules → Features → Scenarios, preview content" },
          { icon: "✏️", name: "Contribute", desc: "Add products, modules, features, scenarios, tenants, overrides via forms" },
          { icon: "📥", name: "Ingest", desc: "Drop raw content (text, Confluence, images) — AI structures it into KB entities" },
          { icon: "🗂️", name: "Registry", desc: "Manage all KB entities — browse, edit, delete products, modules, features, scenarios, tenants, overrides" },
          { icon: "🔍", name: "Query & Generate", desc: "AI-powered: generate requirements, user stories, impact analysis" },
          { icon: "🔗", name: "Dependencies", desc: "Visualize and explore feature dependency map" },
          { icon: "⚙️", name: "Admin", desc: "Manage glossary, review queue, LLM config, Confluence integration" },
          { icon: "📚", name: "Docs & Guide", desc: "You are here! Guides and reference for using the KB" },
        ].map((page) => (
          <div key={page.name} className="flex items-center gap-3 p-3 bg-kb-surface rounded-lg border border-kb-border/50">
            <span className="text-lg">{page.icon}</span>
            <div>
              <span className="text-sm font-medium text-kb-text">{page.name}</span>
              <span className="text-sm text-kb-text-dim ml-2">— {page.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Managing Products ─────────────────────────────────

function ManagingProducts() {
  return (
    <>
      <DocHeading>📦 Managing Products</DocHeading>
      <DocText>
        Products are the top-level organizer in your KB. If your company has DMS (Distribution Management System), SFA (Sales Force Automation), eB2B, etc. — each is a separate product. Modules are then linked to products to group features.
      </DocText>

      <DocSubheading>How to Add a Product</DocSubheading>
      <StepCard number={1} title="Go to Contribute" description="Click 'Contribute' in the sidebar." link="/contribute?type=product" />
      <StepCard number={2} title="Select 'Product' tab" description="Click the 'Product' tab at the top of the form." />
      <StepCard number={3} title="Fill in details" description="Enter the Product Name (e.g., 'DMS') and an Overview describing what the product does, who uses it, and its overall role." />
      <StepCard number={4} title="Save" description="Click 'Save Product'. The product is created and becomes available for linking modules to it." />

      <DocNote type="tip">
        Keep the product overview concise but informative (100-200 words). After creating products, create <strong>Modules</strong> to group features within them.
      </DocNote>

      <DocSubheading>Typical Products for FMCG</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Product</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">What It Is</th>
          </tr></thead>
          <tbody>
            {[
              ["DMS", "Distribution Management System — manages orders, inventory, delivery, invoicing between company and distributors"],
              ["SFA", "Sales Force Automation — field sales app for reps: visit planning, in-field ordering, attendance, merchandising"],
              ["eB2B", "Electronic B2B platform for retailers to place orders directly"],
              ["AI Sales Agent", "AI-powered sales assistant for automated lead gen and engagement"],
            ].map(([name, desc]) => (
              <tr key={name} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-primary">{name}</td>
                <td className="p-3 text-kb-text-muted">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Managing Modules ─────────────────────────────────

function ManagingModules() {
  return (
    <>
      <DocHeading>🧩 Managing Modules</DocHeading>
      <DocText>
        Modules are <strong>logical groupings of features</strong>. They sit between Products and Features in the hierarchy. A single module can belong to multiple products — for example, &quot;Promotion&quot; applies to both DMS and SFA.
      </DocText>

      <DocSubheading>Why Modules?</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-kb-success">✓</span>
            <span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Cross-product features:</strong> A module like &quot;Promotion&quot; can be shared across DMS and SFA without duplicating feature docs.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-kb-success">✓</span>
            <span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Better organization:</strong> Features are grouped by domain, not just by product.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-kb-success">✓</span>
            <span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Scoped search:</strong> When querying, you can scope AI search to a specific module for more relevant results.</span>
          </div>
        </div>
      </div>

      <DocSubheading>How to Create a Module</DocSubheading>
      <StepCard number={1} title="Go to Contribute" description="Click 'Contribute' in the sidebar." link="/contribute?type=module" />
      <StepCard number={2} title="Select 'Module' tab" description="Click the 'Module' tab at the top of the form." />
      <StepCard number={3} title="Fill in details" description="Enter the Module Name (e.g., 'Promotion') and an Overview describing what this module covers." />
      <StepCard number={4} title="Link to Products" description="Check the products this module belongs to (e.g., DMS, SFA). A module can be linked to multiple products." />
      <StepCard number={5} title="Save" description="Click 'Save Module'. Features can now be assigned to this module." />

      <DocNote type="info">
        The <strong>Browse KB</strong> page shows a tree: Product → Module → Feature → Scenario. When you click a product, you see its modules. Click a module to see its features.
      </DocNote>

      <DocSubheading>Example Module Layout</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 font-mono text-sm text-kb-text-muted mb-6">
        <pre>{`DMS (Product)
  ├── Promotion (Module)     ← shared with SFA
  │     ├── Trade Promotions (Feature)
  │     ├── Promo Approval (Feature)
  │     └── Free Goods (Feature)
  ├── Inventory (Module)
  │     ├── Stock Management (Feature)
  │     └── Stock Transfer (Feature)
  └── Orders (Module)
        ├── Order Management (Feature)
        └── Returns (Feature)

SFA (Product)
  ├── Promotion (Module)     ← same module as DMS
  └── Field Sales (Module)
        ├── Visit Planning (Feature)
        └── Merchandising (Feature)`}</pre>
      </div>

      <DocSubheading>Module vs Product</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Aspect</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Product</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Module</th>
          </tr></thead>
          <tbody>
            {[
              ["Purpose", "Top-level entity (an app/system)", "Logical feature grouping (a domain area)"],
              ["Examples", "DMS, SFA, eB2B", "Promotion, Inventory, Orders"],
              ["Contains", "Modules (via links)", "Features (directly)"],
              ["Cross-linking", "N/A", "Can belong to multiple products"],
            ].map(([aspect, product, module]) => (
              <tr key={aspect} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-text">{aspect}</td>
                <td className="p-3 text-kb-text-muted">{product}</td>
                <td className="p-3 text-kb-primary">{module}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Writing Features ──────────────────────────────────

function WritingFeatures() {
  return (
    <>
      <DocHeading>✏️ Writing Feature Documentation</DocHeading>
      <DocText>
        Features are the core of the KB. Each feature belongs to a <strong>Module</strong> and captures everything needed to understand the feature at a high level.
      </DocText>

      <DocSubheading>Feature Document Sections</DocSubheading>
      <div className="space-y-2 mb-6">
        {[
          { section: "What It Does", guide: "2-3 sentences explaining the feature. Think: 'If a new joiner asks what this does, what do you say?'", required: true },
          { section: "Scope (In/Out)", guide: "What's included and explicitly excluded. Prevents scope creep.", required: true },
          { section: "Who Uses It", guide: "List roles and what each role does with this feature.", required: true },
          { section: "Rules", guide: "Numbered, testable rules. Aim for 5-15 clear statements.", required: true },
          { section: "Acceptance Criteria", guide: "Given/When/Then format. Makes rules testable.", required: true },
          { section: "User Flows", guide: "Step-by-step per flow. Name each flow (e.g., 'Place New Order').", required: true },
          { section: "Domain Events", guide: "Key state changes: what happens, when, who cares?", required: false },
          { section: "Data & Fields", guide: "Key fields captured. Only what matters for understanding.", required: false },
          { section: "Product-Level Behavior", guide: "Standard behavior for ALL tenants.", required: true },
          { section: "Tenant Configurations", guide: "What's configurable per tenant? Options, defaults, examples.", required: false },
          { section: "Examples", guide: "Real-world scenarios with concrete numbers/data.", required: false },
          { section: "Edge Cases", guide: "What can go wrong? Format: When [X] → [System should Y].", required: false },
          { section: "Dependencies", guide: "What features does this connect to? Use the search to find them.", required: false },
          { section: "Open Questions", guide: "Anything unresolved or needing clarification.", required: false },
        ].map((item) => (
          <div key={item.section} className="flex items-start gap-3 p-3 bg-kb-surface rounded-lg border border-kb-border/50">
            <span className={`text-xs px-1.5 py-0.5 rounded ${item.required ? "bg-kb-primary/15 text-kb-primary" : "bg-kb-surface-3 text-kb-text-dim"}`}>
              {item.required ? "Required" : "Optional"}
            </span>
            <div>
              <span className="text-sm font-medium text-kb-text">{item.section}</span>
              <p className="text-xs text-kb-text-dim mt-0.5">{item.guide}</p>
            </div>
          </div>
        ))}
      </div>

      <DocNote type="tip">
        The <strong>Completeness Meter</strong> in the editor tracks which required sections are filled. Aim for 80%+ before submitting for review.
      </DocNote>

      <DocSubheading>Feature-Level Glossary Terms</DocSubheading>
      <DocText>
        Each feature has its own <strong>Glossary Terms</strong> section — use it to define terms that are specific to this feature (e.g., &quot;FOC&quot; for Free Goods, &quot;Threshold&quot; for Promo Suggestions). These go beyond the global glossary and are automatically injected into AI context whenever this feature appears in search results.
      </DocText>
      <DocNote type="tip">
        Format: <strong>Term</strong> → Definition → Don&apos;t Say list. The AI will use your exact terminology in generated output.
      </DocNote>

      <DocSubheading>Applicable Products</DocSubheading>
      <DocText>
        Features belong to a <strong>Module</strong>, but you can also mark which <strong>Products</strong> they are applicable to via the &quot;Applicable Products&quot; field. This is useful when a feature in a shared module (like Promotion) behaves differently or is only relevant for certain products.
      </DocText>

      <DocSubheading>Writing Tips</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 space-y-3">
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Use glossary terms consistently. Write rules as testable statements.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Include concrete numbers in examples (₹500, 100 units, 5%).</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Think &quot;What if?&quot; — edge cases are where most bugs and missed requirements hide.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Write technical implementation details (APIs, database schemas, code).</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Use vague language like &quot;the system should handle it properly.&quot;</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Mix non-standard terminology. Check the glossary first.</span></div>
      </div>
    </>
  );
}

// ─── AI-Assisted Authoring ─────────────────────────────

function AiAssist() {
  return (
    <>
      <DocHeading>✨ AI-Assisted Authoring</DocHeading>
      <DocText>
        The AI Assist feature helps you author KB content faster. Instead of filling every field manually, you describe what you want in plain English and the AI generates a structured draft that fills all form fields.
      </DocText>

      <DocNote type="tip">
        Make sure <strong>LLM Config</strong> is set up in <Link href="/admin" className="text-kb-primary">Admin</Link> before using AI features. The system needs both a generation provider (for drafting) and an embedding provider (for RAG context).
      </DocNote>

      <DocSubheading>1. AI Draft — Describe &amp; Generate</DocSubheading>
      <DocText>
        At the top of every form (Product, Module, Feature, Scenario, Tenant, Tenant Override), you&apos;ll see a ✨ AI Draft box. Type a natural language description and click &quot;Generate Draft&quot;.
      </DocText>

      <StepCard
        number={1}
        title="Describe what you want"
        description="Type a description in the AI Draft box. You can paste meeting notes, PRD text, or just describe the feature conversationally. The more detail you provide, the better the draft."
      />
      <StepCard
        number={2}
        title="Click Generate Draft"
        description="The AI reads your description, pulls related content from the KB (RAG), checks the glossary, and generates structured content for every field in the form."
      />
      <StepCard
        number={3}
        title="Review and edit"
        description="All form fields are populated automatically. Review each section, correct anything that's wrong, add missing details, and remove anything that doesn't apply."
      />

      <DocNote type="warning">
        AI drafts are <strong>starting points, not final content</strong>. Always review the generated content for accuracy. The AI may hallucinate rules or make assumptions — your domain expertise is essential.
      </DocNote>

      <DocSubheading>2. Per-Section ✨ Suggest Buttons</DocSubheading>
      <DocText>
        Each section in the Feature form has a ✨ Suggest button next to its title. Click it to generate content for just that one section. The AI reads what you&apos;ve already filled in other sections to make relevant suggestions.
      </DocText>

      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="text-sm font-medium text-kb-text mb-3">Smart Context Chain</div>
        <div className="space-y-2 text-xs text-kb-text-muted">
          <div className="flex items-center gap-2">
            <span className="font-mono text-kb-primary">Rules</span>
            <span>← reads: What It Does, In Scope, Who Uses It</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-kb-primary">Acceptance Criteria</span>
            <span>← reads: Rules, User Flows, What It Does</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-kb-primary">Edge Cases</span>
            <span>← reads: Rules, User Flows, Acceptance Criteria</span>
          </div>
        </div>
      </div>

      <DocNote type="info">
        Suggest <strong>merges</strong> into existing content — it appends new items without replacing what you&apos;ve already written. Empty entries are cleaned up automatically.
      </DocNote>

      <DocSubheading>3. 🎯 Scenario Suggestions</DocSubheading>
      <DocText>
        When you&apos;re on the Scenario tab and select a parent feature, click &quot;🎯 Suggest Scenarios&quot;. The AI analyzes the feature documentation and suggests 5-10 distinct scenarios to document, with priority badges (High/Medium/Low).
      </DocText>
      <StepCard number={1} title="Select module and feature" description="Choose the parent module and feature in the Scenario tab dropdowns." />
      <StepCard number={2} title="Click Suggest Scenarios" description="AI analyzes the feature and suggests distinct scenarios. Already-documented scenarios are excluded." />
      <StepCard number={3} title="Pick and create" description="Check the scenarios you want, click 'Use Selected'. The scenario name is pre-filled — add the AI Draft description to generate full content." />

      <DocSubheading>4. 🔍 Quality Review</DocSubheading>
      <DocText>
        Before saving a Feature or Scenario, click &quot;🔍 Check Quality&quot; at the bottom of the form. The AI reviews your documentation and provides feedback:
      </DocText>

      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Check</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">What It Looks For</th>
          </tr></thead>
          <tbody>
            {[
              ["Completeness", "Are important sections filled? Any suspiciously thin?"],
              ["Testability", "Do rules use testable language? ACs in Given/When/Then?"],
              ["Consistency", "Do any rules contradict each other?"],
              ["Terminology", "Are glossary terms used consistently? Any missing terms?"],
              ["Coverage", "Are there obvious edge cases missing?"],
            ].map(([check, what]) => (
              <tr key={check} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-primary">{check}</td>
                <td className="p-3 text-kb-text-muted">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocSubheading>5. Tenant Override Drafting</DocSubheading>
      <DocText>
        In the Tenant Override tab, after selecting a tenant and feature, use the AI Draft box to describe what&apos;s different. The AI reads the standard feature content and the tenant profile to generate a structured comparison with configuration differences, custom rules, and flow impact.
      </DocText>

      <DocSubheading>Tips for Best Results</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 space-y-3">
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Provide detailed descriptions with specific numbers, roles, and rules.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Fill in &quot;What It Does&quot; and &quot;Rules&quot; first — other sections use them as context.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Run Quality Review before saving — it catches issues you might miss.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Trust AI-generated content blindly. Always review and verify against your domain knowledge.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Skip the glossary setup. AI uses glossary terms — inconsistent terminology leads to inconsistent output.</span></div>
      </div>

      <DocSubheading>6. 🔧 Smart KB Fix</DocSubheading>
      <DocText>
        After generating output on the <strong>Query &amp; Generate</strong> page, click <strong>🔧 Smart KB Fix</strong> to correct the KB when the AI gives a wrong answer. Paste what the correct answer should be, and the AI will identify exactly which chunks to edit or whether new content needs to be created.
      </DocText>

      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="text-sm font-medium text-kb-text mb-3">Smart Fix Flow</div>
        <div className="space-y-2 text-xs text-kb-text-muted">
          <div className="flex items-center gap-2">
            <span className="font-mono bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">Step 1</span>
            <span>Generate → see incorrect output → click 🔧 Smart KB Fix</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">Step 2</span>
            <span>Paste expected correct answer → click &quot;Analyze &amp; Suggest Fixes&quot;</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">Step 3</span>
            <span>Review diff view (red = before, green = after) — approve/reject individual fixes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">Step 4</span>
            <span>Click &quot;Apply Selected Fixes&quot; → KB is updated → Regenerate to verify</span>
          </div>
        </div>
      </div>

      <DocNote type="tip">
        Smart Fix can suggest <strong>editing existing chunks</strong> and <strong>creating new scenarios or features</strong> when content is missing from the KB entirely. All changes are logged in the system audit trail.
      </DocNote>
    </>
  );
}

// ─── Scenarios ─────────────────────────────────────────

function Scenarios() {
  return (
    <>
      <DocHeading>📋 Scenarios (Large Features)</DocHeading>
      <DocText>
        Some features are too big for a single document. For example, Trade Promotions may have 15+ distinct types (BOGOF, Slab Discounts, Combo Offers, etc.). These are split into <strong>Scenarios</strong>.
      </DocText>

      <DocSubheading>When to Use Scenarios</DocSubheading>
      <DocNote type="tip">
        <strong>Rule of thumb:</strong> If your feature has 4+ distinct user flows or promo/scheme types, split it into scenarios. The editor will warn you when it detects this.
      </DocNote>

      <DocSubheading>Structure</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 font-mono text-sm text-kb-text-muted mb-6">
        <pre>{`promotion/ (Module)
  trade-promotions/ (Feature)
    feature.md          ← Lean parent (~500 words)
                          Overview, scope, all deps
    scenarios/
      buy-x-get-y.md    ← Self-contained (~800 words)
      slab-discounts.md   Rules, flows, edge cases
      combo-offers.md     for THIS specific scenario
      promo-approval.md`}</pre>
      </div>

      <DocSubheading>Parent Feature vs Scenario</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">In the Parent</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">In Each Scenario</th>
          </tr></thead>
          <tbody>
            {[
              ["What It Does (overview)", "What It Does (specific scenario)"],
              ["Scope (entire feature)", "Rules (for this type only)"],
              ["All dependencies", "Acceptance Criteria"],
              ["List of all scenarios", "User Flows (step-by-step)"],
              ["Tenant config points", "Examples with real data"],
              ["—", "Edge Cases specific to this scenario"],
            ].map(([parent, scenario], i) => (
              <tr key={i} className="border-b border-kb-border/50">
                <td className="p-3 text-kb-text-muted">{parent}</td>
                <td className="p-3 text-kb-primary">{scenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocSubheading>Example: Trade Promotions Scenarios</DocSubheading>
      <div className="space-y-2">
        {["Buy X Get Y Free (BOGOF)", "Slab Discounts (volume-based)", "Combo Offers (buy A+B, get discount)", "Cash Discounts (payment-term based)", "Promotional Approval Workflows", "Free Goods (quantity-based giveaways)"].map((name) => (
          <div key={name} className="flex items-center gap-2 p-2 bg-kb-surface rounded-lg border border-kb-border/50">
            <span className="text-kb-primary">◆</span>
            <span className="text-sm text-kb-text">{name}</span>
          </div>
        ))}
      </div>

      <DocSubheading>Scenarios &amp; AI Search</DocSubheading>
      <DocNote type="info">
        Scenario content is <strong>automatically embedded into the vector search index</strong> when you save a scenario. This means when a user queries &quot;How does BOGOF work?&quot;, the system finds the BOGOF scenario directly — not just the parent feature. Each scenario chunk is indexed as <code>[Feature &gt; Scenario] [Section]</code> for precise retrieval.
      </DocNote>
    </>
  );
}

// ─── Dependencies ─────────────────────────────────────

function Dependencies() {
  return (
    <>
      <DocHeading>🔗 Mapping Dependencies</DocHeading>
      <DocText>
        Dependencies define how features talk to each other. This is one of the most powerful aspects of the KB — when you change a feature, the system can automatically flag all impacted features.
      </DocText>

      <DocSubheading>Dependency Types</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Type</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Meaning</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Example</th>
          </tr></thead>
          <tbody>
            {[
              ["configures", "A defines rules B evaluates", "Promo → Order (promo defines discount rules order applies)"],
              ["data-input", "B reads data from A", "Order reads discount amounts from Promo"],
              ["triggers", "A triggers action in B", "Order Confirmed → triggers Delivery creation"],
              ["validates", "A validates against B's data", "Order validates stock against Inventory"],
              ["settlement", "Financial flow between A and B", "Invoice → Claims (financial settlement)"],
            ].map(([type, meaning, example]) => (
              <tr key={type} className="border-b border-kb-border/50">
                <td className="p-3 font-mono text-kb-primary text-xs">{type}</td>
                <td className="p-3 text-kb-text-muted">{meaning}</td>
                <td className="p-3 text-kb-text-dim text-xs">{example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocSubheading>How to Add Dependencies</DocSubheading>
      <StepCard number={1} title="Open the Feature Editor" description="Go to Contribute → Feature → scroll to Dependencies section." />
      <StepCard number={2} title="Search for a feature" description="Type the feature name in the search box. Existing KB features appear as suggestions (across all modules)." />
      <StepCard number={3} title="Select and configure" description="Choose the type (configures, data-input, etc.), direction (incoming/outgoing), what flows, when, and impact if it changes." />

      <DocNote type="warning">
        <strong>If_this_changes</strong> is critical! This powers the impact analysis. When someone queries &quot;what happens if we change Promo?&quot;, the LLM uses this field to flag downstream effects.
      </DocNote>
    </>
  );
}

// ─── Tenant Overrides ──────────────────────────────────

function TenantOverrides() {
  return (
    <>
      <DocHeading>🏢 Tenant-Level Overrides</DocHeading>
      <DocText>
        Your solution is multi-tenant — different clients may have different configurations and workflows. The KB supports overrides at two granularities: <strong>feature-level</strong> (how the whole feature differs) and <strong>scenario-level</strong> (how a specific flow differs).
      </DocText>

      <DocSubheading>Four Layers of Knowledge</DocSubheading>
      <div className="space-y-3 mb-6">
        {[
          { layer: "Product-Level Behavior", where: "Feature → 'Product-Level Behavior' section", example: "Min order qty defaults to 1 for all tenants" },
          { layer: "Configurable Points", where: "Feature → 'Tenant Configurations' table", example: "Min order qty IS configurable per tenant" },
          { layer: "Feature Override", where: "Contribute → Tenant Overrides → Feature Level", example: "Tenant X: min qty = 10, RSM approval above ₹1L" },
          { layer: "Scenario Override", where: "Contribute → Tenant Overrides → Scenario Level", example: "Tenant X BOGOF flow: extra approval step added at ₹50k" },
        ].map((item, i) => (
          <div key={i} className="bg-kb-surface rounded-xl border border-kb-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-kb-primary/15 text-kb-primary text-xs flex items-center justify-center font-bold">{i + 1}</div>
              <span className="text-sm font-semibold text-kb-text">{item.layer}</span>
            </div>
            <p className="text-xs text-kb-text-dim ml-8">Where: {item.where}</p>
            <p className="text-xs text-kb-text-muted ml-8 mt-1">Example: {item.example}</p>
          </div>
        ))}
      </div>

      <DocSubheading>How to Add a Feature Override</DocSubheading>
      <StepCard number={1} title="Go to Contribute → Tenant Override tab" description="Select 'Feature Level' from the scope toggle." link="/contribute?type=tenant-override" />
      <StepCard number={2} title="Select Tenant, Module, Feature" description="Pick the tenant, the module containing the feature, and the specific feature you want to override." />
      <StepCard number={3} title="Read the standard feature in the reference panel" description="Once a feature is selected, a collapsible '📄 Standard Feature' panel appears below the dropdowns. Click it to expand and read the full feature content as a reference while writing your override." />
      <StepCard number={4} title="Write &amp; save the override" description="Document what's different: config values, custom rules, special workflows. The feature panel stays visible as you type. Hit Save — override is injected into AI context whenever that tenant is selected." />

      <DocSubheading>How to Add a Scenario Override</DocSubheading>
      <StepCard number={1} title="Switch to Scenario Level" description="In Contribute → Tenant Override tab, click 'Scenario Level' in the scope toggle." link="/contribute?type=tenant-override" />
      <StepCard number={2} title="Select Tenant, Module, Feature, Scenario" description="Pick the specific scenario whose flow is different for this tenant." />
      <StepCard number={3} title="Read the standard flow in the reference panel" description="Once you select a scenario, a collapsible '📋 Standard Scenario' panel appears below the dropdowns. Click it to expand and read the standard flow." />
      <StepCard number={4} title="Write & save the override" description="Describe how the step-by-step flow differs: extra steps, skipped steps, different thresholds. Hit Save when done — override appears in Browse KB under the scenario card." />

      <DocSubheading>Viewing Overrides in Browse KB</DocSubheading>
      <DocText>
        Once overrides are saved, they&apos;re visible directly in the <Link href="/browse" className="text-kb-primary">Browse KB</Link> page when viewing any feature.
      </DocText>

      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="text-sm font-medium text-kb-text mb-3">What You&apos;ll See</div>
        <div className="space-y-3 text-xs text-kb-text-muted">
          <div className="flex items-start gap-2">
            <span className="text-kb-primary font-bold">1.</span>
            <div>
              <span className="font-medium text-kb-text">🏢 Tenant Overrides</span> — A dedicated section appears after the feature content, showing all tenant-specific overrides. Each card shows the tenant name, update date, override content, and an ✏️ Edit link.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-kb-primary font-bold">2.</span>
            <div>
              <span className="font-medium text-kb-text">🏢 Tenant Notes</span> — Under each scenario card, a collapsible section shows scenario-level overrides from each tenant, with edit links and timestamps.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-kb-primary font-bold">3.</span>
            <div>
              <span className="font-medium text-kb-text">+ Add Override / + Add</span> — Quick-add buttons in both panels link directly to the Contribute page with the right context (module, feature, tenant) pre-filled.
            </div>
          </div>
        </div>
      </div>

      <DocNote type="info">
        When querying with a tenant selected in Query &amp; Generate, the system injects both feature-level and scenario-level overrides into AI context — scenario overrides are appended with higher priority since they describe exact flow differences.
      </DocNote>
    </>
  );
}

// ─── Glossary ──────────────────────────────────────────

function Glossary() {
  return (
    <>
      <DocHeading>📖 Glossary</DocHeading>
      <DocText>
        The glossary is your single source of truth for terms. Consistent terminology prevents confusion — especially when AI generates requirements.
      </DocText>

      <DocSubheading>Why It Matters</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 mb-6">
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-kb-danger">✗</span>
            <span className="text-sm text-kb-text-muted">Without glossary: one person writes &quot;store&quot;, another writes &quot;shop&quot;, another writes &quot;outlet&quot; — LLM gets confused.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-kb-success">✓</span>
            <span className="text-sm text-kb-text-muted">With glossary: Everyone uses &quot;<strong className="text-kb-primary">Outlet</strong>&quot;. AI knows exactly what you mean.</span>
          </div>
        </div>
      </div>

      <DocSubheading>Common FMCG Terms to Add</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Term</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Definition</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">❌ Don&apos;t Say</th>
          </tr></thead>
          <tbody>
            {[
              ["Outlet", "A retail point that sells to end consumers", "Store, Shop, Retail Point"],
              ["Beat", "A predefined route a sales rep follows daily", "Route, Territory"],
              ["SKU", "Stock Keeping Unit — a specific product variant", "Product, Item"],
              ["Scheme", "A promotional offer for trade partners", "Deal, Offer"],
              ["Primary Sale", "Sale from company to distributor", "First sale"],
              ["Secondary Sale", "Sale from distributor to retailer", "Second sale"],
              ["Lifting", "Quantity purchased by distributor from company", "Purchase, Buy"],
            ].map(([term, def, dont]) => (
              <tr key={term} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-primary">{term}</td>
                <td className="p-3 text-kb-text-muted">{def}</td>
                <td className="p-3 text-xs text-kb-danger/70">{dont}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocNote type="tip">
        <Link href="/admin" className="text-kb-primary hover:text-kb-primary-light">Go to Admin → Glossary</Link> to add these terms now.
      </DocNote>
    </>
  );
}

// ─── Query & Generate ─────────────────────────────────

function QueryGenerate() {
  return (
    <>
      <DocHeading>🔍 Querying & Generating</DocHeading>
      <DocText>
        The Query page is where the KB proves its value. Select context, ask a question, and get AI-generated output enriched with KB knowledge.
      </DocText>

      <DocSubheading>Four Query Modes</DocSubheading>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { mode: "Requirements", desc: "Numbered REQ statements with acceptance criteria (Given/When/Then)", example: "\"Generate requirements for adding percentage-based BOGOF\"" },
          { mode: "User Stories", desc: "As a [role], I want [goal], So that [benefit] + acceptance criteria", example: "\"Write user stories for the order approval workflow\"" },
          { mode: "Impact Analysis", desc: "Dependency-based impact assessment with severity ratings", example: "\"What features are affected if we change the promo calculation?\"" },
          { mode: "Free Query", desc: "Any question answered using KB context", example: "\"How does the claims settlement process work?\"" },
        ].map((item) => (
          <div key={item.mode} className="bg-kb-surface rounded-xl border border-kb-border p-4">
            <h3 className="text-sm font-semibold text-kb-primary mb-1">{item.mode}</h3>
            <p className="text-xs text-kb-text-muted mb-2">{item.desc}</p>
            <p className="text-xs text-kb-text-dim italic">{item.example}</p>
          </div>
        ))}
      </div>

      <DocSubheading>Context Assembly</DocSubheading>
      <DocText>
        The magic is in <strong>what context gets sent to the AI</strong>. The system assembles relevant knowledge in layers, injecting them into the LLM system prompt:
      </DocText>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 font-mono text-xs text-kb-text-muted space-y-2">
        <div><span className="text-kb-primary">Layer 1</span> — <strong>Global Glossary</strong>: KB-wide terms from Admin → Glossary</div>
        <div><span className="text-kb-primary">Layer 2</span> — <strong>Feature Terms</strong>: per-feature glossaryTerms from features in search results</div>
        <div><span className="text-kb-primary">Layer 3</span> — <strong>KB Chunks</strong>: top-10 semantically similar feature + scenario content (scoped by module)</div>
        <div><span className="text-kb-primary">Layer 4</span> — <strong>Scenario Overrides</strong>: tenant-specific flow differences (if tenant selected)</div>
        <div><span className="text-kb-primary">Layer 5</span> — <strong>Feature Overrides</strong>: tenant-specific config differences (if tenant selected) — highest priority</div>
      </div>

      <DocNote type="tip">
        Selecting a <strong>Tenant</strong> in the Query page injects both feature and scenario overrides — so answers for e.g. &quot;How does BOGOF work for Unilever?&quot; will automatically reflect Unilever-specific flow differences.
      </DocNote>

      <DocSubheading>Chunk Transparency</DocSubheading>
      <DocText>
        After generating, the page shows all context chunks used — with their similarity scores and <strong>module breadcrumbs</strong>. You can <strong>exclude individual chunks</strong> (e.g., an unrelated section) and regenerate. The AI only sees what you don&apos;t exclude.
      </DocText>
    </>
  );
}

// ─── FAQ ────────────────────────────────────────────────

function FAQ() {
  const faqs = [
    { q: "Who should write the KB?", a: "Whoever knows the features best. A lead can interview them and fill the form together — 45 min per feature." },
    { q: "What's the difference between a Product and a Module?", a: "A Product is a top-level entity like DMS or SFA — it's the application/system. A Module is a logical grouping of features (like Promotion, Inventory). Modules can be shared across products (e.g., Promotion exists in both DMS and SFA). Features belong to modules, not directly to products." },
    { q: "Is this technical documentation?", a: "No! This is pure feature-level knowledge. No APIs, database schemas, or code. Focus on: what the feature does, rules, who uses it, and how." },
    { q: "How long should a feature document be?", a: "Aim for 1000-3000 words across all sections. The completeness meter helps guide you. Quality over quantity." },
    { q: "When should I split into scenarios?", a: "When a feature has 4+ distinct types or workflows. The editor will suggest this. Example: Trade Promotions has BOGOF, Slab Discounts, Combo Offers — each is a scenario." },
    { q: "What are 'Applicable Products'?", a: "Features belong to a Module, but you can mark which Products they apply to via 'Applicable Products'. This is useful when a feature in a shared module (like Promotion) is only relevant for certain products." },
    { q: "What if I don't know everyone's dependencies?", a: "Start with what you know. Dependencies can be added later as others document their features. The search suggests existing KB features across all modules." },
    { q: "How often should docs be reviewed?", a: "Quarterly is recommended. The Admin page tracks stale docs (not updated in 3+ months) and sends reminders." },
    { q: "Can I edit a feature after saving?", a: "Yes. Go to Browse KB → find the feature → click '✏️ Edit'. The form re-opens with all current values pre-filled. Re-saving auto-updates the vector embeddings too." },
    { q: "What does 'tenant configurable' mean?", a: "It means this feature's behavior can differ per client/tenant. Mark the config points (e.g., 'Min order qty') so tenant overrides know what can be changed." },
    { q: "What's the difference between a Feature Override and a Scenario Override?", a: "Feature Override documents configuration differences for a whole feature (e.g., different min order value). Scenario Override documents flow differences for a specific scenario (e.g., extra approval step in the BOGOF flow). Both are injected into AI context when that tenant is selected." },
    { q: "Does saving a scenario auto-update search?", a: "Yes. Every time you save a scenario, the system automatically re-embeds its content into the vector search index. This means new or updated scenario content is immediately searchable by the AI on the next query." },
    { q: "What is the Ingest page?", a: "Ingest lets you drop raw, unstructured content (meeting notes, Confluence pages, screenshots) and have AI classify it into structured KB entities. Instead of manually filling forms, you paste content → AI creates draft products, modules, features, scenarios → you review and push to KB." },
    { q: "How does Confluence integration work?", a: "In Admin → Confluence, add your Atlassian URL, email, and API token. Then in Ingest, switch to the Confluence tab, search for pages, and add them as sources. The system fetches page content server-side and converts HTML to plain text for AI classification." },
    { q: "Can I upload images to create KB content?", a: "Yes. In the Ingest page, use the Image tab to upload screenshots, wireframes, or Jira ticket images. The system uses LLM vision to describe the image content, then includes that description in the classification along with any text sources." },
    { q: "What is the Registry page?", a: "Registry is the entity management hub. It shows all Products, Modules, Features, Scenarios, Tenants, and Overrides in searchable tables. You can edit (redirects to Contribute with pre-filled fields) or delete any entity from here." },
    { q: "Can I delete a module that has features?", a: "No. The system prevents deleting a module that still has features. You must delete or reassign all features first, then delete the module from Registry." },
    { q: "What happens when I delete a tenant?", a: "Deleting a tenant cascades: all feature overrides and scenario overrides for that tenant are also removed. A confirmation modal warns you before proceeding." },
  ];

  return (
    <>
      <DocHeading>❓ Frequently Asked Questions</DocHeading>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <details key={i} className="bg-kb-surface rounded-xl border border-kb-border group">
            <summary className="p-4 cursor-pointer text-sm font-medium text-kb-text hover:text-kb-primary-light transition-colors list-none flex items-center justify-between">
              {faq.q}
              <span className="text-kb-text-dim group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="px-4 pb-4 text-sm text-kb-text-muted leading-relaxed border-t border-kb-border/50 pt-3">
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

// ─── Content Ingestion ───────────────────────────────────────

function ContentIngestion() {
  return (
    <>
      <DocHeading>📥 Smart Content Ingestion</DocHeading>
      <DocText>
        Instead of filling every field manually, drop raw source material and let AI structure it into KB entities. The Ingest page is a 3-step wizard: add sources → review AI classifications → push to KB.
      </DocText>

      <DocNote type="tip">
        LLM Config must be set up in <Link href="/admin" className="text-kb-primary">Admin</Link> before using Ingest.
        For Confluence integration, also configure credentials in <strong>Admin → Confluence</strong>.
      </DocNote>

      <DocSubheading>Step 1: Add Sources</DocSubheading>
      <div className="space-y-2 mb-6">
        {[
          { icon: "📝", type: "Text", what: "Paste meeting notes, PRD text, Jira descriptions, requirements… any unstructured text.", tip: "More detail = better classification." },
          { icon: "🔗", type: "Confluence", what: "Search and select Confluence pages. Content is fetched and converted to text server-side.", tip: "Requires Confluence config in Admin → Confluence tab." },
          { icon: "📷", type: "Image", what: "Upload screenshots, wireframes, Jira tickets. LLM vision describes the content.", tip: "Supports PNG, JPG, WebP, GIF (up to 20MB)." },
        ].map((s) => (
          <div key={s.type} className="flex items-start gap-3 p-4 bg-kb-surface rounded-xl border border-kb-border/50">
            <span className="text-xl">{s.icon}</span>
            <div>
              <span className="text-sm font-semibold text-kb-text">{s.type}</span>
              <p className="text-xs text-kb-text-muted mt-0.5">{s.what}</p>
              <p className="text-xs text-kb-text-dim mt-1 italic">💡 {s.tip}</p>
            </div>
          </div>
        ))}
      </div>

      <DocSubheading>Step 2: Review AI Classifications</DocSubheading>
      <DocText>
        After clicking &ldquo;🚀 Analyze &amp; Classify&rdquo;, AI reads your sources + KB context (existing products, modules, features, glossary) and outputs structured entity cards:
      </DocText>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Entity Type</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">What AI Generates</th>
          </tr></thead>
          <tbody>
            {[
              ["📦 Product", "Name, overview"],
              ["🧩 Module", "Name, overview, linked product slugs"],
              ["⚡ Feature", "Name, whatItDoes, rules, acceptanceCriteria, userFlows, dataFields, edgeCases"],
              ["🎯 Scenario", "Name, userFlow, rules, additionalContent"],
            ].map(([type, fields]) => (
              <tr key={type} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-text">{type}</td>
                <td className="p-3 text-kb-text-muted">{fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DocText>
        Each card shows a confidence score, action badge (🆕 Create or ✏️ Append), and is fully <strong>editable</strong>. Click &ldquo;▶ Details&rdquo; to expand and edit individual fields. Toggle checkboxes to include/exclude entities.
      </DocText>

      <DocSubheading>Step 3: Push to KB</DocSubheading>
      <DocText>
        Click &ldquo;✅ Push to KB&rdquo; to create or update the selected entities. The system uses the same save functions as Contribute, auto-embeds content for RAG search, and logs all actions in the audit trail with <code>action: &ldquo;ingested&rdquo;</code>.
      </DocText>

      <DocSubheading>Setting Up Confluence</DocSubheading>
      <StepCard number={1} title="Go to Admin → Confluence tab" description="A new tab appears in the Admin page between LLM Config and Review Queue." link="/admin" />
      <StepCard number={2} title="Enter credentials" description="Confluence Base URL (e.g., https://company.atlassian.net/wiki), your Atlassian email, and an API token." />
      <StepCard number={3} title="Get an API token" description={'Go to Atlassian API Tokens (id.atlassian.com), create a token labeled "Knowledge Base", and paste it.'} />
      <StepCard number={4} title="Save" description="Click Save. The Ingest page will now show Confluence search when you switch to the Confluence source tab." />

      <DocNote type="warning">
        Confluence integration fetches page content <strong>server-side</strong>. The API token is stored in the database — ensure your Supabase project has encryption at rest enabled (default for Supabase).
      </DocNote>

      <DocSubheading>Tips for Best Results</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border p-5 space-y-3">
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Include multiple source types together — text notes + Confluence spec + wireframe screenshots give AI the most context.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Review and edit classified entities before pushing — AI may group content differently than expected.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-success">✓</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Do:</strong> Set up the glossary first — AI uses glossary terms during classification for consistent terminology.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Push entities without reviewing them. AI confidence scores below 70% indicate uncertainty.</span></div>
        <div className="flex items-start gap-2"><span className="text-kb-danger">✗</span><span className="text-sm text-kb-text-muted"><strong className="text-kb-text">Don&apos;t:</strong> Ingest very short text (&lt;50 words) — AI needs enough context to classify meaningfully.</span></div>
      </div>
    </>
  );
}

// ─── Entity Registry ─────────────────────────────────────────

function RegistryGuide() {
  return (
    <>
      <DocHeading>🗂️ Entity Registry</DocHeading>
      <DocText>
        The Registry page is your central hub for managing all KB entities. Browse, search, edit, and delete products, modules, features, scenarios, tenants, and overrides — all in one tabbed interface.
      </DocText>

      <DocNote type="tip">
        Registry is for <strong>managing existing entities</strong>. To create new entities, use <Link href="/contribute" className="text-kb-primary">Contribute</Link> or <Link href="/ingest" className="text-kb-primary">Ingest</Link>.
      </DocNote>

      <DocSubheading>Tabs</DocSubheading>
      <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-kb-border">
            <th className="text-left p-3 text-kb-text-muted font-medium">Tab</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Columns</th>
            <th className="text-left p-3 text-kb-text-muted font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {[
              ["📦 Products", "Name, Slug, Module Count, Features, Scenarios", "Edit, Delete"],
              ["🧩 Modules", "Name, Slug, Products, Feature Count", "Edit, Delete (blocked if has features)"],
              ["⚡ Features", "Title, Module, Slug, Products", "Edit, Delete (cascades scenarios + embeddings)"],
              ["🎯 Scenarios", "Title, Feature, Module, Status", "Edit, Delete"],
              ["🏢 Tenants", "Name, Slug, Overview", "Edit, Delete (cascades all overrides)"],
              ["🔀 Overrides", "Type, Tenant, Target, Module", "Edit, Delete"],
            ].map(([tab, cols, actions]) => (
              <tr key={tab} className="border-b border-kb-border/50">
                <td className="p-3 font-medium text-kb-text whitespace-nowrap">{tab}</td>
                <td className="p-3 text-kb-text-muted text-xs">{cols}</td>
                <td className="p-3 text-kb-text-dim text-xs">{actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DocSubheading>Editing Entities</DocSubheading>
      <DocText>
        Clicking <strong>✏️ Edit</strong> redirects you to the Contribute page with the entity type and slug pre-filled in the URL. The Contribute form loads the existing data so you can modify and re-save.
      </DocText>

      <DocSubheading>Deleting Entities</DocSubheading>
      <DocText>
        Clicking <strong>🗑 Delete</strong> opens a confirmation modal that warns you about cascade effects:
      </DocText>
      <div className="space-y-2 mb-6">
        {[
          { icon: "📦", entity: "Product", cascade: "Removes product-module links (modules and features remain)." },
          { icon: "🧩", entity: "Module", cascade: "Blocked if module has features. Delete features first." },
          { icon: "⚡", entity: "Feature", cascade: "Deletes all scenarios, embeddings, dependencies, and overrides." },
          { icon: "🎯", entity: "Scenario", cascade: "Deletes scenario embeddings and overrides." },
          { icon: "🏢", entity: "Tenant", cascade: "Deletes ALL feature and scenario overrides for this tenant." },
          { icon: "🔀", entity: "Override", cascade: "Deletes just the single override record." },
        ].map((item) => (
          <div key={item.entity} className="flex items-start gap-3 p-3 bg-kb-surface rounded-lg border border-kb-border/50">
            <span>{item.icon}</span>
            <div>
              <span className="text-sm font-medium text-kb-text">{item.entity}:</span>
              <span className="text-xs text-kb-text-muted ml-2">{item.cascade}</span>
            </div>
          </div>
        ))}
      </div>

      <DocSubheading>Search</DocSubheading>
      <DocText>
        Each tab has a search bar that filters entities client-side by name, slug, module, or tenant. Type to instantly narrow down results.
      </DocText>
    </>
  );
}
