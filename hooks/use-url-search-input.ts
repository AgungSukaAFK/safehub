"use client";

// Kotak cari yang tersinkron ke URL dengan debounce (port ga-web hooks/use-url-search-input.ts).
// Aturan: push ke URL HANYA dari ketikan user (setelah debounce). Kalau URL berubah dari luar (Back,
// Reset filter), nilai input mengikuti URL TANPA push, kecuali user sedang mengetik. Kalau tidak,
// tombol Back "dibatalkan" dan Chrome menandai entri history sebagai skippable.

import { useCallback, useEffect, useRef, useState } from "react";

export function useUrlSearchInput(urlValue: string, onCommit: (value: string) => void, delay = 400) {
  const [value, setValue] = useState(urlValue);
  const [lastUrl, setLastUrl] = useState(urlValue);
  const [typing, setTyping] = useState(false);
  const timer = useRef<number | null>(null);
  const commitRef = useRef(onCommit);
  const urlRef = useRef(urlValue);

  useEffect(() => {
    commitRef.current = onCommit;
    urlRef.current = urlValue;
  });

  // URL berubah dari luar → ikuti (pola derived state saat render, tanpa effect)
  if (urlValue !== lastUrl) {
    setLastUrl(urlValue);
    if (!typing) setValue(urlValue);
  }

  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      setTyping(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setTyping(false);
        if (next.trim() !== urlRef.current) commitRef.current(next.trim());
      }, delay);
    },
    [delay],
  );

  /** Kosongkan tanpa push (tombol Reset yang sudah bernavigasi sendiri). */
  const reset = useCallback((next = "") => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setTyping(false);
    setValue(next);
  }, []);

  return [value, onChange, reset, typing] as const;
}
