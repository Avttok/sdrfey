"use client";

import { ErrorRecover } from "@/components/error-recover";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}><ErrorRecover reset={reset} /></body>
    </html>
  );
}
