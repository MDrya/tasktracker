import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { fetchBoard } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import { describeDue, summarizeDue } from "@/lib/urgency";

export const dynamic = "force-dynamic";

/**
 * Daily due-date digest, triggered by Vercel Cron (see vercel.json).
 *
 * Sends one summary notification per subscribed device rather than one
 * per order, so a busy week can't bury the phone in notifications.
 * Counts come from the same helper the in-app banner uses.
 *
 * Only 404/410 prunes a subscription — those mean the browser cleared its
 * data or uninstalled, so the endpoint is gone for good. Other failures are
 * deliberately left alone: a VAPID key mismatch answers 403 for *every*
 * subscription, so pruning on it would wipe out the whole table over a
 * server misconfiguration.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const summary = summarizeDue(await fetchBoard());
  if (summary.total === 0) {
    return NextResponse.json({ sent: 0, reason: "nothing due" });
  }

  const payload = JSON.stringify({
    title: "KonveksiTracker",
    body: describeDue(summary),
    url: "/",
  });

  const supabase = getSupabase();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error) throw error;

  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    })
  );

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ sent, pruned: stale.length });
}
