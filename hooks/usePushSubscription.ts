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
  const [error, setError] = useState<string | null>(null);
  // Stable, so the toast's auto-dismiss timer isn't restarted every render.
  const clearError = useCallback(() => setError(null), []);

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
    setError(null);
    let sub: PushSubscription | null = null;
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
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), createdBy }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setSubscribed(true);
    } catch {
      // The server never stored this device, so it would never be sent an
      // alert. Undo the browser side too, so the bell honestly shows "off".
      await sub?.unsubscribe().catch(() => {});
      setSubscribed(false);
      setError("Couldn't turn on alerts. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [createdBy]);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Unsubscribing in the browser is what actually stops alerts; a
        // leftover server row is pruned the next time a send gets 410 Gone.
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Couldn't turn off alerts. Try again.");
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
    error,
    clearError,
    subscribe,
    unsubscribe,
  };
}
