import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="app-content safe-top mx-auto max-w-md px-4 pt-6">
        {title && (
          <header className="flex items-center justify-between mb-5">
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            {action}
          </header>
        )}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
