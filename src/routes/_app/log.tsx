import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateSelector } from "@/components/DateSelector";
import { MacroSummaryCard } from "@/components/MacroSummaryCard";
import { QuantityInput } from "@/components/QuantityInput";
import { Sheet } from "@/components/Sheet";
import { ProductPicker } from "@/components/ProductPicker";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  addDailyLogItem,
  addMealTemplateToLog,
  deleteDailyLogItem,
  getWeightLog,
  getMealTemplate,
  listWorkoutLogSummaries,
  listWeightLogs,
  listDailyLogItems,
  listMealTemplates,
  updateDailyLogItem,
  upsertWeightLog,
  type DailyLogItem,
  type MealTemplate,
  type Product,
  type WeightLog,
  type WorkoutLogSummary,
} from "@/lib/supabaseQueries";
import { computeMacros, fmtCal, fmtMacro, sumMacros } from "@/lib/nutrition";
import { getErrorMessage } from "@/lib/utils";
import { Apple, ChevronDown, Dumbbell, Plus, Scale, Trash2, UtensilsCrossed } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/log")({
  component: LogPage,
});

type AddMode =
  | "none"
  | "choose"
  | "product"
  | "productQty"
  | "meal"
  | "mealConfirm"
  | "mealProduct";
type WeightRangePreset = "week" | "month" | "custom";

type MealLogDraftItem = {
  id: string;
  product_id: string;
  product?: Product;
  qty: number;
  addedForToday: boolean;
};

