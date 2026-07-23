"use client";

import { usePushSubscription } from "@/hooks/usePushSubscription";

/** Small bell button to opt this device in/out of due-date push alerts. */
export default function PushToggle({
  createdBy,
}: {
  createdBy: string | null;
}) {
  const { supported, subscribed, busy, subscribe, unsubscribe } =
    usePushSubscription(createdBy);

  if (!supported) return null;

  return (
    <button
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={busy}
      aria-label={subscribed ? "Turn off due-date alerts" : "Turn on due-date alerts"}
      title={subscribed ? "Due-date alerts on" : "Get due-date alerts"}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-50 ${
        subscribed ? "bg-indigo-100 text-indigo-600" : "bg-white text-neutral-400"
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
        <path d="M10 2a1 1 0 0 1 1 1v.6a5.5 5.5 0 0 1 4.5 5.4v2.7l1.3 2.2a1 1 0 0 1-.86 1.5H4.06a1 1 0 0 1-.86-1.5L4.5 11.7V9A5.5 5.5 0 0 1 9 3.6V1a1 1 0 0 1 1-1Zm0 17.5a2.25 2.25 0 0 0 2.24-2h-4.48A2.25 2.25 0 0 0 10 19.5Z" />
      </svg>
    </button>
  );
}
