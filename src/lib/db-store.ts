import { prisma } from "./db";
import type { Status, DepType } from "@prisma/client";

// ─── Types (matching existing UI expectations) ────────────

export interface ProductInfo {
  id: string;
  name: string;
  slug: string;
  overview: string;
  moduleCount: number;
  featureCount: number;
  scenarioCount: number;
  featureOverrideCount: number;
  scenarioOverrideCount: number;
}

export interface ModuleData {
  id: string;
  name: string;
  slug: string;
  overview: string;
  featureCount: number;
  productSlugs: string[];
}

export interface FeatureData {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  status: Status;
  ownerId: string | null;
  contentMd: string;
  tags: string[];
  completeness: number;
  reviewCycle: string;
  tenantConfigurable: boolean;
  tenantConfigPoints: string[];
  applicableProducts: string[];
  glossaryTerms: { term: string; definition: string; dontSay: string[] }[];
  metadataJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  module?: { id: string; name: string; slug: string };
}

export interface DependencyData {
  id: string;
  fromId: string;
  toId: string;
  type: DepType;
  direction: string;
  what: string;
  when: string;
  impact: string;
  from?: { title: string; slug: string; module: { name: string; slug: string } };
  to?: { title: string; slug: string; module: { name: string; slug: string } };
}

export interface ScenarioData {
  id: string;
  featureId: string;
  slug: string;
  title: string;
  contentMd: string;
  status: Status;
  tags: string[];
  applicableProducts: string[];  // empty = visible in all products; otherwise only in listed product slugs
  createdAt: Date;
  updatedAt: Date;
}

export interface GlossaryData {
  id: string;
  term: string;
  definition: string;
  dontSay: string[];
}

export interface KBStats {
  totalFeatures: number;
  totalScenarios: number;
  totalProducts: number;
  totalModules: number;
  totalTenants: number;
  draftCount: number;
  reviewCount: number;
  approvedCount: number;
  staleCount: number;
  products: ProductInfo[];
}

// ─── Product CRUD ─────────────────────────────────────────

