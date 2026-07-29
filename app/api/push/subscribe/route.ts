import { NextRequest, NextResponse } from "next/server";
import { deletePushSubscription, savePushSubscription } from "@/lib/data";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { endpoint, keys, createdBy } = body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    createdBy?: string | null;
  };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await savePushSubscription({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    created_by: createdBy ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }
  await deletePushSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
