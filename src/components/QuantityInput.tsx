import { Minus, Plus } from "lucide-react";

export function QuantityInput({
  value,
  onChange,
  step = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - step))}
        className="h-10 w-10 rounded-xl bg-secondary text-foreground flex items-center justify-center active:scale-95"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-10 w-24 rounded-xl bg-input text-center font-display text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          g
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(value + step)}
        className="h-10 w-10 rounded-xl bg-secondary text-foreground flex items-center justify-center active:scale-95"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