export async function getProducts(): Promise<ProductInfo[]> {
  const products = await prisma.product.findMany({
    include: {
      modules: {
        include: {
          module: {
            include: {
              features: {
                include: {
                  scenarios: { select: { id: true } },
                  overrides: { select: { id: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get scenario override counts per product via raw SQL
  const scenarioOverrideRows = await prisma.$queryRaw<{ productId: string; cnt: bigint }[]>`
    SELECT pm."productId" as "productId", COUNT(so.id)::bigint as cnt
    FROM "ScenarioOverride" so
    JOIN "Scenario" s ON s.id = so."scenarioId"
    JOIN "Feature" f ON f.id = s."featureId"
    JOIN "ProductModule" pm ON pm."moduleId" = f."moduleId"
    GROUP BY pm."productId"
  `;

  const productScenarioOverrideMap = new Map<string, number>();
  for (const row of scenarioOverrideRows) {
    productScenarioOverrideMap.set(row.productId, Number(row.cnt));
  }

  return products.map((p) => {
    const allFeatures = p.modules.flatMap((pm) => pm.module.features);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      overview: p.overview,
      moduleCount: p.modules.length,
      featureCount: allFeatures.length,
      scenarioCount: allFeatures.reduce((sum, f) => sum + f.scenarios.length, 0),
      featureOverrideCount: allFeatures.reduce((sum, f) => sum + f.overrides.length, 0),
      scenarioOverrideCount: productScenarioOverrideMap.get(p.id) || 0,
    };
  });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export async function saveProduct(slug: string, name: string, overview: string, createdBy?: string) {
  return prisma.product.upsert({
    where: { slug },
    create: { slug, name, overview, createdBy },
    update: { name, overview },
  });
}

export async function deleteProduct(slug: string) {
  return prisma.product.delete({ where: { slug } });
}

// ─── Module CRUD ──────────────────────────────────────────

export async function getModules(): Promise<ModuleData[]> {
  const modules = await prisma.module.findMany({
    include: {
      products: { include: { product: { select: { slug: true } } } },
      _count: { select: { features: true } },
    },
    orderBy: { name: "asc" },
  });

  return modules.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    overview: m.overview,
    featureCount: m._count.features,
    productSlugs: m.products.map((pm) => pm.product.slug),
  }));
}

export async function getModulesByProduct(productSlug: string): Promise<ModuleData[]> {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) return [];

  const productModules = await prisma.productModule.findMany({
    where: { productId: product.id },
    include: {
      module: {
        include: {
          products: { include: { product: { select: { slug: true } } } },
          _count: { select: { features: true } },
        },
      },
    },
  });

  return productModules.map((pm) => ({
    id: pm.module.id,
    name: pm.module.name,
    slug: pm.module.slug,
    overview: pm.module.overview,
    featureCount: pm.module._count.features,
    productSlugs: pm.module.products.map((p) => p.product.slug),
  }));
}

export async function getModuleBySlug(slug: string) {
  return prisma.module.findUnique({
    where: { slug },
    include: {
      products: { include: { product: { select: { name: true, slug: true } } } },
      _count: { select: { features: true } },
    },
  });
}

export async function saveModule(
  slug: string,
  name: string,
  overview: string,
  productSlugs: string[]
) {
  const mod = await prisma.module.upsert({
    where: { slug },
    create: { slug, name, overview },
    update: { name, overview },
  });

  // Sync product links
  await prisma.productModule.deleteMany({ where: { moduleId: mod.id } });
  for (const ps of productSlugs) {
    const product = await prisma.product.findUnique({ where: { slug: ps } });
    if (product) {
      await prisma.productModule.create({
        data: { productId: product.id, moduleId: mod.id },
      });
    }
  }

  return mod;
}

export async function deleteModule(slug: string) {
  return prisma.module.delete({ where: { slug } });
}

// ─── Feature CRUD ─────────────────────────────────────────

/** Get features for a specific module */
export async function getFeatures(moduleSlug: string): Promise<FeatureData[]> {
  const mod = await prisma.module.findUnique({ where: { slug: moduleSlug } });
  if (!mod) return [];

  const features = await prisma.feature.findMany({
    where: { moduleId: mod.id },
    include: { module: { select: { id: true, name: true, slug: true } } },
    orderBy: { title: "asc" },
  });

  return features as unknown as FeatureData[];
}

/** Get features visible in a specific product (via modules) */
export async function getFeaturesByProduct(productSlug: string): Promise<FeatureData[]> {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) return [];

  const features = await prisma.feature.findMany({
    where: {
      module: {
        products: { some: { productId: product.id } },
      },
    },
    include: { module: { select: { id: true, name: true, slug: true } } },
    orderBy: { title: "asc" },
  });

  // Filter by applicableProducts
  return features
    .filter((f) => {
      const ap = f.applicableProducts || [];
      return ap.length === 0 || ap.includes(productSlug);
    }) as unknown as FeatureData[];
}

export async function getFeatureBySlug(moduleSlug: string, featureSlug: string) {
  return prisma.feature.findFirst({
    where: {
      slug: featureSlug,
      module: { slug: moduleSlug },
    },
    include: {
      module: { select: { id: true, name: true, slug: true } },
      depsFrom: {
        include: { to: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } } },
      },
      depsTo: {
        include: { from: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } } },
      },
      scenarios: { orderBy: { title: "asc" } },
    },
  });
}

export async function saveFeature(
  moduleSlug: string,
  featureSlug: string,
  data: {
    title: string;
    status?: Status;
    ownerId?: string;
    contentMd: string;
    tags?: string[];
    completeness?: number;
    reviewCycle?: string;
    tenantConfigurable?: boolean;
    tenantConfigPoints?: string[];
    applicableProducts?: string[];
    glossaryTerms?: { term: string; definition: string; dontSay: string[] }[];
    metadataJson?: Record<string, unknown>;
  },
  dependencies?: { toSlug: string; toModuleSlug: string; type: DepType; direction: string; what: string; when: string; impact: string }[]
) {
  const mod = await prisma.module.findUnique({ where: { slug: moduleSlug } });
  if (!mod) throw new Error(`Module ${moduleSlug} not found`);

  const feature = await prisma.feature.upsert({
    where: { moduleId_slug: { moduleId: mod.id, slug: featureSlug } },
    create: {
      moduleId: mod.id,
      slug: featureSlug,
      title: data.title,
      status: data.status || "DRAFT",
      ownerId: data.ownerId || null,
      contentMd: data.contentMd,
      tags: data.tags || [],
      completeness: data.completeness || 0,
      reviewCycle: data.reviewCycle || "quarterly",
      tenantConfigurable: data.tenantConfigurable || false,
      tenantConfigPoints: data.tenantConfigPoints || [],
      applicableProducts: data.applicableProducts || [],
      glossaryTerms: (data.glossaryTerms ?? []) as object,
      metadataJson: (data.metadataJson as object) || {},
    },
    update: {
      title: data.title,
      status: data.status,
      ownerId: data.ownerId || undefined,
      contentMd: data.contentMd,
      tags: data.tags || [],
      completeness: data.completeness || 0,
      reviewCycle: data.reviewCycle,
      tenantConfigurable: data.tenantConfigurable,
      tenantConfigPoints: data.tenantConfigPoints,
      applicableProducts: data.applicableProducts,
      glossaryTerms: (data.glossaryTerms ?? []) as object,
      metadataJson: (data.metadataJson as object) || {},
    },
  });

  // Upsert dependencies
  if (dependencies) {
    await prisma.dependency.deleteMany({ where: { fromId: feature.id } });

    for (const dep of dependencies) {
      const toFeature = await prisma.feature.findFirst({
        where: { slug: dep.toSlug, module: { slug: dep.toModuleSlug } },
      });
      if (toFeature) {
        await prisma.dependency.create({
          data: {
            fromId: feature.id,
            toId: toFeature.id,
            type: dep.type,
            direction: dep.direction,
            what: dep.what,
            when: dep.when,
            impact: dep.impact,
          },
        });
      }
    }
  }

  return feature;
}

export async function deleteFeature(moduleSlug: string, featureSlug: string) {
  const feature = await prisma.feature.findFirst({
    where: { slug: featureSlug, module: { slug: moduleSlug } },
  });
  if (feature) {
    await prisma.feature.delete({ where: { id: feature.id } });
  }
}

// ─── Scenario CRUD ────────────────────────────────────────

export async function getScenarios(
  moduleSlug: string,
  featureSlug: string,
  viewingProductSlug?: string
): Promise<ScenarioData[]> {
  const feature = await prisma.feature.findFirst({
    where: { slug: featureSlug, module: { slug: moduleSlug } },
  });
  if (!feature) return [];

  const scenarios = await prisma.scenario.findMany({
    where: { featureId: feature.id },
    orderBy: { title: "asc" },
  });

  if (!viewingProductSlug) return scenarios as unknown as ScenarioData[];

  // Filter: applicableProducts empty = visible everywhere; otherwise must include viewingProductSlug
  return scenarios.filter((s) => {
    const ap = (s.applicableProducts as string[]) || [];
    return ap.length === 0 || ap.includes(viewingProductSlug);
  }) as unknown as ScenarioData[];
}

export async function saveScenario(
  moduleSlug: string,
  featureSlug: string,
  scenarioSlug: string,
  data: { title: string; contentMd: string; status?: Status; ownerId?: string; tags?: string[]; applicableProducts?: string[] }
) {
  const feature = await prisma.feature.findFirst({
    where: { slug: featureSlug, module: { slug: moduleSlug } },
  });
  if (!feature) throw new Error(`Feature ${featureSlug} not found in module ${moduleSlug}`);

  return prisma.scenario.upsert({
    where: { featureId_slug: { featureId: feature.id, slug: scenarioSlug } },
    create: {
      featureId: feature.id,
      slug: scenarioSlug,
      title: data.title,
      contentMd: data.contentMd,
      status: data.status || "DRAFT",
      ownerId: data.ownerId || null,
      tags: data.tags || [],
      applicableProducts: data.applicableProducts || [],
    },
    update: {
      title: data.title,
      contentMd: data.contentMd,
      status: data.status,
      tags: data.tags,
      applicableProducts: data.applicableProducts ?? [],
    },
  });
}

// ─── Tenant CRUD ──────────────────────────────────────────

export async function getTenants() {
  return prisma.tenant.findMany({ orderBy: { name: "asc" } });
}

export async function saveTenant(slug: string, name: string, overview: string) {
  return prisma.tenant.upsert({
    where: { slug },
    create: { slug, name, overview },
    update: { name, overview },
  });
}

// ─── Tenant Override CRUD ─────────────────────────────────

export async function getTenantOverrides(tenantSlug: string) {
  return prisma.tenantOverride.findMany({
    where: { tenant: { slug: tenantSlug } },
    include: {
      feature: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } },
    },
  });
}

