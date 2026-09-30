"use client";

import { useCallback, useRef, useState } from "react";

/**
 * useSubmitting — guards an async action so the same button can't fire it
 * twice in parallel. Tracks an optional `kind` so different buttons can
 * share one lock while only the active one renders a spinner.
 *
 *   const { submitting, submit } = useSubmitting<"save" | "delete">();
 *   <button disabled={!!submitting} onClick={() => submit("save", saveApi)}>
 *     {submitting === "save" ? <Spinner/> : "Save"}
 *   </button>
 *
 * The ref-based gate is intentional: React state updates are async, so
 * relying on the `submitting` value alone could let a double-click slip
 * through before the re-render lands.
 */
export function useSubmitting<K extends string = string>() {
  const [submitting, setSubmitting] = useState<K | null>(null);
  const inFlightRef = useRef<K | null>(null);

  const submit = useCallback(async <T>(kind: K, fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = kind;
    setSubmitting(kind);
    try {
      return await fn();
    } finally {
      inFlightRef.current = null;
      setSubmitting(null);
    }
  }, []);

  return { submitting, submit };
}
