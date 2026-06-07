/**
 * Seed runner — reads all JSON files from scripts/seed-data/ and seeds them.
 * Usage: node scripts/seed-promotions-kb.js  (or: npm run db:seed)
 *
 * For a clean slate first: npx prisma db push --force-reset
 */
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.KB_URL || "http://localhost:3000";
const DATA_DIR = path.join(__dirname, "seed-data");

const PRODUCT = {
  slug: "promotions",
  name: "Promotions",
  overview: "The Promotions Service powers trade promotions across the distribution ecosystem. It enables configuring, targeting, calculating, and tracking promotional offers — from flat discounts to free goods — applied automatically during order processing across DMS, Retailer App, and Sales Rep App."
};

const SEED_API_KEY = process.env.SEED_API_KEY || "seed-local-dev-key-2024";

// Must match the route's slug derivation so module/feature slugs line up.
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function post(action, body) {
  const res = await fetch(`${BASE_URL}/api/kb?action=${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SEED_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${action} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function seed() {
  console.log("🚀 Starting Promotions KB seed...\n");

  // 1. Create product
  console.log(`📦 Creating product: ${PRODUCT.name}`);
  await post("save-product", PRODUCT);
  console.log("   ✅ Product created\n");

  // 2. Read all feature files
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith(".json"))
    .sort();

  // 3. Create modules first — a Feature requires an existing Module (Product↔Module
  //    is many-to-many), so collect the distinct module names and create each,
  //    mapping it to this product.
  const moduleNames = [...new Set(
    files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")).feature.module)
  )];
  console.log(`🧩 Creating ${moduleNames.length} modules...`);
  for (const name of moduleNames) {
    await post("save-module", {
      slug: slugify(name),
      name,
      overview: "",
      productSlugs: [PRODUCT.slug],
    });
    console.log(`   ✅ Module: ${name} (${slugify(name)})`);
  }
  console.log("");

  let featSuccess = 0, featFailed = 0, scenSuccess = 0, scenFailed = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
    const { feature, scenarios } = data;

    // Seed feature
    try {
      console.log(`📋 [${feature.module}] ${feature.title}`);
      await post("save-feature", {
        moduleSlug: slugify(feature.module),
        productSlug: PRODUCT.slug,
        featureSlug: feature.featureSlug,
        title: feature.title,
        module: feature.module,
        status: "REVIEW",
        contentMd: feature.contentMd,
        tags: feature.tags || [],
        tenantConfigurable: feature.tenantConfigurable || false,
        tenantConfigPoints: feature.tenantConfigPoints || [],
        completeness: 80,
        reviewCycle: "quarterly",
      });
      console.log(`   ✅ Feature saved`);
      featSuccess++;
    } catch (err) {
      console.error(`   ❌ Feature failed: ${err.message}`);
      featFailed++;
      continue; // skip scenarios if feature failed
    }

    // Seed scenarios
    if (scenarios && scenarios.length > 0) {
      for (const sc of scenarios) {
        try {
          await post("save-scenario", {
            moduleSlug: slugify(feature.module),
            productSlug: PRODUCT.slug,
            featureSlug: feature.featureSlug,
            scenarioSlug: sc.scenarioSlug,
            title: sc.title,
            contentMd: sc.contentMd,
            status: "REVIEW",
            tags: sc.tags || [],
          });
          console.log(`   📎 Scenario: ${sc.title} ✅`);
          scenSuccess++;
        } catch (err) {
          console.error(`   📎 Scenario: ${sc.title} ❌ ${err.message}`);
          scenFailed++;
        }
      }
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅ Features: ${featSuccess}/${files.length}`);
  console.log(`✅ Scenarios: ${scenSuccess}/${scenSuccess + scenFailed}`);
  if (featFailed > 0) console.log(`❌ Feature failures: ${featFailed}`);
  if (scenFailed > 0) console.log(`❌ Scenario failures: ${scenFailed}`);
  console.log(`${"─".repeat(50)}\n`);
}

seed().catch(err => { console.error("Fatal:", err); process.exit(1); });
