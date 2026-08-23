import type { Macros } from "@/lib/nutrition";
import { fmtCal, fmtMacro } from "@/lib/nutrition";

export function MacroSummaryCard({ macros, label }: { macros: Macros; label?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-surface p-5 shadow-card">
      <div className="absolute -top-24 -right-16 h-56 w-56 glow-ring pointer-events-none" />
      {label && (
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      )}
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-5xl font-bold tracking-tight">
          {fmtCal(macros.calories)}
        </span>
        <span className="text-sm text-muted-foreground">kcal</span>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Protein" value={fmtMacro(macros.protein)} accent="from-fuchsia-400/30" />
        <Stat label="Carbs" value={fmtMacro(macros.carbs)} accent="from-violet-400/30" />
        <Stat label="Fat" value={fmtMacro(macros.fat)} accent="from-purple-400/30" />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-b ${accent} to-transparent p-3 border border-border/60`}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold mt-0.5">
        {value}
        <span className="text-xs text-muted-foreground font-sans ml-0.5">g</span>
      </p>
    </div>
  );
}
