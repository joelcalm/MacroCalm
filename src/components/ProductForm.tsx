import { useState } from "react";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from "@/lib/productCategories";
import type { Product } from "@/lib/supabaseQueries";

type NumericFormValue = number | "";

export type ProductFormValues = {
  name: string;
  brand: string;
  category: ProductCategory;
  calories_per_100g: NumericFormValue;
  protein_per_100g: NumericFormValue;
  carbs_per_100g: NumericFormValue;
  fat_per_100g: NumericFormValue;
  notes: string;
};

export type ProductFormSubmission = Omit<
  ProductFormValues,
  "calories_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g"
> & {
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

export function emptyForm(): ProductFormValues {
  return {
    name: "",
    brand: "",
    category: "other",
    calories_per_100g: "",
    protein_per_100g: "",
    carbs_per_100g: "",
    fat_per_100g: "",
    notes: "",
  };
}

export function fromProduct(p: Product): ProductFormValues {
  return {
    name: p.name,
    brand: p.brand ?? "",
    category: p.category ?? "other",
    calories_per_100g: Number(p.calories_per_100g),
    protein_per_100g: Number(p.protein_per_100g),
    carbs_per_100g: Number(p.carbs_per_100g),
    fat_per_100g: Number(p.fat_per_100g),
    notes: p.notes ?? "",
  };
}

export function ProductForm({
  initial,
  imagePreviewUrl,
  submitLabel = "Save product",
  onSubmit,
}: {
  initial?: ProductFormValues;
  imagePreviewUrl?: string | null;
  submitLabel?: string;
  onSubmit: (v: ProductFormSubmission) => Promise<void> | void;
}) {
  const [v, setV] = useState<ProductFormValues>(initial ?? emptyForm());
  const [busy, setBusy] = useState(false);

  const field =
    "w-full h-12 rounded-xl bg-input px-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.name.trim()) return;
        setBusy(true);
        try {
          await onSubmit(normalizeFormValues(v));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {imagePreviewUrl && (
        <div className="rounded-2xl overflow-hidden border border-border">
          <img src={imagePreviewUrl} alt="Label" className="w-full max-h-72 object-cover" />
        </div>
      )}

      <div>
        <Label>Name *</Label>
        <input
          className={field}
          placeholder="e.g. Greek yogurt"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label>Brand</Label>
        <input
          className={field}
          placeholder="optional"
          value={v.brand}
          onChange={(e) => setV({ ...v, brand: e.target.value })}
        />
      </div>

      <div>
        <Label>Category</Label>
        <select
          className={field}
          value={v.category}
          onChange={(e) => setV({ ...v, category: e.target.value as ProductCategory })}
        >
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {PRODUCT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground uppercase tracking-wider pt-2">Per 100g</p>

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Calories"
          value={v.calories_per_100g}
          onChange={(n) => setV({ ...v, calories_per_100g: n })}
          unit="kcal"
        />
        <NumField
          label="Protein"
          value={v.protein_per_100g}
          onChange={(n) => setV({ ...v, protein_per_100g: n })}
          unit="g"
        />
        <NumField
          label="Carbs"
          value={v.carbs_per_100g}
          onChange={(n) => setV({ ...v, carbs_per_100g: n })}
          unit="g"
        />
        <NumField
          label="Fat"
          value={v.fat_per_100g}
          onChange={(n) => setV({ ...v, fat_per_100g: n })}
          unit="g"
        />
      </div>

      <div>
        <Label>Notes</Label>
        <textarea
          className="w-full rounded-xl bg-input p-3 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="optional"
          value={v.notes}
          onChange={(e) => setV({ ...v, notes: e.target.value })}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-13 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold py-3.5 shadow-glow active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-muted-foreground mb-1.5 ml-1">{children}</label>;
}

function NumField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: NumericFormValue;
  onChange: (n: NumericFormValue) => void;
  unit: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min={0}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next === "" ? "" : Number(next));
          }}
          className="w-full h-12 rounded-xl bg-input px-4 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

function normalizeFormValues(v: ProductFormValues): ProductFormSubmission {
  return {
    ...v,
    calories_per_100g: numberOrZero(v.calories_per_100g),
    protein_per_100g: numberOrZero(v.protein_per_100g),
    carbs_per_100g: numberOrZero(v.carbs_per_100g),
    fat_per_100g: numberOrZero(v.fat_per_100g),
  };
}

function numberOrZero(value: NumericFormValue) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
