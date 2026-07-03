import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { exportAllData } from "@/lib/supabaseQueries";
import { getErrorMessage } from "@/lib/utils";
import { Download, FileJson, Info, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  }

  async function exportJson() {
    try {
      const data = await exportAllData();
      downloadFile(
        `macro-export-${Date.now()}.json`,
        JSON.stringify(data, null, 2),
        "application/json",
      );
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not export JSON"));
    }
  }

  async function exportCsv() {
    try {
      const data = await exportAllData();
      const rows: string[] = ["table,id,json"];
      const dump = (table: string, arr: unknown[] | null) => {
        (arr ?? []).forEach((row) => {
          const record = isRecord(row) ? row : {};
          const id = typeof record.id === "string" ? record.id : "";
          rows.push(`${table},${id},"${JSON.stringify(row).replace(/"/g, '""')}"`);
        });
      };
      dump("products", data.products);
      dump("meal_templates", data.meal_templates);
      dump("meal_template_items", data.meal_template_items);
      dump("daily_logs", data.daily_logs);
      dump("daily_log_items", data.daily_log_items);
      dump("weight_logs", data.weight_logs);
      dump("workout_plans", data.workout_plans);
      dump("workout_day_plans", data.workout_day_plans);
      dump("workout_blocks", data.workout_blocks);
      dump("workout_exercise_plans", data.workout_exercise_plans);
      dump("workout_session_logs", data.workout_session_logs);
      dump("workout_exercise_logs", data.workout_exercise_logs);
      dump("workout_sets", data.workout_sets);
      downloadFile(`macro-export-${Date.now()}.csv`, rows.join("\n"), "text/csv");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Could not export CSV"));
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
      <div className="space-y-2">
        <button
          onClick={exportJson}
          className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/50"
        >
          <FileJson className="h-5 w-5 text-primary" />
          <span className="font-medium">Export as JSON</span>
        </button>
        <button
          onClick={exportCsv}
          className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:border-primary/50"
        >
          <Download className="h-5 w-5 text-primary" />
          <span className="font-medium">Export as CSV</span>
        </button>
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

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
