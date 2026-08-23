// Nutrition calculation helpers. All products store macros per 100g.

export interface MacroPer100g {
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function computeMacros(p: MacroPer100g, quantity_g: number): Macros {
  const q = Number(quantity_g) || 0;
  return {
    calories: ((Number(p.calories_per_100g) || 0) * q) / 100,
    protein: ((Number(p.protein_per_100g) || 0) * q) / 100,
    carbs: ((Number(p.carbs_per_100g) || 0) * q) / 100,
    fat: ((Number(p.fat_per_100g) || 0) * q) / 100,
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (a, b) => ({
      calories: a.calories + b.calories,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
    }),
    { ...EMPTY_MACROS },
  );
}

export const fmtCal = (n: number) => Math.round(n).toString();
export const fmtMacro = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
