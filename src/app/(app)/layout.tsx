import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader, SideBarFor } from "@/components/app-header";
import { requireUser } from "@/modules/auth/guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <div className={`min-h-dvh ${user.navLayout === "side" ? "lg:flex" : ""}`}>
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        {user.navLayout === "side" && <SideBarFor user={user} />}
        <div className="min-w-0 flex-1">
          <AppHeader user={user} />
          <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:px-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
