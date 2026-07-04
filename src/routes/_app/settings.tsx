import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  exportFoodLogRange,
  exportStoredFoodLibrary,
  exportWorkoutRange,
} from "@/lib/supabaseQueries";
import { getErrorMessage } from "@/lib/utils";
import { Download, Info, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [workoutStartDate, setWorkoutStartDate] = useState(() => daysAgo(30));
  const [workoutEndDate, setWorkoutEndDate] = useState(() => todayString());
  const [foodStartDate, setFoodStartDate] = useState(() => daysAgo(30));
  const [foodEndDate, setFoodEndDate] = useState(() => todayString());
  const [exporting, setExporting] = useState<"workouts" | "foodLog" | "library" | null>(null);

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  async function exportWorkouts() {
    if (!validateDateRange(workoutStartDate, workoutEndDate)) return;

    setExporting("workouts");
    try {
      const data = await exportWorkoutRange(workoutStartDate, workoutEndDate);
      downloadJson(`macrocalm-workouts-${workoutStartDate}-to-${workoutEndDate}.json`, data);
      toast.success("Workout export downloaded");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not export workouts"));
    } finally {
      setExporting(null);
    }
  }

  async function exportFoodLog() {
    if (!validateDateRange(foodStartDate, foodEndDate)) return;

    setExporting("foodLog");
    try {
      const data = await exportFoodLogRange(foodStartDate, foodEndDate);
      downloadJson(`macrocalm-food-log-${foodStartDate}-to-${foodEndDate}.json`, data);
      toast.success("Food log export downloaded");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not export food log"));
    } finally {
      setExporting(null);
    }
  }

  async function exportLibrary() {
    const date = todayString();
    setExporting("library");
    try {
      const data = await exportStoredFoodLibrary();
      downloadJson(`macrocalm-food-library-${date}.json`, data);
      toast.success("Food library export downloaded");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not export food library"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell title="Settings">
      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Signed in as</p>
        <p className="font-medium mt-1 break-all">{user?.email}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          All nutrition values are stored{" "}
          <span className="text-foreground font-medium">per 100g</span>. Actual calories and macros
          are calculated from the quantity you enter when logging.
        </p>
      </div>

      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2 ml-1">Data</p>
      <div className="space-y-3">
        <ExportCard
          title="Export workouts"
          description="Download logged workout sessions, exercises, and sets for a date range."
          startDate={workoutStartDate}
          endDate={workoutEndDate}
          onStartDateChange={setWorkoutStartDate}
          onEndDateChange={setWorkoutEndDate}
          onDownload={exportWorkouts}
          loading={exporting === "workouts"}
        />
        <ExportCard
          title="Export food log"
          description="Download logged meals and products for a date range, including quantities and per-100g product nutrition."
          startDate={foodStartDate}
          endDate={foodEndDate}
          onStartDateChange={setFoodStartDate}
          onEndDateChange={setFoodEndDate}
          onDownload={exportFoodLog}
          loading={exporting === "foodLog"}
        />
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Export products & saved meals</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Download all stored products per 100g and saved reusable meals with default
                quantities.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportLibrary}
            disabled={exporting === "library"}
            className="mt-4 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {exporting === "library" ? "Exporting..." : "Download JSON"}
          </button>
        </section>
      </div>

      <button
        onClick={logout}
        className="w-full mt-6 h-12 rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </AppShell>
  );
}

function ExportCard({
  title,
  description,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onDownload,
  loading,
}: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onDownload: () => void;
  loading: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="h-11 rounded-xl border border-border bg-input px-3 text-sm"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onDownload}
        disabled={loading}
        className="mt-4 h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Exporting..." : "Download JSON"}
      </button>
    </section>
  );
}

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function validateDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    toast.error("Choose a start and end date");
    return false;
  }

  if (startDate > endDate) {
    toast.error("Start date must be before or equal to end date");
    return false;
  }

  return true;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}
