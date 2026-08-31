"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
      <path d="M10 2a1 1 0 0 1 1 1v.6a5.5 5.5 0 0 1 4.5 5.4v2.7l1.3 2.2a1 1 0 0 1-.86 1.5H4.06a1 1 0 0 1-.86-1.5L4.5 11.7V9A5.5 5.5 0 0 1 9 3.6V1a1 1 0 0 1 1-1Zm0 17.5a2.25 2.25 0 0 0 2.24-2h-4.48A2.25 2.25 0 0 0 10 19.5Z" />
    </svg>
  );
}

/**
 * Bell button to opt this device in/out of due-date push alerts.
 *
 * On an iPhone still running in a Safari tab the push API doesn't exist
 * yet, so the button explains how to install the app rather than
 * disappearing — a missing button just looks like the feature is broken.
 */
export default function PushToggle({
  createdBy,
}: {
  createdBy: string | null;
}) {
  const {
    supported,
    needsInstall,
    subscribed,
    permissionDenied,
    busy,
    subscribe,
    unsubscribe,
  } = usePushSubscription(createdBy);
  const [showHelp, setShowHelp] = useState(false);
  const [showDenied, setShowDenied] = useState(false);

  if (needsInstall) {
    return (
      <>
        <button
          onClick={() => setShowHelp(true)}
          aria-label="How to turn on due-date alerts on iPhone"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white text-neutral-300"
        >
          <BellIcon />
        </button>

        {showHelp && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
            onClick={() => setShowHelp(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-white p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-base font-semibold">
                Turn on alerts on iPhone
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                iPhone only allows notifications once the app is added to your
                Home Screen. It takes a few seconds:
              </p>
              <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-neutral-700">
                <li>Tap the Share button at the bottom of Safari</li>
                <li>Choose “Add to Home Screen”, then “Add”</li>
                <li>Open KonveksiTracker from the new Home Screen icon</li>
                <li>Tap the bell here and allow notifications</li>
              </ol>
              <p className="mt-3 text-xs text-neutral-400">
                Needs iOS 16.4 or newer. Opening the app from Safari instead of
                the Home Screen icon will hide the bell again.
              </p>
              <button
                onClick={() => setShowHelp(false)}
                className="mt-4 min-h-11 w-full rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!supported) return null;

  return (
    <>
      <button
        onClick={
          permissionDenied
            ? () => setShowDenied(true)
            : subscribed
              ? unsubscribe
              : subscribe
        }
        disabled={busy}
        aria-label={
          permissionDenied
            ? "Notifications are blocked — how to re-enable"
            : subscribed
              ? "Turn off due-date alerts"
              : "Turn on due-date alerts"
        }
        title={subscribed ? "Due-date alerts on" : "Get due-date alerts"}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-full disabled:opacity-50 ${
          subscribed
            ? "bg-indigo-100 text-indigo-600"
            : "bg-white text-neutral-400"
        }`}
      >
        <BellIcon />
      </button>

      {showDenied && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={() => setShowDenied(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Notifications are blocked</h2>
            <p className="mt-1 text-sm text-neutral-500">
              This device refused notifications earlier, and the phone won’t ask
              again. Turn them back on in your device settings:
            </p>
            <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-neutral-700">
              <li>Open Settings → Notifications</li>
              <li>Find KonveksiTracker in the list</li>
              <li>Turn on “Allow Notifications”</li>
              <li>Come back here and tap the bell</li>
            </ol>
            <button
              onClick={() => setShowDenied(false)}
              className="mt-4 min-h-11 w-full rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
