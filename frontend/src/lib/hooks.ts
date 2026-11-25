"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True only in the browser after hydration — without a setState-in-effect round trip. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}
