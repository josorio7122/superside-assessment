import { Outlet } from "@tanstack/react-router";

export function Shell() {
  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-charcoal)]">
      <Outlet />
    </div>
  );
}
