import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { STARTER_PRODUCTS } = await loadTypeScript("../../src/lib/starterProducts.ts");
const { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } = await loadTypeScript(
  "../../src/lib/productCategories.ts",
);

test("catalog covers common staples with distinct dry and cooked portions", () => {
  const names = new Set(STARTER_PRODUCTS.map((food) => food.name));
  for (const name of [
    "Chicken breast (raw, skinless)",
    "Lentils (dry)",
    "Lentils (cooked)",
    "White rice (dry)",
    "White rice (cooked)",
    "Pasta (dry)",
    "Pasta (cooked)",
  ]) {
    assert.ok(names.has(name), `Missing staple: ${name}`);
  }
  const rice = (name) => STARTER_PRODUCTS.find((food) => food.name === name);
  assert.ok(
    rice("White rice (dry)").calories_per_100g > rice("White rice (cooked)").calories_per_100g,
  );
});

test("catalog has unique names, valid categories and per-100g nutrition", () => {
  const keys = new Set();
  for (const food of STARTER_PRODUCTS) {
    const key = `${food.category}:${food.name.trim().toLowerCase()}`;
    assert.ok(!keys.has(key), `Duplicate: ${key}`);
    keys.add(key);
    assert.ok(PRODUCT_CATEGORIES.includes(food.category));
    assert.ok(PRODUCT_CATEGORY_LABELS[food.category]);
    for (const field of [
      "calories_per_100g",
      "protein_per_100g",
      "carbs_per_100g",
      "fat_per_100g",
    ]) {
      assert.ok(Number.isFinite(food[field]) && food[field] >= 0, `${food.name}: ${field}`);
    }
    assert.ok(food.protein_per_100g + food.carbs_per_100g + food.fat_per_100g <= 101);
  }
});

test("database backfill and application catalog use the same foods and nutrition", async () => {
  const sql = await readFile(
    new URL("../../supabase/migrations/20261003120000_expand_common_foods.sql", import.meta.url),
    "utf8",
  );
  const rows = [
    ...sql.matchAll(
      /^  \('((?:[^']|'')*)', '([^']+)', ([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+), '((?:[^']|'')*)'\)/gm,
    ),
  ].map((match) => ({
    name: match[1].replaceAll("''", "'"),
    category: match[2],
    calories_per_100g: Number(match[3]),
    protein_per_100g: Number(match[4]),
    carbs_per_100g: Number(match[5]),
    fat_per_100g: Number(match[6]),
    notes: match[7].replaceAll("''", "'"),
  }));
  assert.deepEqual(
    rows,
    STARTER_PRODUCTS.map((food) => ({
      ...food,
      notes: food.notes ?? "Common raw food nutrition values per 100 g.",
    })),
  );
});
