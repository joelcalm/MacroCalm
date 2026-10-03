export const PRODUCT_CATEGORIES = [
  "fruits",
  "vegetables",
  "meats",
  "seafood",
  "legumes",
  "grains",
  "eggs",
  "dairy",
  "nuts_seeds",
  "oils_fats",
  "other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruits: "Fruits",
  vegetables: "Vegetables",
  meats: "Meat & poultry",
  seafood: "Fish & seafood",
  legumes: "Legumes & soy",
  grains: "Grains, rice & pasta",
  eggs: "Eggs",
  dairy: "Dairy",
  nuts_seeds: "Nuts & seeds",
  oils_fats: "Oils & fats",
  other: "Other",
};

export function isProductCategory(value: string): value is ProductCategory {
  return PRODUCT_CATEGORIES.includes(value as ProductCategory);
}