export async function saveTenantOverride(
  tenantSlug: string,
  featureSlug: string,
  moduleSlug: string,
  data: { contentMd: string; ownerId?: string }
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} not found`);

  const feature = await prisma.feature.findFirst({
    where: { slug: featureSlug, module: { slug: moduleSlug } },
  });
  if (!feature) throw new Error(`Feature ${featureSlug} not found`);

  return prisma.tenantOverride.upsert({
    where: { tenantId_featureId: { tenantId: tenant.id, featureId: feature.id } },
    create: {
      tenantId: tenant.id,
      featureId: feature.id,
      contentMd: data.contentMd,
      ownerId: data.ownerId || null,
    },
    update: {
      contentMd: data.contentMd,
      ownerId: data.ownerId || null,
    },
  });
}

export async function getFeatureOverrides(featureId: string) {
  const overrides = await prisma.tenantOverride.findMany({
    where: { featureId },
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return overrides.map((o) => ({
    id: o.id,
    tenantSlug: o.tenant.slug,
    tenantName: o.tenant.name,
    contentMd: o.contentMd,
    updatedAt: o.updatedAt,
  }));
}

// ─── Glossary CRUD ────────────────────────────────────────

export async function getGlossary(): Promise<GlossaryData[]> {
  return prisma.glossaryEntry.findMany({ orderBy: { term: "asc" } });
}

export async function saveGlossaryEntry(term: string, definition: string, dontSay: string[]) {
  return prisma.glossaryEntry.upsert({
    where: { term },
    create: { term, definition, dontSay },
    update: { definition, dontSay },
  });
}

export async function deleteGlossaryEntry(term: string) {
  return prisma.glossaryEntry.delete({ where: { term } });
}

export async function saveGlossaryBulk(entries: { term: string; definition: string; dontSay: string[] }[]) {
  await prisma.glossaryEntry.deleteMany();
  if (entries.length > 0) {
    await prisma.glossaryEntry.createMany({ data: entries });
  }
}

// ─── Dependencies ─────────────────────────────────────────

export async function getDependencies(productSlug: string): Promise<DependencyData[]> {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product) return [];

  const deps = await prisma.dependency.findMany({
    where: {
      from: {
        module: {
          products: { some: { productId: product.id } },
        },
      },
    },
    include: {
      from: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } },
      to: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } },
    },
  });
  return deps as unknown as DependencyData[];
}

// ─── Stats ────────────────────────────────────────────────

export async function getKBStats(): Promise<KBStats> {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const [products, totalFeatures, totalScenarios, totalModules, totalTenants, draftCount, reviewCount, approvedCount, staleCount] =
    await Promise.all([
      getProducts(),
      prisma.feature.count(),
      prisma.scenario.count(),
      prisma.module.count(),
      prisma.tenant.count(),
      prisma.feature.count({ where: { status: "DRAFT" } }),
      prisma.feature.count({ where: { status: "REVIEW" } }),
      prisma.feature.count({ where: { status: "APPROVED" } }),
      prisma.feature.count({ where: { updatedAt: { lt: threeMonthsAgo } } }),
    ]);

  return {
    totalFeatures,
    totalScenarios,
    totalProducts: products.length,
    totalModules,
    totalTenants,
    draftCount,
    reviewCount,
    approvedCount,
    staleCount,
    products,
  };
}

// ─── All Features (flat list for search / deps UI) ────────

export async function getAllFeatures() {
  const features = await prisma.feature.findMany({
    include: { module: { select: { name: true, slug: true } } },
    orderBy: { title: "asc" },
  });

  return features.map((f) => ({
    id: f.id,
    feature: f.title,
    slug: f.slug,
    module: f.module.name,
    moduleSlug: f.module.slug,
    applicableProducts: f.applicableProducts || [],
  }));
}

// ─── Scenario Overrides ───────────────────────────────────────

export async function saveScenarioOverride({
  tenantSlug,
  moduleSlug,
  featureSlug,
  scenarioSlug,
  contentMd,
}: {
  tenantSlug: string;
  moduleSlug: string;
  featureSlug: string;
  scenarioSlug: string;
  contentMd: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} not found`);

  const mod = await prisma.module.findUnique({ where: { slug: moduleSlug } });
  if (!mod) throw new Error(`Module ${moduleSlug} not found`);

  const feature = await prisma.feature.findFirst({ where: { slug: featureSlug, moduleId: mod.id } });
  if (!feature) throw new Error(`Feature ${featureSlug} not found`);

  const scenario = await prisma.scenario.findFirst({ where: { slug: scenarioSlug, featureId: feature.id } });
  if (!scenario) throw new Error(`Scenario ${scenarioSlug} not found`);

  return prisma.scenarioOverride.upsert({
    where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId: scenario.id } },
    create: { tenantId: tenant.id, scenarioId: scenario.id, contentMd, updatedAt: new Date() },
    update: { contentMd, updatedAt: new Date() },
  });
}

