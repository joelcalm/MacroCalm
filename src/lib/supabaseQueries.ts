import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { ProductCategory } from "@/lib/productCategories";
import { STARTER_PRODUCTS } from "@/lib/starterProducts";

const STARTER_PRODUCT_BRAND = "Common foods";
const STARTER_PRODUCT_NOTES = "Common raw food nutrition values per 100 g.";

let starterProductsPromise: Promise<void> | null = null;

export type Product = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: ProductCategory;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  source_type: "manual" | "photo";
  source_image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MealTemplate = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type MealTemplateItem = {
  id: string;
  meal_template_id: string;
  product_id: string;
  default_quantity_g: number;
  product?: Product;
};

export type DailyLog = {
  id: string;
  user_id: string;
  date: string;
};

export type DailyLogItem = {
  id: string;
  daily_log_id: string;
  product_id: string;
  quantity_g: number;
  meal_template_id: string | null;
  meal_instance_id: string | null;
  meal_name: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
};

export type WeightLog = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WorkoutSessionLog = Database["public"]["Tables"]["workout_session_logs"]["Row"];
type WorkoutExerciseLog = Database["public"]["Tables"]["workout_exercise_logs"]["Row"];
type WorkoutSetLog = Database["public"]["Tables"]["workout_sets"]["Row"];
type WorkoutDayPlan = Database["public"]["Tables"]["workout_day_plans"]["Row"];

export type WorkoutLogSummary = Pick<
  WorkoutSessionLog,
  "id" | "date" | "status" | "duration_minutes" | "rpe" | "energy" | "notes"
> & {
  title: string;
  category: string | null;
  exercises: Array<
    Pick<
      WorkoutExerciseLog,
      | "id"
      | "status"
      | "planned_name"
      | "actual_name"
      | "actual_duration"
      | "actual_reps"
      | "completed_set_count"
      | "exercise_type"
    > & {
      sets: Pick<WorkoutSetLog, "set_index" | "reps" | "seconds" | "cardio_duration_minutes">[];
    }
  >;
};

/* ---------------- products ---------------- */

