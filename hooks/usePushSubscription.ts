"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

/** iPadOS 13+ reports itself as a Mac, so touch points are the giveaway. */
function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** True once the app is launched from the Home Screen rather than a tab. */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own non-standard flag, still the only reliable one on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

/**
 * Opt-in browser push for due-date alerts. Per-device, not per-person —
 * there's no login, so each browser that subscribes gets the daily digest
 * independently (see app/api/cron/due-digest).
 *
 * iOS only exposes the push API to a site installed to the Home Screen, so
 * `needsInstall` separates "this iPhone can do push once installed" from
 * "this browser can't do push at all". Without that distinction the button
 * would simply vanish on iPhone, which reads as a broken feature.
 */
export function usePushSubscription(createdBy: string | null) {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hasKey = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const hasApi = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(hasApi && hasKey);
    setNeedsInstall(!hasApi && hasKey && isIOS() && !isStandalone());
    // A refusal from an earlier visit persists, so reflect it on load
    // rather than waiting for a tap that can no longer prompt.
    if ("Notification" in window) {
      setPermissionDenied(Notification.permission === "denied");
    }
  }, []);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(sub !== null);
    });
  }, [supported]);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // iOS only ever shows the prompt once. After a refusal the request
        // resolves "denied" immediately and for good, so without saying so
        // the bell would look dead every time it was tapped.
        setPermissionDenied(permission === "denied");
        return;
      }
      setPermissionDenied(false);
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), createdBy }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }, [createdBy]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    needsInstall,
    subscribed,
    permissionDenied,
    busy,
    subscribe,
    unsubscribe,
  };
}
