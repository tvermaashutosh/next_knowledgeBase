import { NextRequest, NextResponse } from "next/server";
import * as dbStore from "@/lib/db-store";
import { prisma } from "@/lib/db";
import { embedScenario } from "@/lib/embed-pipeline";
import type { LLMConfig } from "@/lib/llm-adapter";
import { getUser } from "@/lib/supabase-server";
import { getUserByEmail, findOrCreateUser, canContribute, isAdmin } from "@/lib/rbac";

// ─── GET: Read Operations ─────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "stats": {
        const stats = await dbStore.getKBStats();
        return NextResponse.json(stats);
      }

      case "products": {
        const products = await dbStore.getProducts();
        return NextResponse.json(products);
      }

      case "modules": {
        const modules = await dbStore.getModules();
        return NextResponse.json(modules);
      }

      case "product-modules": {
        const productSlug = searchParams.get("product");
        if (!productSlug) return NextResponse.json({ error: "Missing product" }, { status: 400 });
        const modules = await dbStore.getModulesByProduct(productSlug);
        return NextResponse.json(modules);
      }

      case "features": {
        const moduleSlug = searchParams.get("module");
        if (!moduleSlug) return NextResponse.json({ error: "Missing module" }, { status: 400 });
        const features = await dbStore.getFeatures(moduleSlug);
        return NextResponse.json(features);
      }

      case "features-by-product": {
        const productSlug = searchParams.get("product");
        if (!productSlug) return NextResponse.json({ error: "Missing product" }, { status: 400 });
        const features = await dbStore.getFeaturesByProduct(productSlug);
        return NextResponse.json(features);
      }

      case "feature": {
        const mSlug = searchParams.get("module");
        const fSlug = searchParams.get("feature");
        if (!mSlug || !fSlug) return NextResponse.json({ error: "Missing module or feature" }, { status: 400 });
        const feature = await dbStore.getFeatureBySlug(mSlug, fSlug);
        if (!feature) return NextResponse.json({ error: "Feature not found" }, { status: 404 });
        return NextResponse.json(feature);
      }

      case "scenarios": {
        const mSlug = searchParams.get("module");
        const fSlug = searchParams.get("feature");
        const viewProduct = searchParams.get("viewProduct") || undefined;
        if (!mSlug || !fSlug) return NextResponse.json({ error: "Missing module or feature" }, { status: 400 });
        const scenarios = await dbStore.getScenarios(mSlug, fSlug, viewProduct);
        return NextResponse.json(scenarios);
      }

      case "tenants": {
        const tenants = await dbStore.getTenants();
        return NextResponse.json(tenants);
      }

      case "tenant-overrides": {
        const tenantSlug = searchParams.get("tenant");
        if (!tenantSlug) return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
        const overrides = await dbStore.getTenantOverrides(tenantSlug);
        return NextResponse.json(overrides);
      }

      case "feature-overrides": {
        const featureId = searchParams.get("featureId");
        if (!featureId) return NextResponse.json({ error: "Missing featureId" }, { status: 400 });
        const featureOverrides = await dbStore.getFeatureOverrides(featureId);
        return NextResponse.json(featureOverrides);
      }

      case "scenario-overrides": {
        const scenarioId = searchParams.get("scenarioId");
        if (!scenarioId) return NextResponse.json({ error: "Missing scenarioId" }, { status: 400 });
        const scenarioOverrides = await dbStore.getScenarioOverrides(scenarioId);
        return NextResponse.json(scenarioOverrides);
      }

      case "glossary": {
        const glossary = await dbStore.getGlossary();
        return NextResponse.json(glossary);
      }

      case "all-features": {
        const allFeatures = await dbStore.getAllFeatures();
        return NextResponse.json(allFeatures);
      }

      case "all-scenarios": {
        const allScenarios = await dbStore.getAllScenarios();
        return NextResponse.json(allScenarios);
      }

      case "all-overrides": {
        const allOverrides = await dbStore.getAllOverrides();
        return NextResponse.json(allOverrides);
      }

      case "all-modules": {
        const allModules = await dbStore.getModules();
        return NextResponse.json(allModules);
      }

      case "dependencies": {
        const dProductSlug = searchParams.get("product");
        if (!dProductSlug) return NextResponse.json({ error: "Missing product" }, { status: 400 });
        const deps = await dbStore.getDependencies(dProductSlug);
        return NextResponse.json(deps);
      }

      case "user-profile": {
        const supaUser = await getUser();
        if (!supaUser?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        let appUser = await getUserByEmail(supaUser.email);
        if (!appUser) appUser = await findOrCreateUser(supaUser);
        return NextResponse.json(appUser);
      }

      case "dashboard-analytics": {
        const [stats, pendingReviews, recentActivity, users] = await Promise.all([
          dbStore.getKBStats(),
          prisma.review.count({ where: { status: "pending" } }),
          prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
          prisma.user.count(),
        ]);
        return NextResponse.json({
          ...stats,
          pendingReviews,
          totalUsers: users,
          recentActivity,
        });
      }

      case "review-queue": {
        const reviewFeatures = await prisma.feature.findMany({
          where: { status: "REVIEW" },
          include: { module: { select: { name: true, slug: true } } },
          orderBy: { updatedAt: "desc" },
        });
        return NextResponse.json(reviewFeatures);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("KB GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Write Operations ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const action = body.action || url.searchParams.get("action");
    console.log("[KB POST] action:", action, "body keys:", Object.keys(body));

    switch (action) {
      case "save-product": {
        const { slug, name, overview } = body;
        if (!slug || !name) return NextResponse.json({ error: "Missing slug or name" }, { status: 400 });
        const product = await dbStore.saveProduct(slug, name, overview || "");
        return NextResponse.json({ success: true, product });
      }

      case "save-module": {
        const { slug, name, overview, productSlugs } = body;
        if (!slug || !name) return NextResponse.json({ error: "Missing slug or name" }, { status: 400 });
        const mod = await dbStore.saveModule(slug, name, overview || "", productSlugs || []);
        return NextResponse.json({ success: true, module: mod });
      }

      case "delete-module": {
        const { slug } = body;
        if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
        await dbStore.deleteModule(slug);
        return NextResponse.json({ success: true });
      }

      case "save-feature": {
        const { moduleSlug, featureSlug, title, status, contentMd, tags, completeness, reviewCycle, tenantConfigurable, tenantConfigPoints, applicableProducts, glossaryTerms, metadataJson, dependencies,
          // Support old format (frontmatter + sections)
          frontmatter, sections,
          // Legacy support: accept productSlug and map to moduleSlug
          productSlug: legacyProductSlug } = body;
        
        // Primary module slug from request; also derive one from frontmatter.module as fallback
        // (some callers pass a product slug as moduleSlug — frontmatter.module is more reliable)
        const frontmatterModuleSlug = frontmatter?.module
          ? frontmatter.module.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
          : undefined;
        const effectiveModuleSlug = moduleSlug || legacyProductSlug;

        // Determine the real module slug: try effectiveModuleSlug first; if it doesn't resolve to
        // a module in the DB, fall back to frontmatterModuleSlug.
        let resolvedModuleSlug = effectiveModuleSlug;
        if (frontmatterModuleSlug && frontmatterModuleSlug !== effectiveModuleSlug) {
          const moduleCheck = await prisma.module.findUnique({ where: { slug: effectiveModuleSlug } });
          if (!moduleCheck) {
            resolvedModuleSlug = frontmatterModuleSlug;
          }
        }

        // Derive flat fields from frontmatter/sections if sent that way
        const finalTitle = title || frontmatter?.feature;
        const finalSlug = featureSlug || (frontmatter?.feature ? frontmatter.feature.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined);
        
        if (!resolvedModuleSlug || !finalSlug || !finalTitle) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Build contentMd from sections if provided
        let finalContent = contentMd || "";
        if (sections && typeof sections === "object" && !contentMd) {
          finalContent = Object.entries(sections).map(([heading, text]) => `## ${heading}\n${text}`).join("\n\n");
        }

        // Map form dependency format → saveFeature format
        type DepInput = { featureSlug?: string; moduleSlug?: string; productSlug?: string; toSlug?: string; toModuleSlug?: string; toProductSlug?: string; type: string; direction: string; what: string; when: string; impact: string };
        const mappedDeps = (dependencies as DepInput[] | undefined)?.map((d) => ({
          toSlug: d.toSlug || d.featureSlug || "",
          toModuleSlug: (d.toModuleSlug || d.moduleSlug || d.toProductSlug || d.productSlug || resolvedModuleSlug) as string,
          // Normalize UI lowercase values (e.g. "data-input") → Prisma enum (e.g. "DATA_INPUT")
          type: d.type.toUpperCase().replace(/-/g, "_") as import("@prisma/client").DepType,
          direction: d.direction,
          what: d.what,
          when: d.when,
          impact: d.impact,
        })).filter((d) => d.toSlug);

        const feature = await dbStore.saveFeature(
          resolvedModuleSlug,
          finalSlug,
          { title: finalTitle, status: status || frontmatter?.status, contentMd: finalContent, tags: tags || frontmatter?.tags, completeness, reviewCycle, tenantConfigurable: tenantConfigurable ?? frontmatter?.tenant_configurable, tenantConfigPoints: tenantConfigPoints || frontmatter?.tenant_config_points, applicableProducts, glossaryTerms, metadataJson },
          mappedDeps
        );

        // Auto-embed in background (don't block the save response)
        if (finalContent) {
          const llmRow = await prisma.llmConfig.findFirst();
          if (llmRow) {
            const { embedFeature } = await import("@/lib/embed-pipeline");
            embedFeature(
              feature.id,
              finalContent,
              { productSlug: resolvedModuleSlug, moduleSlug: resolvedModuleSlug, featureSlug: finalSlug, featureTitle: finalTitle },
              {
                generationProvider: llmRow.generationProvider as LLMConfig["generationProvider"],
                generationModel: llmRow.generationModel,
                generationApiKey: llmRow.generationApiKey,
                embeddingProvider: llmRow.embeddingProvider as LLMConfig["embeddingProvider"],
                embeddingModel: llmRow.embeddingModel,
                embeddingApiKey: llmRow.embeddingApiKey,
              }
            ).then((n) => console.log(`✅ Embedded ${n} chunks for ${finalTitle}`))
             .catch((e) => console.error(`❌ Embed failed for ${finalTitle}:`, e));
          }
        }

        return NextResponse.json({ success: true, feature });
      }

      case "save-scenario": {
        const { moduleSlug: mSlug, featureSlug: fSlug, scenarioSlug, title: sTitle, contentMd: sContent, status: sStatus, tags: sTags, applicableProducts: sApplicableProducts,
          // Legacy support
          productSlug: legacyPSlug } = body;
        const effectiveMSlug = mSlug || legacyPSlug;
        if (!effectiveMSlug || !fSlug || !scenarioSlug || !sTitle) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        const scenario = await dbStore.saveScenario(effectiveMSlug, fSlug, scenarioSlug, {
          title: sTitle, contentMd: sContent || "", status: sStatus, tags: sTags, applicableProducts: sApplicableProducts,
        });

        // Async embed scenario content (non-blocking)
        if (sContent?.trim()) {
          const llmCfg = await prisma.llmConfig.findFirst();
          if (llmCfg) {
            const feature = await prisma.feature.findFirst({
              where: { slug: fSlug, module: { slug: effectiveMSlug } },
              include: { module: { select: { slug: true } } },
            });
            if (feature) {
              embedScenario(
                feature.id,
                scenarioSlug,
                sTitle,
                sContent,
                { productSlug: effectiveMSlug, moduleSlug: effectiveMSlug, featureSlug: fSlug, featureTitle: feature.title },
                {
                  generationProvider: llmCfg.generationProvider as LLMConfig["generationProvider"],
                  generationModel: llmCfg.generationModel,
                  generationApiKey: llmCfg.generationApiKey,
                  embeddingProvider: llmCfg.embeddingProvider as LLMConfig["embeddingProvider"],
                  embeddingModel: llmCfg.embeddingModel,
                  embeddingApiKey: llmCfg.embeddingApiKey,
                }
              ).then((n) => console.log(`✅ Embedded ${n} scenario chunks for ${sTitle}`))
               .catch((e) => console.error(`❌ Scenario embed failed for ${sTitle}:`, e));
            }
          }
        }

        return NextResponse.json({ success: true, scenario });
      }

      case "save-tenant": {
        const { slug, name, overview } = body;
        if (!slug || !name) return NextResponse.json({ error: "Missing slug or name" }, { status: 400 });
        const tenant = await dbStore.saveTenant(slug, name, overview || "");
        return NextResponse.json({ success: true, tenant });
      }

      case "save-tenant-override": {
        const { tenantSlug, featureSlug, moduleSlug, productSlug: legacyPS, contentMd } = body;
        const effectiveMS = moduleSlug || legacyPS;
        if (!tenantSlug || !featureSlug || !effectiveMS) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        const override = await dbStore.saveTenantOverride(tenantSlug, featureSlug, effectiveMS, { contentMd: contentMd || "" });
        return NextResponse.json({ success: true, override });
      }

      case "save-scenario-override": {
        const { tenantSlug, moduleSlug, featureSlug, scenarioSlug, contentMd, productSlug: legacyPS2 } = body;
        const effectiveMS2 = moduleSlug || legacyPS2;
        if (!tenantSlug || !effectiveMS2 || !featureSlug || !scenarioSlug) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        const scenarioOverride = await dbStore.saveScenarioOverride({ tenantSlug, moduleSlug: effectiveMS2, featureSlug, scenarioSlug, contentMd: contentMd || "" });
        return NextResponse.json({ success: true, override: scenarioOverride });
      }

      case "save-glossary": {
        const { entries } = body;
        if (!entries || !Array.isArray(entries)) {
          return NextResponse.json({ error: "Missing entries array" }, { status: 400 });
        }
        await dbStore.saveGlossaryBulk(entries);
        return NextResponse.json({ success: true });
      }

      case "save-glossary-entry": {
        const { term, definition, dontSay } = body;
        if (!term) return NextResponse.json({ error: "Missing term" }, { status: 400 });
        const entry = await dbStore.saveGlossaryEntry(term, definition || "", dontSay || []);
        return NextResponse.json({ success: true, entry });
      }

      case "delete-glossary-entry": {
        const { term } = body;
        if (!term) return NextResponse.json({ error: "Missing term" }, { status: 400 });
        await dbStore.deleteGlossaryEntry(term);
        return NextResponse.json({ success: true });
      }

      case "re-embed-all": {
        const llmRow = await prisma.llmConfig.findFirst();
        if (!llmRow) return NextResponse.json({ error: "LLM not configured" }, { status: 400 });
        const { embedFeature } = await import("@/lib/embed-pipeline");
        const allFeatures = await prisma.feature.findMany({
          include: { module: { select: { slug: true } } },
        });
        let totalChunks = 0;
        const errors: string[] = [];
        for (const f of allFeatures) {
          try {
            const n = await embedFeature(
              f.id,
              f.contentMd,
              { productSlug: f.module.slug, moduleSlug: f.module.slug, featureSlug: f.slug, featureTitle: f.title },
              {
                generationProvider: llmRow.generationProvider as LLMConfig["generationProvider"],
                generationModel: llmRow.generationModel,
                generationApiKey: llmRow.generationApiKey,
                embeddingProvider: llmRow.embeddingProvider as LLMConfig["embeddingProvider"],
                embeddingModel: llmRow.embeddingModel,
                embeddingApiKey: llmRow.embeddingApiKey,
              }
            );
            totalChunks += n;
            console.log(`✅ Embedded ${n} chunks for ${f.title}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${f.title}: ${msg}`);
            console.error(`❌ Embed failed for ${f.title}:`, e);
          }
        }
        return NextResponse.json({ success: true, features: allFeatures.length, totalChunks, errors });
      }

      case "update-feature-status": {
        const { moduleSlug: mSlug3, featureSlug: fSlug3, status: newStatus, productSlug: legacyPS3 } = body;
        const effectiveMS3 = mSlug3 || legacyPS3;
        if (!effectiveMS3 || !fSlug3 || !newStatus) {
          return NextResponse.json({ error: "Missing moduleSlug, featureSlug, or status" }, { status: 400 });
        }
        const feat = await prisma.feature.findFirst({
          where: { slug: fSlug3, module: { slug: effectiveMS3 } },
        });
        if (!feat) return NextResponse.json({ error: "Feature not found" }, { status: 404 });
        const updated = await prisma.feature.update({
          where: { id: feat.id },
          data: { status: newStatus },
        });
        return NextResponse.json({ success: true, feature: updated });
      }

      // ─── Delete Operations ───────────────────────────────

      case "delete-product": {
        const { slug: delProdSlug } = body;
        if (!delProdSlug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
        const prod = await prisma.product.findUnique({ where: { slug: delProdSlug } });
        if (!prod) return NextResponse.json({ error: "Product not found" }, { status: 404 });
        // Delete ProductModule links, then the product
        await prisma.productModule.deleteMany({ where: { productId: prod.id } });
        await prisma.product.delete({ where: { id: prod.id } });
        return NextResponse.json({ success: true });
      }

      case "delete-module": {
        const { slug: delModSlug } = body;
        if (!delModSlug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
        const mod = await prisma.module.findUnique({ where: { slug: delModSlug } });
        if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 });
        // Check if module has features
        const featureCount = await prisma.feature.count({ where: { moduleId: mod.id } });
        if (featureCount > 0) {
          return NextResponse.json({ error: `Cannot delete module with ${featureCount} feature(s). Remove features first.` }, { status: 400 });
        }
        await prisma.productModule.deleteMany({ where: { moduleId: mod.id } });
        await prisma.module.delete({ where: { id: mod.id } });
        return NextResponse.json({ success: true });
      }

      case "delete-feature": {
        const { moduleSlug: delFeatMod, featureSlug: delFeatSlug } = body;
        if (!delFeatMod || !delFeatSlug) return NextResponse.json({ error: "Missing moduleSlug or featureSlug" }, { status: 400 });
        const feat2 = await prisma.feature.findFirst({ where: { slug: delFeatSlug, module: { slug: delFeatMod } } });
        if (!feat2) return NextResponse.json({ error: "Feature not found" }, { status: 404 });
        // Cascade: scenarios, embeddings, dependencies, overrides, reviews all cascade via schema
        await prisma.feature.delete({ where: { id: feat2.id } });
        return NextResponse.json({ success: true });
      }

      case "delete-scenario": {
        const { moduleSlug: delScMod, featureSlug: delScFeat, scenarioSlug: delScSlug } = body;
        if (!delScMod || !delScFeat || !delScSlug) return NextResponse.json({ error: "Missing moduleSlug, featureSlug, or scenarioSlug" }, { status: 400 });
        const sc = await prisma.scenario.findFirst({
          where: { slug: delScSlug, feature: { slug: delScFeat, module: { slug: delScMod } } },
        });
        if (!sc) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
        await prisma.scenario.delete({ where: { id: sc.id } });
        return NextResponse.json({ success: true });
      }

      case "delete-tenant": {
        const { slug: delTenantSlug } = body;
        if (!delTenantSlug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
        await dbStore.deleteTenant(delTenantSlug);
        return NextResponse.json({ success: true });
      }

      case "delete-tenant-override": {
        const { tenantSlug: delTOTenant, featureSlug: delTOFeature, moduleSlug: delTOModule } = body;
        if (!delTOTenant || !delTOFeature || !delTOModule) {
          return NextResponse.json({ error: "Missing tenantSlug, featureSlug, or moduleSlug" }, { status: 400 });
        }
        await dbStore.deleteTenantOverride(delTOTenant, delTOFeature, delTOModule);
        return NextResponse.json({ success: true });
      }

      case "delete-scenario-override": {
        const { tenantSlug: delSOTenant, scenarioSlug: delSOScenario, featureSlug: delSOFeature, moduleSlug: delSOModule } = body;
        if (!delSOTenant || !delSOScenario || !delSOFeature || !delSOModule) {
          return NextResponse.json({ error: "Missing tenantSlug, scenarioSlug, featureSlug, or moduleSlug" }, { status: 400 });
        }
        await dbStore.deleteScenarioOverride(delSOTenant, delSOScenario, delSOFeature, delSOModule);
        return NextResponse.json({ success: true });
      }

      case "re-embed-all": {
        // Bulk re-embed all features and scenarios
        const llmRow = await prisma.llmConfig.findFirst();
        if (!llmRow) {
          return NextResponse.json({ error: "LLM not configured. Go to Admin → LLM Config." }, { status: 400 });
        }
        const llmCfg = {
          generationProvider: llmRow.generationProvider as LLMConfig["generationProvider"],
          generationModel: llmRow.generationModel,
          generationApiKey: llmRow.generationApiKey,
          embeddingProvider: llmRow.embeddingProvider as LLMConfig["embeddingProvider"],
          embeddingModel: llmRow.embeddingModel,
          embeddingApiKey: llmRow.embeddingApiKey,
        };
        const { embedFeature } = await import("@/lib/embed-pipeline");

        // Get all features with content
        const allFeats = await prisma.feature.findMany({
          where: { contentMd: { not: "" } },
          include: { module: true },
        });

        let embedded = 0;
        let failed = 0;
        for (const f of allFeats) {
          try {
            const n = await embedFeature(
              f.id,
              f.contentMd || "",
              { productSlug: f.module.slug, moduleSlug: f.module.slug, featureSlug: f.slug, featureTitle: f.title },
              llmCfg
            );
            embedded += n;
            console.log(`✅ Re-embedded ${n} chunks for ${f.title}`);
          } catch (e) {
            failed++;
            console.error(`❌ Re-embed failed for ${f.title}:`, e);
          }
        }

        // Also re-embed scenarios — fetch without nested includes to avoid adapter issues
        const allScenarios = await prisma.scenario.findMany({});
        console.log(`[re-embed-all] Found ${allScenarios.length} scenarios`);

        let scenarioEmbedded = 0;
        for (const s of allScenarios) {
          if (!s.contentMd || !s.contentMd.trim()) continue;
          try {
            const feat = await prisma.feature.findUnique({
              where: { id: s.featureId },
              include: { module: true },
            });
            if (!feat) { failed++; continue; }
            const n = await embedScenario(
              feat.id,
              s.slug,
              s.title,
              s.contentMd,
              { productSlug: feat.module.slug, moduleSlug: feat.module.slug, featureSlug: feat.slug, featureTitle: feat.title },
              llmCfg
            );
            scenarioEmbedded += n;
            console.log(`✅ Re-embedded ${n} chunks for scenario ${s.title}`);
          } catch (e) {
            failed++;
            console.error(`❌ Re-embed scenario failed for ${s.title}:`, e);
          }
        }

        return NextResponse.json({
          success: true,
          features: allFeats.length,
          scenarios: allScenarios.length,
          chunksEmbedded: embedded + scenarioEmbedded,
          failed,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("KB POST error:", msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
