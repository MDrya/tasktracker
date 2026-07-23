import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { fetchBoard } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import { daysUntil, effectiveDueDate } from "@/lib/urgency";

export const dynamic = "force-dynamic";

/**
 * Daily due-date digest, triggered by Vercel Cron (see vercel.json).
 * Sends one push notification per subscribed device summarizing how many
 * active (non-archived) orders are overdue or due today. Subscriptions
 * that the push service reports as gone (404/410) are pruned.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return NextResponse.json({ error: "Push not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const tasks = await fetchBoard();
  const active = tasks.filter((t) => t.archived_at === null);
  const effectiveDays = active
    .map((t) => effectiveDueDate(t))
    .filter((d): d is string => d !== null)
    .map(daysUntil);
  const overdue = effectiveDays.filter((d) => d < 0).length;
  const dueToday = effectiveDays.filter((d) => d === 0).length;

  if (overdue === 0 && dueToday === 0) {
    return NextResponse.json({ sent: 0, reason: "nothing due" });
  }

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);
  const payload = JSON.stringify({
    title: "TaskTracker",
    body: parts.join(" · "),
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
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) stale.push(sub.endpoint);
      }
    })
  );

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ sent, pruned: stale.length });
}