export async function listProducts(options?: {
  category?: ProductCategory | "all";
  ensureStarterProducts?: boolean;
}): Promise<Product[]> {
  if (options?.ensureStarterProducts) {
    await ensureStarterProducts();
  }

  let query = supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (options?.category && options.category !== "all") {
    query = query.eq("category", options.category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return dedupeStarterProducts((data ?? []) as Product[]);
}

export async function ensureStarterProducts(): Promise<void> {
  if (starterProductsPromise) return starterProductsPromise;

  starterProductsPromise = insertMissingStarterProducts().finally(() => {
    starterProductsPromise = null;
  });

  return starterProductsPromise;
}

async function insertMissingStarterProducts(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  const { data: existing, error } = await supabase.from("products").select("name, category");
  if (error) throw error;

  const existingKeys = new Set(
    (existing ?? []).map((p) => starterProductKey(p.name, p.category as ProductCategory)),
  );
  const missing = STARTER_PRODUCTS.filter(
    (p) => !existingKeys.has(starterProductKey(p.name, p.category)),
  );

  if (!missing.length) return;

  const { error: insertError } = await supabase.from("products").insert(
    missing.map((p) => ({
      ...p,
      user_id: u.user.id,
      brand: STARTER_PRODUCT_BRAND,
      source_type: "manual",
      source_image_url: null,
      notes: p.notes ?? STARTER_PRODUCT_NOTES,
    })),
  );
  if (insertError && insertError.code === "23505") return;
  if (insertError) throw insertError;
}

function dedupeStarterProducts(products: Product[]) {
  const seenStarterKeys = new Set<string>();

  return products.filter((product) => {
    if (!isStarterProduct(product)) return true;

    const key = starterProductKey(product.name, product.category);
    if (seenStarterKeys.has(key)) return false;

    seenStarterKeys.add(key);
    return true;
  });
}

function isStarterProduct(product: Product) {
  return product.brand === STARTER_PRODUCT_BRAND && product.source_type === "manual";
}

function starterProductKey(name: string, category: ProductCategory) {
  return `${category}:${name.trim().toLowerCase()}`;
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function createProduct(
  input: Omit<Product, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<Product> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, user_id: u.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- storage ---------------- */

export async function uploadProductLabel(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${u.user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("product-labels").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = await supabase.storage
    .from("product-labels")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

/* ---------------- meal templates ---------------- */

export async function listMealTemplates(): Promise<MealTemplate[]> {
  const { data, error } = await supabase
    .from("meal_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MealTemplate[];
}

export async function getMealTemplate(
  id: string,
): Promise<{ template: MealTemplate; items: MealTemplateItem[] } | null> {
  const { data: tpl, error: e1 } = await supabase
    .from("meal_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw e1;
  if (!tpl) return null;
  const { data: items, error: e2 } = await supabase
    .from("meal_template_items")
    .select("*, product:products(*)")
    .eq("meal_template_id", id);
  if (e2) throw e2;
  return { template: tpl as MealTemplate, items: (items ?? []) as MealTemplateItem[] };
}

export async function createMealTemplate(
  name: string,
  description: string | null,
  items: { product_id: string; default_quantity_g: number }[],
): Promise<MealTemplate> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data: tpl, error } = await supabase
    .from("meal_templates")
    .insert({ name, description, user_id: u.user.id })
    .select("*")
    .single();
  if (error) throw error;
  if (items.length) {
    const { error: e2 } = await supabase
      .from("meal_template_items")
      .insert(items.map((i) => ({ ...i, meal_template_id: tpl.id })));
    if (e2) throw e2;
  }
  return tpl as MealTemplate;
}

export async function updateMealTemplate(
  id: string,
  patch: Pick<Partial<MealTemplate>, "name" | "description">,
): Promise<MealTemplate> {
  const { data, error } = await supabase
    .from("meal_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MealTemplate;
}

export async function addMealTemplateItem(
  meal_template_id: string,
  product_id: string,
  default_quantity_g = 100,
): Promise<MealTemplateItem> {
  const { data, error } = await supabase
    .from("meal_template_items")
    .insert({ meal_template_id, product_id, default_quantity_g })
    .select("*, product:products(*)")
    .single();
  if (error) throw error;
  return data as MealTemplateItem;
}

export async function updateMealTemplateItem(id: string, default_quantity_g: number) {
  const { error } = await supabase
    .from("meal_template_items")
    .update({ default_quantity_g })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMealTemplateItem(id: string) {
  const { error } = await supabase.from("meal_template_items").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteMealTemplate(id: string) {
  const { error } = await supabase.from("meal_templates").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- daily logs ---------------- */

export async function getOrCreateDailyLog(date: string): Promise<DailyLog> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data: existing, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing as DailyLog;
  const { data, error: e2 } = await supabase
    .from("daily_logs")
    .insert({ date, user_id: u.user.id })
    .select("*")
    .single();
  if (e2) throw e2;
  return data as DailyLog;
}

export async function listDailyLogItems(date: string): Promise<DailyLogItem[]> {
  const log = await getOrCreateDailyLog(date);
  const { data, error } = await supabase
    .from("daily_log_items")
    .select("*, product:products(*)")
    .eq("daily_log_id", log.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyLogItem[];
}

export async function addDailyLogItem(input: {
  date: string;
  product_id: string;
  quantity_g: number;
  meal_template_id?: string | null;
  meal_instance_id?: string | null;
  meal_name?: string | null;
}) {
  const log = await getOrCreateDailyLog(input.date);
  const row = {
    daily_log_id: log.id,
    product_id: input.product_id,
    quantity_g: input.quantity_g,
    meal_template_id: input.meal_template_id ?? null,
    meal_name: input.meal_name ?? null,
    ...(input.meal_instance_id ? { meal_instance_id: input.meal_instance_id } : {}),
  };
  const { error } = await supabase.from("daily_log_items").insert(row);
  if (error) throw error;
}

export async function addMealTemplateToLog(
  date: string,
  templateId: string,
  overrides: { product_id: string; quantity_g: number }[],
): Promise<DailyLogItem[]> {
  if (!overrides.length) throw new Error("Add at least one product before logging this meal");

  const [tpl, log] = await Promise.all([getMealTemplate(templateId), getOrCreateDailyLog(date)]);
  if (!tpl) throw new Error("Template not found");
  const mealInstanceId = createMealInstanceId();
  const rows = overrides.map((o) => ({
    daily_log_id: log.id,
    product_id: o.product_id,
    quantity_g: o.quantity_g,
    meal_template_id: templateId,
    meal_instance_id: mealInstanceId,
    meal_name: tpl.template.name,
  }));
  const { data, error } = await supabase
    .from("daily_log_items")
    .insert(rows)
    .select("*, product:products(*)");
  if (!error) return (data ?? []) as DailyLogItem[];

  // Older deployed databases may not have the optional grouping column yet.
  // A multi-row insert still shares one created_at value, so the UI's legacy
  // grouping path keeps the products together until the migration is applied.
  if (isMissingMealInstanceColumn(error)) {
    const legacyRows = rows.map(({ meal_instance_id: _, ...row }) => row);
    const { data: legacyData, error: legacyError } = await supabase
      .from("daily_log_items")
      .insert(legacyRows)
      .select("*, product:products(*)");
    if (!legacyError) return (legacyData ?? []) as DailyLogItem[];
    throw legacyError;
  }

  throw error;
}

function createMealInstanceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isMissingMealInstanceColumn(error: { code?: string; message?: string }) {
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    (error.message ?? "").toLowerCase().includes("meal_instance_id")
  );
}

export async function updateDailyLogItem(id: string, quantity_g: number) {
  const { error } = await supabase.from("daily_log_items").update({ quantity_g }).eq("id", id);
  if (error) throw error;
}

export async function deleteDailyLogItem(id: string) {
  const { error } = await supabase.from("daily_log_items").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- weight logs ---------------- */

export async function getWeightLog(date: string): Promise<WeightLog | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data as WeightLog | null;
}

export async function upsertWeightLog(input: {
  date: string;
  weight_kg: number;
  notes?: string | null;
}): Promise<WeightLog> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: u.user.id,
        date: input.date,
        weight_kg: input.weight_kg,
        notes: input.notes ?? null,
      },
      { onConflict: "user_id,date" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as WeightLog;
}

export async function listWeightLogs(startDate: string, endDate: string): Promise<WeightLog[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WeightLog[];
}

export async function listWorkoutLogSummaries(date: string): Promise<WorkoutLogSummary[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  const { data: sessions, error: sessionsError } = await supabase
    .from("workout_session_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as WorkoutSessionLog[];
  const sessionIds = sessionRows.map((session) => session.id);
  if (!sessionIds.length) return [];

  const { data: exercises, error: exercisesError } = await supabase
    .from("workout_exercise_logs")
    .select("*")
    .in("session_log_id", sessionIds)
    .order("order_index", { ascending: true });
  if (exercisesError) throw exercisesError;

  const exerciseRows = (exercises ?? []) as WorkoutExerciseLog[];
  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  const dayIds = Array.from(new Set(sessionRows.map((session) => session.day_plan_id)));
  let setRows: WorkoutSetLog[] = [];
  let dayRows: WorkoutDayPlan[] = [];

  if (exerciseIds.length) {
    const { data: sets, error: setsError } = await supabase
      .from("workout_sets")
      .select("*")
      .in("session_exercise_log_id", exerciseIds)
      .order("set_index", { ascending: true });
    if (setsError) throw setsError;
    setRows = (sets ?? []) as WorkoutSetLog[];
  }

  if (dayIds.length) {
    const { data: days, error: daysError } = await supabase
      .from("workout_day_plans")
      .select("*")
      .in("id", dayIds);
    if (daysError) throw daysError;
    dayRows = (days ?? []) as WorkoutDayPlan[];
  }

  return sessionRows.map((session) => ({
    id: session.id,
    date: session.date,
    status: session.status,
    duration_minutes: session.duration_minutes,
    rpe: session.rpe,
    energy: session.energy,
    notes: session.notes,
    title: dayRows.find((day) => day.id === session.day_plan_id)?.title ?? "Workout",
    category: dayRows.find((day) => day.id === session.day_plan_id)?.category ?? null,
    exercises: exerciseRows
      .filter((exercise) => exercise.session_log_id === session.id)
      .map((exercise) => ({
        id: exercise.id,
        status: exercise.status,
        planned_name: exercise.planned_name,
        actual_name: exercise.actual_name,
        actual_duration: exercise.actual_duration,
        actual_reps: exercise.actual_reps,
        completed_set_count: exercise.completed_set_count,
        exercise_type: exercise.exercise_type,
        sets: setRows
          .filter((set) => set.session_exercise_log_id === exercise.id)
          .map((set) => ({
            set_index: set.set_index,
            reps: set.reps,
            seconds: set.seconds,
            cardio_duration_minutes: set.cardio_duration_minutes,
          })),
      })),
  }));
}

/* ---------------- export ---------------- */

export async function exportWorkoutRange(startDate: string, endDate: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  const { data: sessions, error: sessionsError } = await supabase
    .from("workout_session_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (sessionsError) throw sessionsError;

  const sessionRows = (sessions ?? []) as WorkoutSessionLog[];
  const sessionIds = sessionRows.map((session) => session.id);
  const dayIds = Array.from(new Set(sessionRows.map((session) => session.day_plan_id)));
  let exerciseRows: WorkoutExerciseLog[] = [];
  let setRows: WorkoutSetLog[] = [];
  let dayRows: WorkoutDayPlan[] = [];

  if (sessionIds.length) {
    const { data: exercises, error: exercisesError } = await supabase
      .from("workout_exercise_logs")
      .select("*")
      .in("session_log_id", sessionIds)
      .order("order_index", { ascending: true });
    if (exercisesError) throw exercisesError;
    exerciseRows = (exercises ?? []) as WorkoutExerciseLog[];
  }

  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  if (exerciseIds.length) {
    const { data: sets, error: setsError } = await supabase
      .from("workout_sets")
      .select("*")
      .in("session_exercise_log_id", exerciseIds)
      .order("set_index", { ascending: true });
    if (setsError) throw setsError;
    setRows = (sets ?? []) as WorkoutSetLog[];
  }

  if (dayIds.length) {
    const { data: days, error: daysError } = await supabase
      .from("workout_day_plans")
      .select("*")
      .in("id", dayIds);
    if (daysError) throw daysError;
    dayRows = (days ?? []) as WorkoutDayPlan[];
  }

  return {
    exported_at: new Date().toISOString(),
    range: { start_date: startDate, end_date: endDate },
    workout_session_logs: sessionRows.map((session) => ({
      ...session,
      day_plan: dayRows.find((day) => day.id === session.day_plan_id) ?? null,
      exercise_logs: exerciseRows
        .filter((exercise) => exercise.session_log_id === session.id)
        .map((exercise) => ({
          ...exercise,
          sets: setRows.filter((set) => set.session_exercise_log_id === exercise.id),
        })),
    })),
  };
}

export async function exportFoodLogRange(startDate: string, endDate: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  const { data: logs, error: logsError } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", u.user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (logsError) throw logsError;

  const logRows = (logs ?? []) as DailyLog[];
  const logIds = logRows.map((log) => log.id);
  let itemRows: DailyLogItem[] = [];

  if (logIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from("daily_log_items")
      .select("*, product:products(*)")
      .in("daily_log_id", logIds)
      .order("created_at", { ascending: true });
    if (itemsError) throw itemsError;
    itemRows = (items ?? []) as DailyLogItem[];
  }

  return {
    exported_at: new Date().toISOString(),
    range: { start_date: startDate, end_date: endDate },
    daily_logs: logRows.map((log) => ({
      ...log,
      items: itemRows.filter((item) => item.daily_log_id === log.id),
    })),
  };
}

export async function exportStoredFoodLibrary() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", u.user.id)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (productsError) throw productsError;

  const { data: templates, error: templatesError } = await supabase
    .from("meal_templates")
    .select("*")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false });
  if (templatesError) throw templatesError;

  const templateRows = (templates ?? []) as MealTemplate[];
  const templateIds = templateRows.map((template) => template.id);
  let itemRows: MealTemplateItem[] = [];

  if (templateIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from("meal_template_items")
      .select("*, product:products(*)")
      .in("meal_template_id", templateIds);
    if (itemsError) throw itemsError;
    itemRows = (items ?? []) as MealTemplateItem[];
  }

  return {
    exported_at: new Date().toISOString(),
    products: products ?? [],
    meal_templates: templateRows.map((template) => ({
      ...template,
      items: itemRows.filter((item) => item.meal_template_id === template.id),
    })),
  };
}

export async function exportAllData() {
  const [
    products,
    templates,
    items,
    logs,
    logItems,
    weightLogs,
    workoutPlans,
    workoutDayPlans,
    workoutBlocks,
    workoutExercisePlans,
    workoutSessionLogs,
    workoutExerciseLogs,
    workoutSets,
  ] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("meal_templates").select("*"),
    supabase.from("meal_template_items").select("*"),
    supabase.from("daily_logs").select("*"),
    supabase.from("daily_log_items").select("*"),
    supabase.from("weight_logs").select("*"),
    supabase.from("workout_plans").select("*"),
    supabase.from("workout_day_plans").select("*"),
    supabase.from("workout_blocks").select("*"),
    supabase.from("workout_exercise_plans").select("*"),
    supabase.from("workout_session_logs").select("*"),
    supabase.from("workout_exercise_logs").select("*"),
    supabase.from("workout_sets").select("*"),
  ]);
  return {
    products: products.data,
    meal_templates: templates.data,
    meal_template_items: items.data,
    daily_logs: logs.data,
    daily_log_items: logItems.data,
    weight_logs: weightLogs.data,
    workout_plans: workoutPlans.data,
    workout_day_plans: workoutDayPlans.data,
    workout_blocks: workoutBlocks.data,
    workout_exercise_plans: workoutExercisePlans.data,
    workout_session_logs: workoutSessionLogs.data,
    workout_exercise_logs: workoutExerciseLogs.data,
    workout_sets: workoutSets.data,
    exported_at: new Date().toISOString(),
  };
}
