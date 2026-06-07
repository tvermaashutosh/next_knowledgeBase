"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/lib/use-local-storage";
import { AiDraftBox } from "@/components/ai-assist/AiDraftBox";
import { AiSuggestButton } from "@/components/ai-assist/AiSuggestButton";
import { QualityReviewPanel } from "@/components/ai-assist/QualityReviewPanel";
import { ScenarioSuggester } from "@/components/ai-assist/ScenarioSuggester";

type ContributeType = "product" | "module" | "feature" | "scenario" | "tenant-override" | "tenant";

interface ProductOption {
  name: string;
  slug: string;
}

interface FeatureOption {
  product: string;
  module: string;
  feature: string;
  slug: string;
  moduleSlug: string;
  applicableProducts: string[];
}

interface DependencyForm {
  feature: string;       // display title
  featureSlug: string;   // slug of the target feature
  moduleSlug: string;   // slug of the target feature's module
  type: "configures" | "data-input" | "triggers" | "validates" | "settlement";
  direction: "incoming" | "outgoing";
  what: string;
  when: string;
  impact: string;
}

interface TenantConfigForm {
  configPoint: string;
  options: string;
  defaultValue: string;
  example: string;
}

function ContributePageContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as ContributeType | null;
  const [activeType, setActiveType] = useLocalStorage<ContributeType>("kb_contribute_tab", typeParam || "feature");

  // Products & modules list
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureOption[]>([]);
  const [modules, setModules] = useState<{ name: string; slug: string; featureCount: number; productSlugs: string[] }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state — Feature
  const [featureProduct, setFeatureProduct] = useLocalStorage("kb_contribute_product", "");
  const [featureModule, setFeatureModule] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [featureOwner, setFeatureOwner] = useState("");
  const [featureTags, setFeatureTags] = useState("");
  const [whatItDoes, setWhatItDoes] = useState("");
  const [inScope, setInScope] = useState("");
  const [outOfScope, setOutOfScope] = useState("");
  const [whoUsesIt, setWhoUsesIt] = useState("");
  const [rules, setRules] = useState<string[]>([""]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<{ desc: string; given: string; when: string; then: string }[]>([{ desc: "", given: "", when: "", then: "" }]);
  const [userFlows, setUserFlows] = useState<{ name: string; steps: string }[]>([{ name: "", steps: "" }]);
  const [domainEvents, setDomainEvents] = useState("");
  const [dataFields, setDataFields] = useState<{ field: string; description: string; required: boolean; example: string }[]>([{ field: "", description: "", required: false, example: "" }]);
  const [productBehavior, setProductBehavior] = useState("");
  const [tenantConfigurable, setTenantConfigurable] = useState(false);
  const [tenantConfigs, setTenantConfigs] = useState<TenantConfigForm[]>([]);
  const [examples, setExamples] = useState("");
  const [edgeCases, setEdgeCases] = useState<string[]>([""]);
  const [dependencies, setDependencies] = useState<DependencyForm[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>([""]);
  const [applicableProducts, setApplicableProducts] = useState<string[]>([]);
  const [glossaryTerms, setGlossaryTerms] = useState<{ term: string; definition: string; dontSay: string }[]>([]);

  // Form state — Product
  const [productName, setProductName] = useState("");
  const [productOverview, setProductOverview] = useState("");

  // Form state — Module
  const [moduleName, setModuleName] = useState("");
  const [moduleOverview, setModuleOverview] = useState("");
  const [moduleProducts, setModuleProducts] = useState<string[]>([]);

  // Form state — Scenario
  const [scenarioProduct, setScenarioProduct] = useLocalStorage("kb_scenario_product", "");
  const [scenarioFeature, setScenarioFeature] = useLocalStorage("kb_scenario_feature", "");
  const [scenarioFeatureOwnerProduct, setScenarioFeatureOwnerProduct] = useState(""); // owning product of the selected feature (may differ for shared features)
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioOwner, setScenarioOwner] = useState("");
  const [scenarioContent, setScenarioContent] = useState("");
  const [scenarioTags, setScenarioTags] = useState("");
  const [scenarioRules, setScenarioRules] = useState<string[]>("".split(","));
  const [scenarioSteps, setScenarioSteps] = useState("");
  const [scenarioSharedWith, setScenarioSharedWith] = useState<string[]>([]);

  // Form state — Tenant
  const [tenantName, setTenantName] = useState("");
  const [tenantOverview, setTenantOverview] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [depSearch, setDepSearch] = useState("");

  // ── AI Draft handler: Feature ──
  const handleFeatureDraft = useCallback((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (d.featureName) setFeatureName(d.featureName as string);
    if (d.module) setFeatureModule(d.module as string);
    if (d.tags) setFeatureTags((d.tags as string[]).join(", "));
    if (d.whatItDoes) setWhatItDoes(d.whatItDoes as string);
    if (d.inScope) setInScope((d.inScope as string[]).join("\n"));
    if (d.outOfScope) setOutOfScope((d.outOfScope as string[]).join("\n"));
    if (d.whoUsesIt) setWhoUsesIt(d.whoUsesIt as string);
    if (d.rules) setRules(d.rules as string[]);
    if (d.acceptanceCriteria) {
      setAcceptanceCriteria(
        (d.acceptanceCriteria as { desc: string; given: string; when: string; then: string }[]).map((ac) => ({
          desc: ac.desc || "",
          given: ac.given || "",
          when: ac.when || "",
          then: ac.then || "",
        }))
      );
    }
    if (d.userFlows) {
      setUserFlows(
        (d.userFlows as { name: string; steps: string }[]).map((f) => ({
          name: f.name || "",
          steps: f.steps || "",
        }))
      );
    }
    if (d.dataFields) {
      setDataFields(
        (d.dataFields as { field: string; description: string; required: boolean; example: string }[]).map((f) => ({
          field: f.field || "",
          description: f.description || "",
          required: !!f.required,
          example: f.example || "",
        }))
      );
    }
    if (d.domainEvents) setDomainEvents(d.domainEvents as string);
    if (d.productBehavior) setProductBehavior(d.productBehavior as string);
    if (d.tenantConfigurable !== undefined) setTenantConfigurable(d.tenantConfigurable as boolean);
    if (d.tenantConfigs) {
      setTenantConfigs(
        (d.tenantConfigs as { configPoint: string; options: string; defaultValue: string; example: string }[]).map((t) => ({
          configPoint: t.configPoint || "",
          options: t.options || "",
          defaultValue: t.defaultValue || "",
          example: t.example || "",
        }))
      );
    }
    if (d.edgeCases) setEdgeCases(d.edgeCases as string[]);
    if (d.examples) setExamples(d.examples as string);
    if (d.openQuestions) setOpenQuestions(d.openQuestions as string[]);
    if (d.glossaryTerms) {
      setGlossaryTerms(
        (d.glossaryTerms as { term: string; definition: string; dontSay: string }[]).map((g) => ({
          term: g.term || "",
          definition: g.definition || "",
          dontSay: g.dontSay || "",
        }))
      );
    }
  }, []);

  // ── AI Draft handler: Scenario ──
  const handleScenarioDraft = useCallback((data: unknown) => {
    const d = data as Record<string, unknown>;
    if (d.scenarioName) setScenarioName(d.scenarioName as string);
    if (d.tags) setScenarioTags((d.tags as string[]).join(", "));
    if (d.userFlow) setScenarioSteps(d.userFlow as string);
    if (d.rules) setScenarioRules(d.rules as string[]);
    if (d.additionalContent) setScenarioContent(d.additionalContent as string);
  }, []);

  // ── Build form snapshot for AI suggest / quality review ──
  const buildFeatureFormSnapshot = useCallback(() => ({
    featureName, whatItDoes, inScope, outOfScope, whoUsesIt,
    rules, acceptanceCriteria, userFlows, dataFields,
    domainEvents, productBehavior, tenantConfigurable, tenantConfigs,
    edgeCases, examples, openQuestions,
  }), [
    featureName, whatItDoes, inScope, outOfScope, whoUsesIt,
    rules, acceptanceCriteria, userFlows, dataFields,
    domainEvents, productBehavior, tenantConfigurable, tenantConfigs,
    edgeCases, examples, openQuestions,
  ]);

  // ── Section suggest handlers (merge into existing) ──
  const handleSectionSuggest = useCallback((section: string, data: unknown) => {
    switch (section) {
      case "rules":
        if (Array.isArray(data)) setRules((prev) => [...prev.filter(r => r.trim()), ...data]);
        break;
      case "acceptanceCriteria":
        if (Array.isArray(data)) setAcceptanceCriteria((prev) => [
          ...prev.filter(ac => ac.desc.trim()),
          ...(data as { desc: string; given: string; when: string; then: string }[]),
        ]);
        break;
      case "userFlows":
        if (Array.isArray(data)) setUserFlows((prev) => [
          ...prev.filter(f => f.name.trim()),
          ...(data as { name: string; steps: string }[]),
        ]);
        break;
      case "dataFields":
        if (Array.isArray(data)) setDataFields((prev) => [
          ...prev.filter(f => f.field.trim()),
          ...(data as { field: string; description: string; required: boolean; example: string }[]),
        ]);
        break;
      case "edgeCases":
        if (Array.isArray(data)) setEdgeCases((prev) => [...prev.filter(e => e.trim()), ...data]);
        break;
      case "openQuestions":
        if (Array.isArray(data)) setOpenQuestions((prev) => [...prev.filter(q => q.trim()), ...data]);
        break;
      case "glossaryTerms":
        if (Array.isArray(data)) setGlossaryTerms((prev) => [
          ...prev.filter(g => g.term.trim()),
          ...(data as { term: string; definition: string; dontSay: string }[]),
        ]);
        break;
      case "tenantConfigs":
        if (Array.isArray(data)) setTenantConfigs((prev) => [
          ...prev.filter(t => t.configPoint.trim()),
          ...(data as { configPoint: string; options: string; defaultValue: string; example: string }[]),
        ]);
        break;
      case "whatItDoes":
      case "whoUsesIt":
      case "domainEvents":
      case "productBehavior":
      case "examples":
        if (typeof data === "string") {
          const setters: Record<string, (v: string) => void> = {
            whatItDoes: setWhatItDoes, whoUsesIt: setWhoUsesIt,
            domainEvents: setDomainEvents, productBehavior: setProductBehavior,
            examples: setExamples,
          };
          setters[section]?.(data);
        }
        break;
      case "inScope":
        if (Array.isArray(data)) setInScope((prev) => prev ? prev + "\n" + data.join("\n") : data.join("\n"));
        break;
      case "outOfScope":
        if (Array.isArray(data)) setOutOfScope((prev) => prev ? prev + "\n" + data.join("\n") : data.join("\n"));
        break;
    }
  }, []);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    let remaining = 3;
    const done = () => { remaining--; if (remaining === 0) setLoadingInit(false); };
    fetch("/api/kb?action=products")
      .then((r) => r.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); done(); })
      .catch(done);
    fetch("/api/kb?action=all-features")
      .then((r) => r.json())
      .then((d) => { setAllFeatures(Array.isArray(d) ? d : []); done(); })
      .catch(done);
    fetch("/api/kb?action=modules")
      .then((r) => r.json())
      .then((d) => { setModules(Array.isArray(d) ? d : []); done(); })
      .catch(done);
  }, []);

  useEffect(() => {
    if (typeParam) setActiveType(typeParam);
  }, [typeParam]);

  // Edit mode: load existing feature data
  const editModule = searchParams.get("module") || searchParams.get("product");
  const editFeature = searchParams.get("feature");
  const [editLoaded, setEditLoaded] = useState(false);

  useEffect(() => {
    if (editModule && editFeature && activeType === "feature" && !editLoaded) {
      fetch(`/api/kb?action=feature&module=${editModule}&feature=${editFeature}`)
        .then((r) => r.json())
        .then((f) => {
          if (f.error) return;
          // Populate metadata
          setFeatureProduct(editModule);
          setFeatureName(f.title || "");
          setFeatureModule(f.module?.name || f.module || "");
          setFeatureOwner(""); // owner is by ID, uses current user
          setFeatureTags((f.tags || []).join(", "));
          setTenantConfigurable(f.tenantConfigurable || false);
          setApplicableProducts(f.applicableProducts || []);

          // Parse sections from contentMd
          const content = f.contentMd || "";
          const sections: Record<string, string> = {};
          let currentHeading = "";
          let currentLines: string[] = [];
          for (const line of content.split("\n")) {
            if (line.startsWith("## ")) {
              if (currentHeading) sections[currentHeading] = currentLines.join("\n").trim();
              currentHeading = line.replace("## ", "");
              currentLines = [];
            } else {
              currentLines.push(line);
            }
          }
          if (currentHeading) sections[currentHeading] = currentLines.join("\n").trim();

          // Map sections to form fields
          if (sections["What It Does"]) setWhatItDoes(sections["What It Does"]);
          if (sections["Scope"]) {
            const scopeText = sections["Scope"];
            const inM = scopeText.match(/### In Scope\n([\s\S]*?)(?=### Out|$)/);
            const outM = scopeText.match(/### Out of Scope\n([\s\S]*?)$/);
            if (inM) setInScope(inM[1].replace(/^- /gm, "").trim());
            if (outM) setOutOfScope(outM[1].replace(/^- /gm, "").trim());
          }
          if (sections["Who Uses It"]) setWhoUsesIt(sections["Who Uses It"]);
          if (sections["Rules"]) {
            const rules = sections["Rules"].split("\n").map(r => r.replace(/^\d+\.\s*/, "").replace(/^\*\*.*?\*\*:\s*/, "")).filter(r => r.trim());
            setRules(rules.length > 0 ? rules : [""]);
          }
          // Acceptance Criteria parser
          if (sections["Acceptance Criteria"]) {
            const acText = sections["Acceptance Criteria"];
            const acBlocks = acText.split(/### AC-\d+:\s*/).filter(b => b.trim());
            const parsed = acBlocks.map(block => {
              const lines = block.split("\n").filter(l => l.trim());
              const desc = lines[0] || "";
              const given = (block.match(/\*\*Given\*\*\s*(.*)/)?.[1] || "").trim();
              const when = (block.match(/\*\*When\*\*\s*(.*)/)?.[1] || "").trim();
              const then = (block.match(/\*\*Then\*\*\s*(.*)/)?.[1] || "").trim();
              return { desc, given, when, then };
            });
            if (parsed.length > 0) setAcceptanceCriteria(parsed);
          }
          // User Flows parser
          if (sections["User Flows"]) {
            const flowText = sections["User Flows"];
            const flowBlocks = flowText.split(/### /).filter(b => b.trim());
            const parsed = flowBlocks.map(block => {
              const lines = block.split("\n");
              const name = lines[0]?.trim() || "";
              const steps = lines.slice(1).join("\n").trim();
              return { name, steps };
            });
            if (parsed.length > 0) setUserFlows(parsed);
          }
          // Data & Fields parser (markdown table)
          const dataSection = sections["Data & Fields"] || sections["Data Fields"] || sections["Key Data Fields"];
          if (dataSection) {
            const rows = dataSection.split("\n").filter(l => l.startsWith("|") && !l.includes("---"));
            const parsed = rows.slice(1).map(row => { // skip header row
              const cols = row.split("|").map(c => c.trim()).filter(Boolean);
              return { field: cols[0] || "", description: cols[1] || "", required: (cols[2] || "").toLowerCase() === "yes", example: cols[3] || "" };
            }).filter(f => f.field);
            if (parsed.length > 0) setDataFields(parsed);
          }
          if (sections["Domain Events"]) setDomainEvents(sections["Domain Events"]);
          if (sections["Product-Level Behavior"]) setProductBehavior(sections["Product-Level Behavior"]);
          // Tenant-Level Configurations parser (markdown table)
          if (sections["Tenant-Level Configurations"]) {
            setTenantConfigurable(true);
            const rows = sections["Tenant-Level Configurations"].split("\n").filter(l => l.startsWith("|") && !l.includes("---"));
            const parsed = rows.slice(1).map(row => {
              const cols = row.split("|").map(c => c.trim()).filter(Boolean);
              return { configPoint: cols[0] || "", options: cols[1] || "", defaultValue: cols[2] || "", example: cols[3] || "" };
            }).filter(t => t.configPoint);
            if (parsed.length > 0) setTenantConfigs(parsed);
          }
          if (sections["Examples"]) setExamples(sections["Examples"]);
          // Edge Cases — handle both "Edge Cases & Exceptions" and "Edge Cases"
          const edgeCaseSection = sections["Edge Cases & Exceptions"] || sections["Edge Cases"];
          if (edgeCaseSection) {
            const cases = edgeCaseSection.split("\n").map(e => e.replace(/^- /, "")).filter(e => e.trim());
            setEdgeCases(cases.length > 0 ? cases : [""]);
          }
          if (sections["Open Questions"]) {
            const qs = sections["Open Questions"].split("\n").map(q => q.replace(/^- \[ \] /, "")).filter(q => q.trim());
            setOpenQuestions(qs.length > 0 ? qs : [""]);
          }

          setEditLoaded(true);
        })
        .catch(() => {});
    }
  }, [editModule, editFeature, activeType, editLoaded]);

  // Edit mode: load existing scenario data
  const editScenario = searchParams.get("scenario");
  const [scenarioEditLoaded, setScenarioEditLoaded] = useState(false);

  useEffect(() => {
    if (editModule && editFeature && editScenario && activeType === "scenario" && !scenarioEditLoaded) {
      fetch(`/api/kb?action=scenarios&module=${editModule}&feature=${editFeature}`)
        .then((r) => r.json())
        .then((scenarios: Array<{ slug: string; title: string; contentMd: string; tags: string[]; status: string }>) => {
          const sc = scenarios.find((s) => s.slug === editScenario);
          if (!sc) return;

          setScenarioProduct(editModule);
          setScenarioFeature(editFeature);
          setScenarioName(sc.title || "");
          setScenarioTags((sc.tags || []).join(", "));

          // Parse contentMd sections
          const content = sc.contentMd || "";
          const sections: Record<string, string> = {};
          let currentHeading = "";
          let currentLines: string[] = [];
          for (const line of content.split("\n")) {
            if (line.startsWith("## ")) {
              if (currentHeading) sections[currentHeading] = currentLines.join("\n").trim();
              currentHeading = line.replace("## ", "");
              currentLines = [];
            } else {
              currentLines.push(line);
            }
          }
          if (currentHeading) sections[currentHeading] = currentLines.join("\n").trim();

          if (sections["User Flow"]) setScenarioSteps(sections["User Flow"]);
          if (sections["Rules"]) {
            const rules = sections["Rules"].split("\n").map((r) => r.replace(/^\d+\.\s*/, "").replace(/^\*\*.*?\*\*:\s*/, "")).filter((r) => r.trim());
            setScenarioRules(rules.length > 0 ? rules : [""]);
          }

          // Any remaining sections go into scenarioContent
          const knownSections = ["User Flow", "Rules"];
          const extraSections = Object.entries(sections)
            .filter(([heading]) => !knownSections.includes(heading))
            .map(([heading, text]) => `## ${heading}\n${text}`)
            .join("\n\n");
          if (extraSections) setScenarioContent(extraSections);

          setScenarioEditLoaded(true);
        })
        .catch(() => {});
    }
  }, [editModule, editFeature, editScenario, activeType, scenarioEditLoaded]);

  // Edit mode: load existing product/module/tenant data
  const editSlug = searchParams.get("edit");
  const [entityEditLoaded, setEntityEditLoaded] = useState(false);

  useEffect(() => {
    if (!editSlug || entityEditLoaded) return;

    if (activeType === "product") {
      // Find the product from the already-fetched products list, or fetch stats
      fetch("/api/kb?action=stats")
        .then((r) => r.json())
        .then((data) => {
          const prod = (data.products || []).find((p: { slug: string }) => p.slug === editSlug);
          if (!prod) return;
          setProductName(prod.name || "");
          setProductOverview(prod.overview || "");
          setEntityEditLoaded(true);
        })
        .catch(() => {});
    } else if (activeType === "module") {
      fetch("/api/kb?action=all-modules")
        .then((r) => r.json())
        .then((mods: Array<{ slug: string; name: string; overview: string; productSlugs: string[] }>) => {
          const mod = mods.find((m) => m.slug === editSlug);
          if (!mod) return;
          setModuleName(mod.name || "");
          setModuleOverview(mod.overview || "");
          setModuleProducts(mod.productSlugs || []);
          setEntityEditLoaded(true);
        })
        .catch(() => {});
    } else if (activeType === "tenant") {
      fetch("/api/kb?action=tenants")
        .then((r) => r.json())
        .then((tenants: Array<{ slug: string; name: string; overview: string }>) => {
          const t = tenants.find((tn) => tn.slug === editSlug);
          if (!t) return;
          setTenantName(t.name || "");
          setTenantOverview(t.overview || "");
          setEntityEditLoaded(true);
        })
        .catch(() => {});
    }
  }, [editSlug, activeType, entityEditLoaded]);

  // Completeness calculation
  const getCompleteness = () => {
    const checks = [
      featureName, whatItDoes, inScope, whoUsesIt,
      rules.some(r => r.trim()),
      userFlows.some(f => f.name.trim()),
      productBehavior,
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  };

  const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

  const slugify = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ─── Delete Handler ───────────────────────────────────
  const handleDelete = async (action: string, payload: Record<string, string>, entityLabel: string) => {
    if (!confirm(`Are you sure you want to delete this ${entityLabel}? This cannot be undone.`)) return;
    setDeleting(entityLabel);
    setSaveMessage("");
    try {
      const res = await fetch("/api/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(`❌ ${data.error || "Delete failed"}`);
        return;
      }
      setSaveMessage(`✅ ${entityLabel} deleted`);
      // Refresh all data lists
      fetch("/api/kb?action=products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => {});
      fetch("/api/kb?action=all-features").then((r) => r.json()).then((d) => setAllFeatures(Array.isArray(d) ? d : [])).catch(() => {});
      fetch("/api/kb?action=modules").then((r) => r.json()).then((d) => setModules(Array.isArray(d) ? d : [])).catch(() => {});
    } catch {
      setSaveMessage("❌ Network error");
    } finally {
      setDeleting(null);
    }
  };

  const handleSave = async (status: "draft" | "review") => {
    const dbStatus = status.toUpperCase() as "DRAFT" | "REVIEW";
    setSaving(true);
    setSaveMessage("");

    try {
      if (activeType === "product") {
        await fetch("/api/kb?action=save-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slugify(productName),
            name: productName,
            overview: productOverview,
          }),
        });
        setSaveMessage("✅ Product saved!");
        // Refresh products
        const prods = await fetch("/api/kb?action=products").then((r) => r.json());
        setProducts(prods);
      } else if (activeType === "tenant") {
        await fetch("/api/kb?action=save-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: slugify(tenantName),
            name: tenantName,
            overview: tenantOverview,
          }),
        });
        setSaveMessage("✅ Tenant saved!");
      } else if (activeType === "module") {
        if (!moduleName) {
          setSaveMessage("❌ Module name is required");
          setSaving(false);
          return;
        }
        const moduleSlug = slugify(moduleName);
        await fetch("/api/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save-module", slug: moduleSlug, name: moduleName, overview: moduleOverview, productSlugs: moduleProducts }),
        });
        setSaveMessage("✅ Module saved!");
      } else if (activeType === "feature") {
        const frontmatter = {
          feature: featureName,
          product: featureProduct,
          module: featureModule,
          status: dbStatus,
          owner: featureOwner,
          last_updated: new Date().toISOString().split("T")[0],
          review_cycle: "quarterly",
          doc_completeness: getCompleteness() >= 80 ? "complete" : "partial",
          tags: featureTags.split(",").map((t) => t.trim()).filter(Boolean),
          dependencies: dependencies.map((d) => ({
            feature: d.feature,
            featureSlug: d.featureSlug,
            moduleSlug: d.moduleSlug,
            type: d.type,
            direction: d.direction,
            what: d.what,
            when: d.when,
            impact: d.impact,
          })),
          tenant_configurable: tenantConfigurable,
          tenant_config_points: tenantConfigs.map((t) => t.configPoint),
        };

        const sections: Record<string, string> = {};
        if (whatItDoes) sections["What It Does"] = whatItDoes;
        if (inScope || outOfScope) {
          let scope = "";
          if (inScope) scope += `### In Scope\n${inScope.split("\n").map((l) => `- ${l}`).join("\n")}\n\n`;
          if (outOfScope) scope += `### Out of Scope\n${outOfScope.split("\n").map((l) => `- ${l}`).join("\n")}`;
          sections["Scope"] = scope;
        }
        if (whoUsesIt) sections["Who Uses It"] = whoUsesIt;
        if (rules.some((r) => r.trim())) {
          sections["Rules"] = rules.filter((r) => r.trim()).map((r, i) => `${i + 1}. ${r}`).join("\n");
        }
        if (acceptanceCriteria.some((ac) => ac.desc.trim())) {
          sections["Acceptance Criteria"] = acceptanceCriteria
            .filter((ac) => ac.desc.trim())
            .map((ac, i) => `### AC-${String(i + 1).padStart(3, "0")}: ${ac.desc}\n- **Given** ${ac.given}\n- **When** ${ac.when}\n- **Then** ${ac.then}`)
            .join("\n\n");
        }
        if (userFlows.some((f) => f.name.trim())) {
          sections["User Flows"] = userFlows
            .filter((f) => f.name.trim())
            .map((f) => `### ${f.name}\n${f.steps}`)
            .join("\n\n");
        }
        if (domainEvents) sections["Domain Events"] = domainEvents;
        if (dataFields.some((f) => f.field.trim())) {
          const header = "| Field | Description | Required | Example |\n|-------|-------------|----------|---------|";
          const rows = dataFields
            .filter((f) => f.field.trim())
            .map((f) => `| ${f.field} | ${f.description} | ${f.required ? "Yes" : "No"} | ${f.example} |`)
            .join("\n");
          sections["Data & Fields"] = `${header}\n${rows}`;
        }
        if (productBehavior) sections["Product-Level Behavior"] = productBehavior;
        if (tenantConfigurable && tenantConfigs.length > 0) {
          const header = "| Config Point | Options | Default | Example |\n|-------------|---------|---------|---------|";
          const rows = tenantConfigs.map((t) => `| ${t.configPoint} | ${t.options} | ${t.defaultValue} | ${t.example} |`).join("\n");
          sections["Tenant-Level Configurations"] = `${header}\n${rows}`;
        }
        if (examples) sections["Examples"] = examples;
        if (edgeCases.some((e) => e.trim())) {
          sections["Edge Cases & Exceptions"] = edgeCases.filter((e) => e.trim()).map((e) => `- ${e}`).join("\n");
        }
        if (dependencies.length > 0) {
          const incoming = dependencies.filter((d) => d.direction === "incoming");
          const outgoing = dependencies.filter((d) => d.direction === "outgoing");
          let depText = "";
          if (incoming.length) {
            depText += "### Incoming (I receive from)\n" + incoming.map((d) => `- **${d.feature}** [${d.type}] — ${d.what}`).join("\n") + "\n\n";
          }
          if (outgoing.length) {
            depText += "### Outgoing (I push to)\n" + outgoing.map((d) => `- **${d.feature}** [${d.type}] — ${d.what}`).join("\n");
          }
          sections["Dependencies"] = depText;
        }
        if (openQuestions.some((q) => q.trim())) {
          sections["Open Questions"] = openQuestions.filter((q) => q.trim()).map((q) => `- [ ] ${q}`).join("\n");
        }

        const today = new Date().toISOString().split("T")[0];
        sections["Changelog"] = `| Date | Author | What Changed |\n|------|--------|-------------|\n| ${today} | ${featureOwner} | Initial draft |`;

        const resp = await fetch("/api/kb?action=save-feature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleSlug: featureProduct,
            featureSlug: slugify(featureName),
            frontmatter,
            sections,
            applicableProducts,
            glossaryTerms: glossaryTerms.map((g) => ({
              term: g.term,
              definition: g.definition,
              dontSay: g.dontSay.split(",").map((s) => s.trim()).filter(Boolean),
            })).filter((g) => g.term.trim()),
            completeness: getCompleteness(),
            // Pass dependencies at top-level so the route can persist them to the Dependency table
            dependencies: dependencies.map((d) => ({
              featureSlug: d.featureSlug,
              moduleSlug: d.moduleSlug,
              type: d.type,
              direction: d.direction,
              what: d.what,
              when: d.when,
              impact: d.impact,
            })).filter((d) => d.featureSlug),
          }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) {
          setSaveMessage(`❌ Error: ${result.error || resp.statusText}`);
        } else {
          setSaveMessage(`✅ Feature saved as ${status}!`);
        }
      } else if (activeType === "scenario") {
        if (!scenarioProduct || !scenarioFeature || !scenarioName) {
          setSaveMessage("❌ Select product, feature, and name");
          setSaving(false);
          return;
        }

        // Build scenario markdown
        let contentMd = "";
        if (scenarioSteps) {
          contentMd += `## User Flow\n${scenarioSteps}\n\n`;
        }
        if (scenarioRules.some((r) => r.trim())) {
          contentMd += `## Rules\n${scenarioRules.filter((r) => r.trim()).map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n`;
        }
        if (scenarioContent) {
          contentMd += scenarioContent;
        }

        await fetch("/api/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save-scenario",
            moduleSlug: scenarioFeatureOwnerProduct || scenarioProduct,  // use owning module for shared features
            featureSlug: scenarioFeature,
            scenarioSlug: slugify(scenarioName),
            title: scenarioName,
            contentMd,
            status: dbStatus,
            tags: scenarioTags.split(",").map((t) => t.trim()).filter(Boolean),
            applicableProducts: scenarioSharedWith,
          }),
        });
        setSaveMessage(`✅ Scenario saved as ${status}!`);
      }
    } catch (error) {
      setSaveMessage(`❌ Error: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const depSuggestions = depSearch
    ? allFeatures.filter(
        (f) =>
          f.feature.toLowerCase().includes(depSearch.toLowerCase()) ||
          (f.module || f.product || "").toLowerCase().includes(depSearch.toLowerCase())
      )
    : [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-kb-text tracking-tight">Contribute</h1>
        <p className="text-kb-text-muted mt-1">Add or edit knowledge base content</p>
      </div>

      {/* Type Selector */}
      <div className="flex gap-2 mb-8 bg-kb-surface rounded-xl border border-kb-border p-1.5">
        {(["product", "module", "feature", "scenario", "tenant", "tenant-override"] as ContributeType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeType === type
                ? "bg-kb-primary text-white shadow-lg shadow-kb-primary/20"
                : "text-kb-text-muted hover:text-kb-text hover:bg-kb-surface-2"
            }`}
          >
            {type === "tenant-override" ? "Tenant Override" : type === "module" ? "Module" : type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Product Form ─── */}
      {activeType === "product" && (
        <div className="space-y-6">

          <AiDraftBox
            entityType="product"
            onDraftGenerated={(data) => {
              const d = data as Record<string, unknown>;
              if (d.name) setProductName(d.name as string);
              if (d.overview) setProductOverview(d.overview as string);
            }}
          />
          <FormSection title="Product Details">
            <FormField label="Product Name" hint="e.g., DMS, SFA">
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="form-input"
                placeholder="Distribution Management System"
              />
            </FormField>
            <FormField label="Overview" hint="What does this product do? Who is it for?">
              <textarea
                value={productOverview}
                onChange={(e) => setProductOverview(e.target.value)}
                className="form-input min-h-[120px]"
                placeholder="Describe the product at a high level..."
              />
            </FormField>
          </FormSection>
          <SaveButtons
            onSave={() => handleSave("draft")} saving={saving} message={saveMessage} showReview={false} saveLabel="Save Product"
          />
        </div>
      )}

      {/* ─── Module Form ─── */}
      {activeType === "module" && (
        <div className="space-y-6">

          <FormSection title="Module Details">
            <FormField label="Module Name" hint="e.g., Promotion, Inventory">
              <input
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="form-input"
                placeholder="Promotion"
              />
            </FormField>
            <FormField label="Overview" hint="What does this module cover?">
              <textarea
                value={moduleOverview}
                onChange={(e) => setModuleOverview(e.target.value)}
                className="form-input min-h-[120px]"
                placeholder="Handles all promotion-related features including trade promotions, schemes, free goods, and discount management."
              />
            </FormField>
            {products.length > 0 && (
              <FormField label="Linked Products" hint="Select products this module belongs to">
                <div className="flex flex-wrap gap-2 mt-1">
                  {products.map((p) => (
                    <label key={p.slug} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={moduleProducts.includes(p.slug)}
                        onChange={(e) => {
                          if (e.target.checked) setModuleProducts([...moduleProducts, p.slug]);
                          else setModuleProducts(moduleProducts.filter((s) => s !== p.slug));
                        }}
                        className="rounded accent-kb-primary"
                      />
                      <span className="text-sm text-kb-text-muted">{p.name}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            )}
          </FormSection>
          <SaveButtons
            onSave={() => handleSave("draft")} saving={saving} message={saveMessage} showReview={false} saveLabel="Save Module"
          />
        </div>
      )}

      {/* ─── Tenant Form ─── */}
      {activeType === "tenant" && (
        <div className="space-y-6">
          <AiDraftBox
            entityType="tenant"
            onDraftGenerated={(data) => {
              const d = data as Record<string, unknown>;
              if (d.name) setTenantName(d.name as string);
              if (d.overview) setTenantOverview(d.overview as string);
            }}
          />
          <FormSection title="Tenant Details">
            <FormField label="Tenant Name">
              <input
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                className="form-input"
                placeholder="e.g., Acme Corp"
              />
            </FormField>
            <FormField label="Overview" hint="Region, channel, contract type, key differences">
              <textarea
                value={tenantOverview}
                onChange={(e) => setTenantOverview(e.target.value)}
                className="form-input min-h-[120px]"
                placeholder="Describe this tenant..."
              />
            </FormField>
          </FormSection>
          <SaveButtons onSave={() => handleSave("draft")} saving={saving} message={saveMessage} showReview={false} saveLabel="Save Tenant" />
        </div>
      )}

      {/* ─── Feature Form ─── */}
      {activeType === "feature" && (
        <div className="space-y-6">

          <AiDraftBox
            entityType="feature"
            moduleSlug={featureProduct}
            onDraftGenerated={handleFeatureDraft}
          />
          {/* Edit Mode Banner */}
          {editModule && editFeature && editLoaded && (
            <div className="bg-kb-primary/10 rounded-xl border border-kb-primary/20 p-4 flex items-center gap-3">
              <span className="text-lg">✏️</span>
              <div>
                <p className="text-sm font-semibold text-kb-primary-light">Editing: {featureName}</p>
                <p className="text-xs text-kb-text-dim">Changes will update the existing feature documentation</p>
              </div>
            </div>
          )}

          {/* Completeness Meter */}
          <div className="bg-kb-surface rounded-xl border border-kb-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-kb-text">Completeness</span>
              <span className={`text-sm font-bold ${getCompleteness() >= 80 ? "text-kb-success" : getCompleteness() >= 50 ? "text-kb-warning" : "text-kb-danger"}`}>
                {getCompleteness()}%
              </span>
            </div>
            <div className="w-full bg-kb-surface-3 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getCompleteness() >= 80 ? "bg-kb-success" : getCompleteness() >= 50 ? "bg-kb-warning" : "bg-kb-danger"}`}
                style={{ width: `${getCompleteness()}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          <FormSection title="Metadata">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Product">
                {loadingInit ? (
                  <div className="h-9 bg-kb-surface-3 rounded-lg animate-pulse" />
                ) : (
                  <select value={featureProduct} onChange={(e) => setFeatureProduct(e.target.value)} className="form-input">
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField label="Module" hint="e.g., Sales & Trade">
                <input value={featureModule} onChange={(e) => setFeatureModule(e.target.value)} className="form-input" placeholder="Sales & Trade" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Feature Name">
                <input value={featureName} onChange={(e) => setFeatureName(e.target.value)} className="form-input" placeholder="e.g., Order Management" />
              </FormField>
              <FormField label="Owner">
                <input value={featureOwner} onChange={(e) => setFeatureOwner(e.target.value)} className="form-input" placeholder="Your name" />
              </FormField>
            </div>
            <FormField label="Tags" hint="Comma-separated keywords">
              <input value={featureTags} onChange={(e) => setFeatureTags(e.target.value)} className="form-input" placeholder="orders, sales, inventory" />
            </FormField>
            <FormField label="Applicable Products" hint="Select products this feature applies to (leave empty for all products in this module)">
                <div className="flex flex-wrap gap-2 mt-1">
                  {products.map((p) => (
                    <label key={p.slug} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applicableProducts.includes(p.slug)}
                        onChange={(e) => {
                          if (e.target.checked) setApplicableProducts([...applicableProducts, p.slug]);
                          else setApplicableProducts(applicableProducts.filter((s) => s !== p.slug));
                        }}
                        className="rounded accent-kb-primary"
                      />
                      <span className="text-sm text-kb-text-muted">{p.name}</span>
                    </label>
                  ))}
                </div>
              </FormField>
          </FormSection>

          {/* What It Does */}
          <FormSection title="What It Does" hint="If someone asks what this feature does, what do you say?" wordCount={wordCount(whatItDoes)} target="50-100"
            aiSuggest={<AiSuggestButton section="whatItDoes" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("whatItDoes", d)} />}
          >
            <textarea
              value={whatItDoes}
              onChange={(e) => setWhatItDoes(e.target.value)}
              className="form-input min-h-[80px]"
              placeholder="Trade Promotions allows the company to define discount schemes for retailers to drive sales volume..."
            />
          </FormSection>

          {/* Scope */}
          <FormSection title="Scope"
            aiSuggest={<AiSuggestButton section="inScope" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("inScope", d)} label="✨ Suggest In-Scope" />}
          >
            <FormField label="In Scope" hint="What does this feature handle? (one item per line)">
              <textarea
                value={inScope}
                onChange={(e) => setInScope(e.target.value)}
                className="form-input min-h-[80px]"
                placeholder="Order creation and editing&#10;Order approval workflow&#10;Order cancellation"
              />
            </FormField>
            <FormField label="Out of Scope" hint="What does this feature NOT do? (prevents scope creep)">
              <textarea
                value={outOfScope}
                onChange={(e) => setOutOfScope(e.target.value)}
                className="form-input min-h-[60px]"
                placeholder="Delivery tracking (separate feature)&#10;Payment processing"
              />
            </FormField>
          </FormSection>

          {/* Who Uses It */}
          <FormSection title="Who Uses It" hint="List roles and what they do with this feature"
            aiSuggest={<AiSuggestButton section="whoUsesIt" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("whoUsesIt", d)} />}
          >
            <textarea
              value={whoUsesIt}
              onChange={(e) => setWhoUsesIt(e.target.value)}
              className="form-input min-h-[80px]"
              placeholder="**Sales Rep** — places orders at outlets&#10;**ASM** — reviews and approves orders&#10;**Finance** — views order reports"
            />
          </FormSection>

          {/* Rules */}
          <FormSection title="Rules" hint="Each rule should be a clear, testable statement. Aim for 5-15 rules."
            aiSuggest={<AiSuggestButton section="rules" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("rules", d)} />}
          >
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-kb-text-dim text-sm mt-2.5 w-6 text-right">{i + 1}.</span>
                  <input
                    value={rule}
                    onChange={(e) => {
                      const updated = [...rules];
                      updated[i] = e.target.value;
                      setRules(updated);
                    }}
                    className="form-input flex-1"
                    placeholder="Order value must exceed ₹500 to qualify for free delivery"
                  />
                  {rules.length > 1 && (
                    <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger transition-colors text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setRules([...rules, ""])} className="add-btn">+ Add Rule</button>
          </FormSection>

          {/* Acceptance Criteria */}
          <FormSection title="Acceptance Criteria" hint="Given/When/Then format — makes rules testable"
            aiSuggest={<AiSuggestButton section="acceptanceCriteria" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("acceptanceCriteria", d)} />}
          >
            <div className="space-y-4">
              {acceptanceCriteria.map((ac, i) => (
                <div key={i} className="bg-kb-surface-2 rounded-lg p-4 border border-kb-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-kb-text-dim font-medium">AC-{String(i + 1).padStart(3, "0")}</span>
                    {acceptanceCriteria.length > 1 && (
                      <button onClick={() => setAcceptanceCriteria(acceptanceCriteria.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-xs">Remove</button>
                    )}
                  </div>
                  <input value={ac.desc} onChange={(e) => { const u = [...acceptanceCriteria]; u[i] = { ...u[i], desc: e.target.value }; setAcceptanceCriteria(u); }} className="form-input" placeholder="Short description" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={ac.given} onChange={(e) => { const u = [...acceptanceCriteria]; u[i] = { ...u[i], given: e.target.value }; setAcceptanceCriteria(u); }} className="form-input text-xs" placeholder="Given..." />
                    <input value={ac.when} onChange={(e) => { const u = [...acceptanceCriteria]; u[i] = { ...u[i], when: e.target.value }; setAcceptanceCriteria(u); }} className="form-input text-xs" placeholder="When..." />
                    <input value={ac.then} onChange={(e) => { const u = [...acceptanceCriteria]; u[i] = { ...u[i], then: e.target.value }; setAcceptanceCriteria(u); }} className="form-input text-xs" placeholder="Then..." />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setAcceptanceCriteria([...acceptanceCriteria, { desc: "", given: "", when: "", then: "" }])} className="add-btn">+ Add Criteria</button>
          </FormSection>

          {/* User Flows */}
          <FormSection title="User Flows" hint="Step-by-step flows. One flow per sub-section. If 4+ flows, consider using Scenarios."
            aiSuggest={<AiSuggestButton section="userFlows" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("userFlows", d)} />}
          >
            <div className="space-y-4">
              {userFlows.map((flow, i) => (
                <div key={i} className="bg-kb-surface-2 rounded-lg p-4 border border-kb-border/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={flow.name} onChange={(e) => { const u = [...userFlows]; u[i] = { ...u[i], name: e.target.value }; setUserFlows(u); }} className="form-input flex-1" placeholder="Flow name, e.g., Place New Order" />
                    {userFlows.length > 1 && (
                      <button onClick={() => setUserFlows(userFlows.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-xs px-2">✕</button>
                    )}
                  </div>
                  <textarea value={flow.steps} onChange={(e) => { const u = [...userFlows]; u[i] = { ...u[i], steps: e.target.value }; setUserFlows(u); }} className="form-input min-h-[80px] text-sm" placeholder="1. Sales Rep opens order form&#10;2. Selects outlet from beat&#10;3. Adds products and quantities&#10;4. System applies eligible promos&#10;5. Rep submits → order goes to approval" />
                </div>
              ))}
            </div>
            <button onClick={() => setUserFlows([...userFlows, { name: "", steps: "" }])} className="add-btn">+ Add Flow</button>
            {userFlows.length >= 4 && (
              <p className="text-xs text-kb-warning mt-2">💡 4+ flows detected — consider splitting this into scenarios for better organization.</p>
            )}
          </FormSection>

          {/* Domain Events */}
          <FormSection title="Domain Events" hint="Key state changes that matter. What happens in the system?">
            <textarea value={domainEvents} onChange={(e) => setDomainEvents(e.target.value)} className="form-input min-h-[80px]" placeholder="| Event | When It Happens | Who Cares |&#10;| Order Confirmed | After approval | Delivery, Inventory |&#10;| Order Cancelled | Manual cancel | Promo, Inventory |" />
          </FormSection>

          {/* Data & Fields */}
          <FormSection title="Data & Fields" hint="Key fields this feature captures — just what matters for understanding"
            aiSuggest={<AiSuggestButton section="dataFields" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("dataFields", d)} />}
          >
            <div className="space-y-2">
              {dataFields.map((field, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={field.field} onChange={(e) => { const u = [...dataFields]; u[i] = { ...u[i], field: e.target.value }; setDataFields(u); }} className="form-input col-span-3 text-sm" placeholder="Field name" />
                  <input value={field.description} onChange={(e) => { const u = [...dataFields]; u[i] = { ...u[i], description: e.target.value }; setDataFields(u); }} className="form-input col-span-4 text-sm" placeholder="Description" />
                  <label className="col-span-2 flex items-center gap-1 text-xs text-kb-text-muted">
                    <input type="checkbox" checked={field.required} onChange={(e) => { const u = [...dataFields]; u[i] = { ...u[i], required: e.target.checked }; setDataFields(u); }} className="rounded" />
                    Required
                  </label>
                  <input value={field.example} onChange={(e) => { const u = [...dataFields]; u[i] = { ...u[i], example: e.target.value }; setDataFields(u); }} className="form-input col-span-2 text-sm" placeholder="Example" />
                  <button onClick={() => setDataFields(dataFields.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-sm col-span-1">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setDataFields([...dataFields, { field: "", description: "", required: false, example: "" }])} className="add-btn">+ Add Field</button>
          </FormSection>

          {/* Product-Level Behavior */}
          <FormSection title="Product-Level Behavior" hint="How this works the same way for ALL tenants — the standard behavior">
            <textarea value={productBehavior} onChange={(e) => setProductBehavior(e.target.value)} className="form-input min-h-[100px]" placeholder="Describe the standard behavior that applies to all tenants..." />
          </FormSection>

          {/* Tenant-Level Configurations */}
          <FormSection title="Tenant-Level Configurations">
            <label className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={tenantConfigurable} onChange={(e) => setTenantConfigurable(e.target.checked)} className="rounded" />
              <span className="text-sm text-kb-text">This feature is configurable per tenant</span>
            </label>
            {tenantConfigurable && (
              <>
                <div className="space-y-2">
                  {tenantConfigs.map((tc, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2">
                      <input value={tc.configPoint} onChange={(e) => { const u = [...tenantConfigs]; u[i] = { ...u[i], configPoint: e.target.value }; setTenantConfigs(u); }} className="form-input text-sm" placeholder="Config point" />
                      <input value={tc.options} onChange={(e) => { const u = [...tenantConfigs]; u[i] = { ...u[i], options: e.target.value }; setTenantConfigs(u); }} className="form-input text-sm" placeholder="Options" />
                      <input value={tc.defaultValue} onChange={(e) => { const u = [...tenantConfigs]; u[i] = { ...u[i], defaultValue: e.target.value }; setTenantConfigs(u); }} className="form-input text-sm" placeholder="Default" />
                      <div className="flex gap-1">
                        <input value={tc.example} onChange={(e) => { const u = [...tenantConfigs]; u[i] = { ...u[i], example: e.target.value }; setTenantConfigs(u); }} className="form-input text-sm flex-1" placeholder="Example" />
                        <button onClick={() => setTenantConfigs(tenantConfigs.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-sm px-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTenantConfigs([...tenantConfigs, { configPoint: "", options: "", defaultValue: "", example: "" }])} className="add-btn">+ Add Config Point</button>
              </>
            )}
          </FormSection>

          {/* Examples */}
          <FormSection title="Examples" hint="Real-world scenarios that help understand this feature">
            <textarea value={examples} onChange={(e) => setExamples(e.target.value)} className="form-input min-h-[100px]" placeholder="### Example: Large Distributor Order&#10;> Distributor ABC places order for 500 units...&#10;> Promo applies → 50 free units added..." />
          </FormSection>

          {/* Edge Cases */}
          <FormSection title="Edge Cases & Exceptions" hint="What can go wrong? Format: When [X] → [System should Y]"
            aiSuggest={<AiSuggestButton section="edgeCases" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("edgeCases", d)} />}
          >
            <div className="space-y-2">
              {edgeCases.map((ec, i) => (
                <div key={i} className="flex gap-2">
                  <input value={ec} onChange={(e) => { const u = [...edgeCases]; u[i] = e.target.value; setEdgeCases(u); }} className="form-input flex-1" placeholder="When free product is out of stock → Order proceeds, free goods backordered" />
                  {edgeCases.length > 1 && (
                    <button onClick={() => setEdgeCases(edgeCases.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setEdgeCases([...edgeCases, ""])} className="add-btn">+ Add Edge Case</button>
          </FormSection>

          {/* Dependencies */}
          <FormSection title="Dependencies" hint="What features does this connect to?">
            {/* Search */}
            <div className="relative mb-4">
              <input
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
                className="form-input"
                placeholder="Search features to add as dependency..."
              />
              {depSearch && depSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-kb-surface-2 border border-kb-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                  {depSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setDependencies([...dependencies, { feature: s.feature, featureSlug: s.slug, moduleSlug: s.moduleSlug, type: "data-input", direction: "incoming", what: "", when: "", impact: "" }]);
                        setDepSearch("");
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-kb-surface-3 text-kb-text"
                    >
                      <span className="font-medium">{s.feature}</span>
                      <span className="text-kb-text-dim ml-2">({s.module})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dependency cards */}
            <div className="space-y-3">
              {dependencies.map((dep, i) => (
                <div key={i} className="bg-kb-surface-2 rounded-lg p-4 border border-kb-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-kb-primary-light">{dep.feature}</span>
                    <button onClick={() => setDependencies(dependencies.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={dep.type} onChange={(e) => { const u = [...dependencies]; u[i] = { ...u[i], type: e.target.value as DependencyForm["type"] }; setDependencies(u); }} className="form-input text-sm">
                      <option value="configures">Configures</option>
                      <option value="data-input">Data Input</option>
                      <option value="triggers">Triggers</option>
                      <option value="validates">Validates</option>
                      <option value="settlement">Settlement</option>
                    </select>
                    <select value={dep.direction} onChange={(e) => { const u = [...dependencies]; u[i] = { ...u[i], direction: e.target.value as "incoming" | "outgoing" }; setDependencies(u); }} className="form-input text-sm">
                      <option value="incoming">Incoming (I receive)</option>
                      <option value="outgoing">Outgoing (I push)</option>
                    </select>
                  </div>
                  <input value={dep.what} onChange={(e) => { const u = [...dependencies]; u[i] = { ...u[i], what: e.target.value }; setDependencies(u); }} className="form-input text-sm" placeholder="What flows between?" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={dep.when} onChange={(e) => { const u = [...dependencies]; u[i] = { ...u[i], when: e.target.value }; setDependencies(u); }} className="form-input text-sm" placeholder="When?" />
                    <input value={dep.impact} onChange={(e) => { const u = [...dependencies]; u[i] = { ...u[i], impact: e.target.value }; setDependencies(u); }} className="form-input text-sm" placeholder="If this changes?" />
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          {/* Open Questions */}
          <FormSection title="Open Questions" hint="Anything unresolved?">
            <div className="space-y-2">
              {openQuestions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <input value={q} onChange={(e) => { const u = [...openQuestions]; u[i] = e.target.value; setOpenQuestions(u); }} className="form-input flex-1" placeholder="Question..." />
                  {openQuestions.length > 1 && (
                    <button onClick={() => setOpenQuestions(openQuestions.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setOpenQuestions([...openQuestions, ""])} className="add-btn">+ Add Question</button>
          </FormSection>

          {/* Feature-level Glossary */}
          <FormSection title="Terms & Definitions" hint="Terms specific to this feature (shown in Browse alongside content)"
            aiSuggest={<AiSuggestButton section="glossaryTerms" currentForm={buildFeatureFormSnapshot()} moduleSlug={featureProduct} onSuggestion={(d) => handleSectionSuggest("glossaryTerms", d)} />}
          >
            <div className="space-y-3">
              {glossaryTerms.map((g, i) => (
                <div key={i} className="bg-kb-surface-2 rounded-lg border border-kb-border/50 p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-kb-text-dim font-medium">Term {i + 1}</span>
                    <button onClick={() => setGlossaryTerms(glossaryTerms.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={g.term}
                      onChange={(e) => { const u = [...glossaryTerms]; u[i] = { ...u[i], term: e.target.value }; setGlossaryTerms(u); }}
                      className="form-input text-sm"
                      placeholder="Term — e.g., Discount Slab"
                    />
                    <input
                      value={g.dontSay}
                      onChange={(e) => { const u = [...glossaryTerms]; u[i] = { ...u[i], dontSay: e.target.value }; setGlossaryTerms(u); }}
                      className="form-input text-sm"
                      placeholder="Don't say — e.g., Price Band, Tier (comma-separated)"
                    />
                  </div>
                  <textarea
                    value={g.definition}
                    onChange={(e) => { const u = [...glossaryTerms]; u[i] = { ...u[i], definition: e.target.value }; setGlossaryTerms(u); }}
                    className="form-input text-sm min-h-[60px] w-full"
                    placeholder="Definition specific to this feature's context..."
                  />
                </div>
              ))}
            </div>
            <button onClick={() => setGlossaryTerms([...glossaryTerms, { term: "", definition: "", dontSay: "" }])} className="add-btn">+ Add Term</button>
          </FormSection>

          <QualityReviewPanel formData={buildFeatureFormSnapshot()} entityType="feature" />

          <SaveButtons
            onSave={handleSave} saving={saving} message={saveMessage} showReview={true}
            onDelete={featureName && featureModule ? () => handleDelete("delete-feature", { moduleSlug: featureModule, featureSlug: slugify(featureName) }, "Feature") : undefined}
          />
        </div>
      )}

      {/* ─── Scenario Form ─── */}
      {activeType === "scenario" && (
        <div className="space-y-6">
          <AiDraftBox
            entityType="scenario"
            moduleSlug={scenarioProduct}
            featureSlug={scenarioFeature}
            onDraftGenerated={handleScenarioDraft}
          />

          {scenarioProduct && scenarioFeature && (
            <ScenarioSuggester
              moduleSlug={scenarioProduct}
              featureSlug={scenarioFeature}
              onScenarioSelected={(sc) => {
                setScenarioName(sc.title);
              }}
            />
          )}
          <FormSection title="Scenario Details">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Product">
                <select value={scenarioProduct} onChange={(e) => setScenarioProduct(e.target.value)} className="form-input">
                  <option value="">Select product...</option>
                  {products.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
                </select>
              </FormField>
              <FormField label="Parent Feature">
                <select
                  value={scenarioFeature ? `${scenarioFeatureOwnerProduct}__${scenarioFeature}` : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) { setScenarioFeature(""); setScenarioFeatureOwnerProduct(""); return; }
                    const [ownerSlug, ...rest] = val.split("__");
                    setScenarioFeatureOwnerProduct(ownerSlug);
                    setScenarioFeature(rest.join("__"));
                  }}
                  className="form-input"
                >
                  <option value="">Select feature...</option>
                  {allFeatures
                    .filter(f => f.moduleSlug === scenarioProduct)
                    .map((f) => (
                      <option key={`${f.moduleSlug}__${f.slug}`} value={`${f.moduleSlug}__${f.slug}`}>
                        {f.feature}
                      </option>
                    ))}
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Scenario Name">
                <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} className="form-input" placeholder="e.g., Buy X Get Y Free" />
              </FormField>
              <FormField label="Owner">
                <input value={scenarioOwner} onChange={(e) => setScenarioOwner(e.target.value)} className="form-input" placeholder="Your name" />
              </FormField>
            </div>
            <FormField label="Tags" hint="Comma-separated keywords">
              <input value={scenarioTags} onChange={(e) => setScenarioTags(e.target.value)} className="form-input" placeholder="promo, BOGOF, free-goods" />
            </FormField>
            {/* Scenario-level sharedWith — only relevant when the parent feature is shared */}
            {(() => {
              const ownerProd = scenarioFeatureOwnerProduct || scenarioProduct;
              const parentFeature = allFeatures.find(f => f.slug === scenarioFeature && f.moduleSlug === ownerProd);
              const parentShared: string[] = parentFeature?.applicableProducts || [];
              if (parentShared.length === 0) return null;
              // All products this feature touches: owning + all shared
              const allProductSlugs = [...new Set([ownerProd, ...parentShared])];
              const productNames: Record<string, string> = Object.fromEntries(
                products.filter(p => allProductSlugs.includes(p.slug)).map(p => [p.slug, p.name])
              );
              return (
                <FormField label="Visible In Products" hint="Leave all unchecked = visible in every product this feature is shared with">
                  <div className="flex flex-wrap gap-3 mt-1">
                    {allProductSlugs.map((slug) => (
                      <label key={slug} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scenarioSharedWith.includes(slug)}
                          onChange={(e) => {
                            if (e.target.checked) setScenarioSharedWith([...scenarioSharedWith, slug]);
                            else setScenarioSharedWith(scenarioSharedWith.filter(s => s !== slug));
                          }}
                          className="w-4 h-4 rounded border-kb-border accent-kb-primary"
                        />
                        <span className="text-sm text-kb-text">{productNames[slug] || slug}</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              );
            })()}
          </FormSection>

          {/* User Flow Steps */}
          <FormSection title="User Flow" hint="Step-by-step flow for this scenario">
            <textarea
              value={scenarioSteps}
              onChange={(e) => setScenarioSteps(e.target.value)}
              className="form-input min-h-[120px]"
              placeholder={"1. Sales Rep selects a promo type (BOGOF)\n2. System shows eligible products\n3. Rep adds qualifying product to order\n4. System auto-adds free product\n5. Order total reflects discount"}
            />
          </FormSection>

          {/* Rules */}
          <FormSection title="Rules" hint="Rules specific to this scenario">
            <div className="space-y-2">
              {scenarioRules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-kb-text-dim text-sm mt-2.5 w-6 text-right">{i + 1}.</span>
                  <input
                    value={rule}
                    onChange={(e) => {
                      const u = [...scenarioRules];
                      u[i] = e.target.value;
                      setScenarioRules(u);
                    }}
                    className="form-input flex-1"
                    placeholder="e.g., Minimum 2 qualifying items required for BOGOF"
                  />
                  {scenarioRules.length > 1 && (
                    <button onClick={() => setScenarioRules(scenarioRules.filter((_, j) => j !== i))} className="text-kb-text-dim hover:text-kb-danger transition-colors text-sm px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setScenarioRules([...scenarioRules, ""])} className="add-btn">+ Add Rule</button>
          </FormSection>

          {/* Additional Content */}
          <FormSection title="Additional Details" hint="Edge cases, examples, configuration — any extra context in markdown">
            <textarea
              value={scenarioContent}
              onChange={(e) => setScenarioContent(e.target.value)}
              className="form-input min-h-[150px] font-mono text-sm"
              placeholder={"## Edge Cases\n- When free product is out of stock → backorder\n- When multiple promos apply → highest value wins\n\n## Configuration\n| Setting | Default |\n|---------|---------|\n| max_free_qty | 10 |"}
            />
          </FormSection>

          <QualityReviewPanel formData={{ scenarioName, scenarioSteps, scenarioRules, scenarioContent }} entityType="scenario" />

          <SaveButtons
            onSave={handleSave} saving={saving} message={saveMessage} showReview={true}
            onDelete={scenarioName && scenarioProduct && scenarioFeature ? () => handleDelete("delete-scenario", { moduleSlug: scenarioProduct, featureSlug: scenarioFeature, scenarioSlug: slugify(scenarioName) }, "Scenario") : undefined}
          />
        </div>
      )}

      {/* ─── Tenant Override Form ─── */}
      {activeType === "tenant-override" && (
        <TenantOverrideEditor products={products} allFeatures={allFeatures} />
      )}
    </div>
  );
}

// ─── Tenant Override Editor ─────────────────────────────

function TenantOverrideEditor({ products, allFeatures }: { products: ProductOption[]; allFeatures: FeatureOption[] }) {
  const [tenants, setTenants] = useState<{ name: string; slug: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useLocalStorage("kb_override_tenant", "");
  const [selectedProduct, setSelectedProduct] = useLocalStorage("kb_override_product", "");
  const [selectedFeature, setSelectedFeature] = useState("");
  const [overrideScope, setOverrideScope] = useLocalStorage<"feature" | "scenario">("kb_override_scope", "feature");
  const [scenarios, setScenarios] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [overrideContent, setOverrideContent] = useState("");
  const [existingOverride, setExistingOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [scenarioPreview, setScenarioPreview] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [featurePreview, setFeaturePreview] = useState("");
  const [featurePreviewOpen, setFeaturePreviewOpen] = useState(false);

  useEffect(() => {
    fetch("/api/kb?action=tenants").then((r) => r.json()).then(setTenants).catch(() => {});
  }, []);

  // Load scenarios when feature is selected (for scenario scope)
  useEffect(() => {
    if (selectedProduct && selectedFeature && overrideScope === "scenario") {
      fetch(`/api/kb?action=scenarios&product=${selectedProduct}&feature=${selectedFeature}`)
        .then((r) => r.json())
        .then((d) => setScenarios(Array.isArray(d) ? d : []))
        .catch(() => setScenarios([]));
    } else {
      setScenarios([]);
      setSelectedScenario("");
    }
  }, [selectedProduct, selectedFeature, overrideScope]);

  // Load feature content for reference panel (feature-level override)
  useEffect(() => {
    if (overrideScope === "feature" && selectedProduct && selectedFeature) {
      fetch(`/api/kb?action=feature&product=${selectedProduct}&feature=${selectedFeature}`)
        .then((r) => r.json())
        .then((data: { contentMd?: string }) => setFeaturePreview(data?.contentMd || ""))
        .catch(() => setFeaturePreview(""));
    } else {
      setFeaturePreview("");
      setFeaturePreviewOpen(false);
    }
  }, [selectedProduct, selectedFeature, overrideScope]);

  // Load scenario content for reference panel
  useEffect(() => {
    if (overrideScope === "scenario" && selectedScenario && scenarios.length > 0) {
      const s = scenarios.find((x) => x.slug === selectedScenario);
      if (s && "contentMd" in s) {
        setScenarioPreview((s as { contentMd?: string }).contentMd || "");
      } else {
        // Fetch full scenario content if not in state
        fetch(`/api/kb?action=scenarios&product=${selectedProduct}&feature=${selectedFeature}`)
          .then((r) => r.json())
          .then((data: Array<{ slug: string; contentMd?: string }>) => {
            const match = data.find((x) => x.slug === selectedScenario);
            setScenarioPreview(match?.contentMd || "");
          })
          .catch(() => setScenarioPreview(""));
      }
    } else {
      setScenarioPreview("");
      setPreviewOpen(false);
    }
  }, [selectedScenario, overrideScope, scenarios, selectedProduct, selectedFeature]);

  // Load existing override when tenant + feature/scenario selected
  useEffect(() => {
    if (selectedTenant && selectedFeature && overrideScope === "feature") {
      fetch(`/api/kb?action=tenant-overrides&tenant=${selectedTenant}`)
        .then((r) => r.json())
        .then((overrides) => {
          const match = overrides.find((o: { featureSlug: string }) => o.featureSlug === selectedFeature);
          if (match) { setOverrideContent(match.contentMd || ""); setExistingOverride(true); }
          else { setOverrideContent(""); setExistingOverride(false); }
        }).catch(() => {});
    } else if (selectedTenant && selectedScenario && overrideScope === "scenario") {
      fetch(`/api/kb?action=scenario-overrides&scenarioId=${selectedScenario}`)
        .then((r) => r.json())
        .then((overrides) => {
          const match = overrides.find((o: { tenantSlug: string }) => o.tenantSlug === selectedTenant);
          if (match) { setOverrideContent(match.contentMd || ""); setExistingOverride(true); }
          else { setOverrideContent(""); setExistingOverride(false); }
        }).catch(() => {});
    }
  }, [selectedTenant, selectedFeature, selectedScenario, overrideScope]);

  const filteredFeatures = selectedProduct
    ? allFeatures.filter((f) => f.moduleSlug === selectedProduct)
    : allFeatures;

  const handleSave = async () => {
    const isScenario = overrideScope === "scenario";
    if (!selectedTenant || !selectedFeature || !selectedProduct || (isScenario && !selectedScenario)) {
      setMessage("❌ Select all required fields first");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await fetch("/api/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isScenario
            ? { action: "save-scenario-override", tenantSlug: selectedTenant, moduleSlug: selectedProduct, featureSlug: selectedFeature, scenarioSlug: selectedScenario, contentMd: overrideContent }
            : { action: "save-tenant-override", tenantSlug: selectedTenant, featureSlug: selectedFeature, moduleSlug: selectedProduct, contentMd: overrideContent }
        ),
      });
      setExistingOverride(true);
      setMessage("✅ Override saved!");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("❌ Failed to save");
    }
    setSaving(false);
  };

  const readyToEdit = overrideScope === "feature"
    ? (selectedTenant && selectedFeature)
    : (selectedTenant && selectedFeature && selectedScenario);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-kb-surface-2 rounded-xl border border-kb-border/50 p-4 text-sm text-kb-text-muted">
        <p className="font-medium text-kb-text mb-1">🏢 Tenant Overrides</p>
        <p>Document how a feature or a specific scenario behaves differently for a client. Overrides are injected into AI context when that tenant is selected.</p>
      </div>

      {/* Scope Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-kb-text-dim font-medium">Override level:</span>
        {(["feature", "scenario"] as const).map((scope) => (
          <button
            key={scope}
            onClick={() => { setOverrideScope(scope); setSelectedScenario(""); setOverrideContent(""); setExistingOverride(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${overrideScope === scope ? "bg-kb-primary text-white shadow-sm" : "bg-kb-surface text-kb-text-muted border border-kb-border hover:border-kb-primary/50"}`}
          >
            {scope === "feature" ? "🔧 Feature Level" : "🎬 Scenario Level"}
          </button>
        ))}
      </div>

      {/* Selectors */}
      <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
        <h3 className="text-base font-semibold text-kb-text mb-4">
          {overrideScope === "feature" ? "Select Tenant & Feature" : "Select Tenant, Feature & Scenario"}
        </h3>
        <div className={`grid gap-4 ${overrideScope === "feature" ? "grid-cols-3" : "grid-cols-2"}`}>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Tenant</label>
            <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)} className="form-input">
              <option value="">Select tenant...</option>
              {tenants.map((t) => (<option key={t.slug} value={t.slug}>{t.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Product</label>
            <select value={selectedProduct} onChange={(e) => { setSelectedProduct(e.target.value); setSelectedFeature(""); setSelectedScenario(""); }} className="form-input">
              <option value="">Select product...</option>
              {products.map((p) => (<option key={p.slug} value={p.slug}>{p.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-text-dim mb-1 block">Feature</label>
            <select value={selectedFeature} onChange={(e) => { setSelectedFeature(e.target.value); setSelectedScenario(""); }} className="form-input">
              <option value="">Select feature...</option>
              {filteredFeatures.map((f) => (<option key={f.slug} value={f.slug}>{f.feature}</option>))}
            </select>
          </div>
          {overrideScope === "scenario" && (
            <div>
              <label className="text-xs text-kb-text-dim mb-1 block">Scenario</label>
              <select value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)} className="form-input" disabled={!selectedFeature}>
                <option value="">Select scenario...</option>
                {scenarios.map((s) => (<option key={s.slug} value={s.slug}>{s.title}</option>))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Feature Reference Panel — shown when feature is selected in feature-level mode */}
      {overrideScope === "feature" && selectedFeature && featurePreview && (
        <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
          <button
            onClick={() => setFeaturePreviewOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-kb-text hover:bg-kb-surface-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>📄</span>
              <span>Standard Feature — reference while writing override</span>
              <span className="text-xs text-kb-text-dim bg-kb-surface-3 px-2 py-0.5 rounded-full">read-only</span>
            </span>
            <span className={`text-kb-text-dim transition-transform duration-200 ${featurePreviewOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {featurePreviewOpen && (
            <div className="border-t border-kb-border px-5 py-4 max-h-[320px] overflow-y-auto">
              <pre className="text-xs text-kb-text-muted font-mono whitespace-pre-wrap leading-relaxed">{featurePreview}</pre>
            </div>
          )}
        </div>
      )}

      {/* Scenario Reference Panel — shown when a scenario is selected */}
      {overrideScope === "scenario" && selectedScenario && scenarioPreview && (
        <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
          <button
            onClick={() => setPreviewOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-kb-text hover:bg-kb-surface-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span>📋</span>
              <span>Standard Scenario — reference while writing override</span>
              <span className="text-xs text-kb-text-dim bg-kb-surface-3 px-2 py-0.5 rounded-full">read-only</span>
            </span>
            <span className={`text-kb-text-dim transition-transform duration-200 ${previewOpen ? "rotate-180" : ""}`}>▼</span>
          </button>
          {previewOpen && (
            <div className="border-t border-kb-border px-5 py-4 max-h-[320px] overflow-y-auto">
              <pre className="text-xs text-kb-text-muted font-mono whitespace-pre-wrap leading-relaxed">{scenarioPreview}</pre>
            </div>
          )}
        </div>
      )}

      {/* Override Content Editor */}
      {readyToEdit && (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-kb-text">
                {existingOverride ? "✏️ Edit Override" : "📝 New Override"}
              </h3>
              <p className="text-xs text-kb-text-dim mt-0.5">
                {overrideScope === "scenario"
                  ? "Describe how this scenario's user flow / steps differ for this tenant."
                  : "Document config differences, custom rules, special workflows for this tenant."}
              </p>
            </div>
            {existingOverride && (
              <span className="text-xs bg-kb-primary/10 text-kb-primary px-2 py-1 rounded-lg border border-kb-primary/20">Existing override</span>
            )}
          </div>

          <AiDraftBox
            entityType="override"
            tenantSlug={selectedTenant}
            moduleSlug={selectedProduct}
            featureSlug={selectedFeature}
            scenarioSlug={overrideScope === "scenario" ? selectedScenario : undefined}
            onDraftGenerated={(data) => {
              if (typeof data === "string") {
                setOverrideContent(data);
              }
            }}
            placeholder="Describe what's different for this tenant... e.g., Approval threshold is ₹50k instead of ₹10k. No cash orders allowed."
          />

          <textarea
            value={overrideContent}
            onChange={(e) => setOverrideContent(e.target.value)}
            className="form-input min-h-[250px] font-mono text-sm mt-4"
            placeholder={overrideScope === "scenario"
              ? `## Custom Steps for This Tenant\n1. Sales Rep opens order\n2. System checks tenant-specific approval threshold (₹50,000)\n3. If exceeded → auto-routes to regional manager\n\n## Differences from Standard Flow\n- Step 3 is skipped for standard tenants\n- Approval SMS sent to manager (tenant-specific integration)`
              : `## Configuration Differences\n- Min order value: ₹1000 (default: ₹500)\n\n## Custom Rules\n- Manager approval required for orders > ₹50,000`}
          />
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={handleSave}
              disabled={saving || !overrideContent.trim()}
              className="px-6 py-2.5 bg-kb-primary text-white rounded-lg text-sm font-semibold hover:bg-kb-primary-dark transition-all disabled:opacity-50 shadow-lg shadow-kb-primary/20"
            >
              {saving ? "Saving..." : existingOverride ? "💾 Update Override" : "💾 Save Override"}
            </button>
            {message && (
              <span className={`text-sm ${message.startsWith("✅") ? "text-kb-success" : "text-kb-danger"}`}>{message}</span>
            )}
          </div>
        </div>
      )}

      {/* Prompt if nothing selected */}
      {!readyToEdit && (
        <div className="bg-kb-surface rounded-xl border border-kb-border p-8 text-center">
          <div className="text-3xl mb-3">{overrideScope === "scenario" ? "🎬" : "🏢"}</div>
          <p className="text-sm text-kb-text-muted">
            {overrideScope === "scenario"
              ? "Select a tenant, product, feature, and scenario above to document a scenario-level override."
              : "Select a tenant and feature above to start documenting overrides."}
          </p>
        </div>
      )}
    </div>
  );
}


// ─── Shared Components ──────────────────────────────────

function FormSection({ title, hint, wordCount: wc, target, aiSuggest, children }: { title: string; hint?: string; wordCount?: number; target?: string; aiSuggest?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-kb-surface rounded-xl border border-kb-border p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-kb-text">{title}</h3>
          {aiSuggest}
        </div>
        {wc !== undefined && target && (
          <span className={`text-xs ${wc >= 50 ? "text-kb-success" : "text-kb-text-dim"}`}>
            {wc}/{target} words
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-kb-text-dim mb-4">💡 {hint}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-kb-text-muted mb-1">
        {label}
        {hint && <span className="text-kb-text-dim ml-1 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SaveButtons({ onSave, saving, message, showReview, saveLabel, onDelete }: { onSave: (status: "draft" | "review") => void; saving: boolean; message: string; showReview: boolean; saveLabel?: string; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-4 pt-4 border-t border-kb-border">
      <button
        onClick={() => onSave("draft")}
        disabled={saving}
        className="px-6 py-2.5 bg-kb-surface-2 text-kb-text rounded-lg text-sm font-medium hover:bg-kb-surface-3 border border-kb-border transition-all disabled:opacity-50"
      >
        {saving ? "Saving..." : (saveLabel || "Save Draft")}
      </button>
      {showReview && (
        <button
          onClick={() => onSave("review")}
          disabled={saving}
          className="px-6 py-2.5 bg-kb-primary text-white rounded-lg text-sm font-medium hover:bg-kb-primary-dark shadow-lg shadow-kb-primary/20 transition-all disabled:opacity-50"
        >
          Submit for Review
        </button>
      )}
      {message && <span className="text-sm text-kb-text-muted">{message}</span>}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={saving}
          className="ml-auto px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-all disabled:opacity-50"
        >
          🗑 Delete
        </button>
      )}
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function ContributePage() {
  return (
    <Suspense fallback={<div className="p-8 text-kb-text-muted">Loading...</div>}>
      <ContributePageContent />
    </Suspense>
  );
}
