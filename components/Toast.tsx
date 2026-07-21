"use client";

import { useEffect } from "react";

/** Bottom error toast; auto-dismisses after a few seconds. */
export default function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <button
        onClick={onDismiss}
        className="pointer-events-auto min-h-11 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white"
      >
        {message}
      </button>
    </div>
  );
}
