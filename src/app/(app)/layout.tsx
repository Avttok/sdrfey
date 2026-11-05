import { Suspense } from "react";
import { NavBusy } from "@/components/nav-busy";
import { Presence } from "@/components/presence";
import { ToastProvider } from "@/components/toast";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/modules/auth/guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <Presence />
        <Suspense fallback={null}><NavBusy /></Suspense>
        <AppHeader user={user} />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-24 sm:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
