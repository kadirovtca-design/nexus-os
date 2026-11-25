"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger"><AlertTriangle className="size-5" /></div>
      <h2 className="mt-4 text-lg font-semibold text-fg">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-fg-subtle">{error.message || "An unexpected error occurred."}</p>
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
