"use client";

import { ErrorRecover } from "@/components/error-recover";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorRecover reset={reset} />;
}