export async function getScenarioOverrides(scenarioId: string) {
  const overrides = await prisma.scenarioOverride.findMany({
    where: { scenarioId },
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return overrides.map((o) => ({
    id: o.id,
    tenantSlug: o.tenant.slug,
    tenantName: o.tenant.name,
    contentMd: o.contentMd,
    updatedAt: o.updatedAt,
  }));
}

// ─── Delete: Tenant + Overrides ───────────────────────────────

export async function deleteTenant(slug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant ${slug} not found`);

  // Cascade: delete all overrides, then the tenant
  await prisma.scenarioOverride.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenantOverride.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
}

export async function deleteTenantOverride(tenantSlug: string, featureSlug: string, moduleSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} not found`);

  const feature = await prisma.feature.findFirst({ where: { slug: featureSlug, module: { slug: moduleSlug } } });
  if (!feature) throw new Error(`Feature ${featureSlug} not found`);

  await prisma.tenantOverride.delete({
    where: { tenantId_featureId: { tenantId: tenant.id, featureId: feature.id } },
  });
}

export async function deleteScenarioOverride(tenantSlug: string, scenarioSlug: string, featureSlug: string, moduleSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant ${tenantSlug} not found`);

  const scenario = await prisma.scenario.findFirst({
    where: { slug: scenarioSlug, feature: { slug: featureSlug, module: { slug: moduleSlug } } },
  });
  if (!scenario) throw new Error(`Scenario ${scenarioSlug} not found`);

  await prisma.scenarioOverride.delete({
    where: { tenantId_scenarioId: { tenantId: tenant.id, scenarioId: scenario.id } },
  });
}

// ─── Registry: All Scenarios (flat) ───────────────────────────

export async function getAllScenarios() {
  const scenarios = await prisma.scenario.findMany({
    include: {
      feature: {
        select: { title: true, slug: true, module: { select: { name: true, slug: true } } },
      },
    },
    orderBy: { title: "asc" },
  });
  return scenarios.map((s) => ({
    id: s.id,
    title: s.title,
    slug: s.slug,
    status: s.status,
    tags: s.tags,
    featureTitle: s.feature.title,
    featureSlug: s.feature.slug,
    moduleName: s.feature.module.name,
    moduleSlug: s.feature.module.slug,
    updatedAt: s.updatedAt,
  }));
}

// ─── Registry: All Overrides (flat) ───────────────────────────

export async function getAllOverrides() {
  const [featureOverrides, scenarioOverrides] = await Promise.all([
    prisma.tenantOverride.findMany({
      include: {
        tenant: { select: { name: true, slug: true } },
        feature: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.scenarioOverride.findMany({
      include: {
        tenant: { select: { name: true, slug: true } },
        scenario: {
          select: {
            title: true, slug: true,
            feature: { select: { title: true, slug: true, module: { select: { name: true, slug: true } } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    featureOverrides: featureOverrides.map((o) => ({
      id: o.id,
      type: "feature" as const,
      tenantName: o.tenant.name,
      tenantSlug: o.tenant.slug,
      featureTitle: o.feature.title,
      featureSlug: o.feature.slug,
      moduleName: o.feature.module.name,
      moduleSlug: o.feature.module.slug,
      contentMd: o.contentMd,
      updatedAt: o.updatedAt,
    })),
    scenarioOverrides: scenarioOverrides.map((o) => ({
      id: o.id,
      type: "scenario" as const,
      tenantName: o.tenant.name,
      tenantSlug: o.tenant.slug,
      scenarioTitle: o.scenario.title,
      scenarioSlug: o.scenario.slug,
      featureTitle: o.scenario.feature.title,
      featureSlug: o.scenario.feature.slug,
      moduleName: o.scenario.feature.module.name,
      moduleSlug: o.scenario.feature.module.slug,
      contentMd: o.contentMd,
      updatedAt: o.updatedAt,
    })),
  };
}

