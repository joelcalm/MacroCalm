import { Link, useLocation } from "@tanstack/react-router";
import { Apple, ClipboardList, Dumbbell, Settings, UtensilsCrossed } from "lucide-react";

const tabs = [
  { to: "/log", icon: ClipboardList, label: "Log" },
  { to: "/workout", icon: Dumbbell, label: "Workout" },
  { to: "/products", icon: Apple, label: "Products" },
  { to: "/meals", icon: UtensilsCrossed, label: "Meals" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="bottom-nav-safe fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto h-[var(--bottom-nav-height)] max-w-md px-3 pb-2">
        <div className="grid h-full grid-cols-5 rounded-2xl border border-border bg-card/90 shadow-card backdrop-blur-xl">
          {tabs.map((t) => {
            const active = loc.pathname === t.to || loc.pathname.startsWith(`${t.to}/`);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center justify-center py-2.5 text-[10px] font-medium relative"
              >
                <div
                  className={
                    "flex items-center justify-center h-9 w-9 rounded-xl transition-all " +
                    (active
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground")
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <span
                  className={active ? "text-foreground mt-0.5" : "text-muted-foreground mt-0.5"}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