const weightChartConfig = {
  weight: {
    label: "Weight",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

function LogPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DailyLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [weightPreset, setWeightPreset] = useState<WeightRangePreset>("week");
  const [weightStartDate, setWeightStartDate] = useState(() => daysAgo(6));
  const [weightEndDate, setWeightEndDate] = useState(() => todayString());
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightLoading, setWeightLoading] = useState(true);
  const [selectedWeightLog, setSelectedWeightLog] = useState<WeightLog | null>(null);
  const [selectedWeightInput, setSelectedWeightInput] = useState("");
  const [weightEditorOpen, setWeightEditorOpen] = useState(false);
  const [savingWeight, setSavingWeight] = useState(false);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutLogSummary[]>([]);
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

  const [pickedProduct, setPickedProduct] = useState<Product | null>(null);
  const [pickedQty, setPickedQty] = useState(100);

  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [mealConfirmItems, setMealConfirmItems] = useState<MealLogDraftItem[]>([]);
  const [pickedTemplate, setPickedTemplate] = useState<MealTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingMealDraft, setLoadingMealDraft] = useState(false);
  const [loggingMeal, setLoggingMeal] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, weight, workouts] = await Promise.all([
        listDailyLogItems(date),
        getWeightLog(date),
        listWorkoutLogSummaries(date),
      ]);
      setItems(list);
      setSelectedWeightLog(weight);
      setSelectedWeightInput(weight ? String(Number(weight.weight_kg)) : "");
      setWorkoutSummaries(workouts);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load log"));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setExpandedMeals({});
    refresh();
  }, [refresh]);

  useEffect(() => {
    setWeightLoading(true);
    listWeightLogs(weightStartDate, weightEndDate)
      .then(setWeightLogs)
      .catch((e: unknown) => toast.error(getErrorMessage(e, "Could not load weight logs")))
      .finally(() => setWeightLoading(false));
  }, [weightStartDate, weightEndDate]);

  const totals = sumMacros(
    items.map((i) =>
      i.product
        ? computeMacros(i.product, i.quantity_g)
        : { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );

  const { mealGroups, individualItems } = groupLoggedItems(items);

  async function changeQty(item: DailyLogItem, q: number) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, quantity_g: q } : x)));
    await updateDailyLogItem(item.id, q);
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    await deleteDailyLogItem(id);
  }

  async function saveProduct() {
    if (!pickedProduct) return;
    await addDailyLogItem({ date, product_id: pickedProduct.id, quantity_g: pickedQty });
    setAddMode("none");
    setPickedProduct(null);
    setPickedQty(100);
    refresh();
  }

  async function openMealPicker() {
    setAddMode("meal");
    setLoadingTemplates(true);
    try {
      setTemplates(await listMealTemplates());
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load meals"));
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function pickTemplate(tpl: MealTemplate) {
    setLoadingMealDraft(true);
    try {
      const data = await getMealTemplate(tpl.id);
      if (!data) throw new Error("Meal not found");
      setPickedTemplate(data.template);
      setMealConfirmItems(
        data.items.map((item) => ({
          id: `template:${item.id}`,
          product_id: item.product_id,
          product: item.product,
          qty: Number(item.default_quantity_g),
          addedForToday: false,
        })),
      );
      setAddMode("mealConfirm");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not load meal"));
    } finally {
      setLoadingMealDraft(false);
    }
  }

  function addProductToMealDraft(product: Product) {
    setMealConfirmItems((current) => {
      if (current.some((item) => item.product_id === product.id)) return current;
      return [
        ...current,
        {
          id: `extra:${product.id}`,
          product_id: product.id,
          product,
          qty: 100,
          addedForToday: true,
        },
      ];
    });
    setAddMode("mealConfirm");
  }

  async function confirmMeal() {
    if (!pickedTemplate || loggingMeal) return;
    const itemsToLog = mealConfirmItems.filter((item) => item.qty > 0);
    if (!itemsToLog.length) {
      toast.error("Add at least one product with a quantity above 0 g");
      return;
    }

    setLoggingMeal(true);
    try {
      const loggedItems = await addMealTemplateToLog(
        date,
        pickedTemplate.id,
        itemsToLog.map((item) => ({
          product_id: item.product_id,
          quantity_g: item.qty,
        })),
      );
      setItems((current) => [...current, ...loggedItems]);
      setAddMode("none");
      setPickedTemplate(null);
      setMealConfirmItems([]);
      toast.success(`${pickedTemplate.name} logged`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not log meal"));
    } finally {
      setLoggingMeal(false);
    }
  }

  async function saveSelectedWeight() {
    const normalizedInput = selectedWeightInput.trim().replace(",", ".");
    const weight = Number(normalizedInput);
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error("Enter a valid weight");
      return;
    }

    setSavingWeight(true);
    try {
      const saved = await upsertWeightLog({ date, weight_kg: weight });
      setSelectedWeightLog(saved);
      setSelectedWeightInput(String(Number(saved.weight_kg)));
      setWeightEditorOpen(false);
      if (date >= weightStartDate && date <= weightEndDate) {
        setWeightLoading(true);
        listWeightLogs(weightStartDate, weightEndDate)
          .then(setWeightLogs)
          .catch((e: unknown) => toast.error(getErrorMessage(e, "Could not refresh weight chart")))
          .finally(() => setWeightLoading(false));
      }
      toast.success("Weight saved");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not save weight"));
    } finally {
      setSavingWeight(false);
    }
  }

  const mealConfirmTotals = sumMacros(
    mealConfirmItems.map((i) =>
      i.product ? computeMacros(i.product, i.qty) : { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );

  function setWeightRange(preset: WeightRangePreset) {
    setWeightPreset(preset);
    if (preset === "week") {
      setWeightStartDate(daysAgo(6));
      setWeightEndDate(todayString());
    }
    if (preset === "month") {
      setWeightStartDate(daysAgo(29));
      setWeightEndDate(todayString());
    }
  }

  const weightChartData = weightLogs.map((log) => ({
    date: log.date,
    label: formatShortDate(log.date),
    weight: Number(log.weight_kg),
  }));

  return (
    <AppShell title="Log">
      <DateSelector value={date} onChange={setDate} />
      <div className="mt-4">
        <MacroSummaryCard macros={totals} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <button
          onClick={() => setAddMode("product")}
          className="rounded-2xl border border-border bg-card p-4 text-left flex flex-col gap-1 hover:border-primary/50"
        >
          <Apple className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Add product</span>
        </button>
        <button
          onClick={openMealPicker}
          className="rounded-2xl bg-gradient-primary text-primary-foreground p-4 text-left flex flex-col gap-1 shadow-glow"
        >
          <UtensilsCrossed className="h-5 w-5" />
          <span className="font-semibold text-sm">Add meal</span>
        </button>
      </div>

      <button
        onClick={() => {
          setSelectedWeightInput(
            selectedWeightLog ? String(Number(selectedWeightLog.weight_kg)) : "",
          );
          setWeightEditorOpen(true);
        }}
        className="mt-3 w-full rounded-2xl border border-border bg-card p-4 text-left flex items-center justify-between gap-3 hover:border-primary/50"
      >
        <span className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </span>
          <span>
            <span className="block font-semibold">
              {selectedWeightLog ? "Update weight" : "Log weight"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {selectedWeightLog
                ? `${Number(selectedWeightLog.weight_kg).toFixed(1)} kg on ${formatShortDate(date)}`
                : `Record body weight for ${formatShortDate(date)}`}
            </span>
          </span>
        </span>
        <Plus className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>
          </div>
        ) : (
          <>
            {mealGroups.map((group) => (
              <LoggedMealCard
                key={group.key}
                name={group.name}
                items={group.items}
                expanded={Boolean(expandedMeals[group.key])}
                onToggle={() =>
                  setExpandedMeals((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                }
                onChangeQty={changeQty}
                onRemove={removeItem}
              />
            ))}
            {individualItems.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium">Individual items</h2>
                <div className="space-y-2">
                  {individualItems.map((item) => (
                    <LoggedItemCard
                      key={item.id}
                      item={item}
                      onChangeQty={changeQty}
                      onRemove={removeItem}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <WorkoutSummaryCard summaries={workoutSummaries} loading={loading} />

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Weight progression</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Track your weight across time.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => setWeightRange("week")}
            className={rangeButtonClass(weightPreset === "week")}
          >
            Last week
          </button>
          <button
            onClick={() => setWeightRange("month")}
            className={rangeButtonClass(weightPreset === "month")}
          >
            Last month
          </button>
          <button
            onClick={() => setWeightPreset("custom")}
            className={rangeButtonClass(weightPreset === "custom")}
          >
            Custom
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <DateField
            label="Start"
            value={weightStartDate}
            onChange={(value) => {
              setWeightPreset("custom");
              setWeightStartDate(value);
            }}
          />
          <DateField
            label="End"
            value={weightEndDate}
            onChange={(value) => {
              setWeightPreset("custom");
              setWeightEndDate(value);
            }}
          />
        </div>

        <div className="mt-4">
          {weightLoading ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading weight data…</p>
          ) : weightChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              No weight logged in this range.
            </p>
          ) : (
            <ChartContainer config={weightChartConfig} className="h-52 w-full">
              <LineChart data={weightChartData} margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={16}
                />
                <YAxis
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {Number(value).toFixed(1)} kg
                        </span>
                      )}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                    />
                  }
                />
                <Line
                  dataKey="weight"
                  type="monotone"
                  connectNulls
                  stroke="#fff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ r: 3.5, fill: "#fff", stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#fff", stroke: "#fff" }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </div>

      {/* Add product picker */}
      <Sheet open={addMode === "product"} onClose={() => setAddMode("none")} title="Pick product">
        <ProductPicker
          onPick={(p) => {
            setPickedProduct(p);
            setPickedQty(100);
            setAddMode("productQty");
          }}
        />
      </Sheet>

      <Sheet
        open={weightEditorOpen}
        onClose={() => setWeightEditorOpen(false)}
        title={`Weight for ${formatShortDate(date)}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 ml-1">Weight</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={selectedWeightInput}
                onChange={(e) => setSelectedWeightInput(e.target.value)}
                className="w-full h-12 rounded-xl bg-input px-4 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. 72.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                kg
              </span>
            </div>
          </div>
          <button
            onClick={saveSelectedWeight}
            disabled={savingWeight}
            className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
          >
            {savingWeight ? "Saving..." : "Save weight"}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={addMode === "productQty"}
        onClose={() => setAddMode("none")}
        title={pickedProduct?.name}
      >
        {pickedProduct && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">How many grams?</p>
            <QuantityInput value={pickedQty} onChange={setPickedQty} />
            <MacroSummaryCard macros={computeMacros(pickedProduct, pickedQty)} />
            <button
              onClick={saveProduct}
              className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
            >
              Add to log
            </button>
          </div>
        )}
      </Sheet>

      {/* Add meal */}
      <Sheet open={addMode === "meal"} onClose={() => setAddMode("none")} title="Pick meal">
        {loadingTemplates ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading meals…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No meals saved yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => pickTemplate(t)}
                disabled={loadingMealDraft}
                className="w-full text-left rounded-xl border border-border bg-card p-3 hover:border-primary/50 disabled:opacity-60"
              >
                <p className="font-medium">{t.name}</p>
                {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet
        open={addMode === "mealConfirm"}
        onClose={() => setAddMode("none")}
        title={`Log ${pickedTemplate?.name}`}
      >
        <div className="space-y-3">
          <MacroSummaryCard macros={mealConfirmTotals} />
          <p className="text-xs text-muted-foreground">
            Changes here apply only to this log. Your saved meal stays unchanged.
          </p>
          {mealConfirmItems.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{it.product?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.addedForToday ? "Added for this log" : "From saved meal"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMealConfirmItems((current) => current.filter((item) => item.id !== it.id))
                  }
                  aria-label={`Remove ${it.product?.name ?? "product"} from this log`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <QuantityInput
                value={it.qty}
                onChange={(v) =>
                  setMealConfirmItems((prev) =>
                    prev.map((item) => (item.id === it.id ? { ...item, qty: v } : item)),
                  )
                }
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAddMode("mealProduct")}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Add another product
          </button>
          <button
            onClick={confirmMeal}
            disabled={loggingMeal || !mealConfirmItems.some((item) => item.qty > 0)}
            className="w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow disabled:opacity-60"
          >
            {loggingMeal ? (
              "Adding to log…"
            ) : (
              <>
                <Plus className="inline h-4 w-4 mr-1" />
                Add to log
              </>
            )}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={addMode === "mealProduct"}
        onClose={() => setAddMode("mealConfirm")}
        title={`Add to ${pickedTemplate?.name ?? "meal"}`}
      >
        <ProductPicker
          excludeProductIds={mealConfirmItems.map((item) => item.product_id)}
          onPick={addProductToMealDraft}
        />
      </Sheet>
    </AppShell>
  );
}

type LoggedMealGroup = {
  key: string;
  name: string;
  items: DailyLogItem[];
};

function groupLoggedItems(items: DailyLogItem[]) {
  const groups = new Map<string, LoggedMealGroup>();
  const individualItems: DailyLogItem[] = [];

  for (const item of items) {
    if (!item.meal_name) {
      individualItems.push(item);
      continue;
    }

    // New logs have an explicit instance id. Older bulk inserts share a created_at
    // timestamp, which keeps separately logged legacy copies independent where possible.
    const key = item.meal_instance_id
      ? `instance:${item.meal_instance_id}`
      : `legacy:${item.meal_template_id ?? item.meal_name}:${item.created_at}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, { key, name: item.meal_name, items: [item] });
    }
  }

  return { mealGroups: Array.from(groups.values()), individualItems };
}

function LoggedMealCard({
  name,
  items,
  expanded,
  onToggle,
  onChangeQty,
  onRemove,
}: {
  name: string;
  items: DailyLogItem[];
  expanded: boolean;
  onToggle: () => void;
  onChangeQty: (item: DailyLogItem, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const totals = sumMacros(
    items.map((item) =>
      item.product
        ? computeMacros(item.product, item.quantity_g)
        : { calories: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );
  const detailsId = `logged-meal-${items[0]?.id ?? "details"}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
        className="flex min-h-16 w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {fmtCal(totals.calories)} kcal · P {fmtMacro(totals.protein)} · C{" "}
            {fmtMacro(totals.carbs)} · F {fmtMacro(totals.fat)}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "ingredient" : "ingredients"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div id={detailsId} className="space-y-2 border-t border-border p-3">
          {items.map((item) => (
            <LoggedItemCard
              key={item.id}
              item={item}
              onChangeQty={onChangeQty}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LoggedItemCard({
  item,
  onChangeQty,
  onRemove,
}: {
  item: DailyLogItem;
  onChangeQty: (item: DailyLogItem, quantity: number) => void;
  onRemove: (id: string) => void;
}) {
  const macros = item.product ? computeMacros(item.product, item.quantity_g) : null;

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{item.product?.name}</p>
          {macros && (
            <p className="text-xs text-muted-foreground">
              {fmtCal(macros.calories)} kcal · P {fmtMacro(macros.protein)} · C{" "}
              {fmtMacro(macros.carbs)} · F {fmtMacro(macros.fat)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.product?.name ?? "ingredient"}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2">
        <QuantityInput
          value={Number(item.quantity_g)}
          onChange={(quantity) => onChangeQty(item, quantity)}
        />
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs text-muted-foreground mb-1.5 ml-1">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 h-10 rounded-xl bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:h-11 sm:px-3 sm:text-sm"
      />
    </label>
  );
}

function WorkoutSummaryCard({
  summaries,
  loading,
}: {
  summaries: WorkoutLogSummary[];
  loading: boolean;
}) {
  const activeSummaries = summaries.filter((summary) => summary.status !== "not_started");
  const primarySummary = activeSummaries[0] ?? summaries[0] ?? null;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold">{primarySummary?.title ?? "Workout"}</h2>
            {primarySummary?.category && (
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {primarySummary.category}
              </p>
            )}
          </div>
        </div>
        {primarySummary && (
          <span className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">
            {workoutStatusLabel(primarySummary.status)}
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading workout…</p>
      ) : activeSummaries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No workout logged for this day.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {activeSummaries.map((summary) => {
            const performed = summary.exercises.filter((exercise) =>
              [
                "partial",
                "completed",
                "completed_as_planned",
                "completed_modified",
                "substituted",
                "overperformed",
              ].includes(exercise.status),
            );
            const skipped = summary.exercises.filter((exercise) => exercise.status === "skipped");
            const topLines = performed.slice(0, 4);
            return (
              <div key={summary.id}>
                <p className="text-xs text-muted-foreground">
                  {[
                    summary.duration_minutes == null ? null : `${summary.duration_minutes} min`,
                    summary.rpe == null ? null : `RPE ${Number(summary.rpe)}`,
                    summary.energy == null ? null : `Energy ${summary.energy}/5`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Workout logged"}
                </p>
                {topLines.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {topLines.map((exercise) => (
                      <p key={exercise.id} className="text-sm">
                        <span className="font-medium">
                          {exercise.actual_name || exercise.planned_name || "Exercise"}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {compactWorkoutExerciseLine(exercise)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {(performed.length > topLines.length || skipped.length > 0) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {performed.length > topLines.length
                      ? `+${performed.length - topLines.length} more`
                      : ""}
                    {performed.length > topLines.length && skipped.length > 0 ? " · " : ""}
                    {skipped.length > 0 ? `${skipped.length} skipped` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (!primarySummary) {
    return <div className="mt-6 rounded-2xl border border-border bg-card p-4">{content}</div>;
  }

  return (
    <Link
      to="/workout"
      search={{ date: primarySummary.date }}
      className="mt-6 block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      {content}
      <p className="mt-3 text-xs font-medium text-primary">Open workout</p>
    </Link>
  );
}

function rangeButtonClass(active: boolean) {
  return [
    "h-10 rounded-xl text-sm font-medium transition-colors",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-secondary text-muted-foreground hover:text-foreground",
  ].join(" ");
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function workoutStatusLabel(status: string) {
  return status.replace("completed_as_planned", "completed").replace(/_/g, " ");
}

function compactWorkoutExerciseLine(exercise: WorkoutLogSummary["exercises"][number]) {
  const performedSets = exercise.sets.filter(
    (set) => set.reps != null || set.seconds != null || set.cardio_duration_minutes != null,
  );
  const count = performedSets.length || exercise.completed_set_count || 0;
  const values = performedSets
    .slice(0, 5)
    .map((set) => {
      if (set.seconds != null) return `${Number(set.seconds)}s`;
      if (set.reps != null) return `${Number(set.reps)} reps`;
      if (set.cardio_duration_minutes != null) return `${Number(set.cardio_duration_minutes)} min`;
      return null;
    })
    .filter(Boolean);

  if (values.length) return `${count} sets: ${values.join(", ")}`;
  if (exercise.actual_duration) return exercise.actual_duration;
  if (exercise.actual_reps) return `${count || ""} sets ${exercise.actual_reps}`.trim();
  return workoutStatusLabel(exercise.status);
}
