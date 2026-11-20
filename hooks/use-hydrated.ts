import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false saat render server & hydration, true setelahnya (pengganti pola `mounted` state). */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
