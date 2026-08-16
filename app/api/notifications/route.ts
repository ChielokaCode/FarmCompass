import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { apiUser, serverError } from "@/lib/http";
import { getDb } from "@/lib/mongodb";
import { syncOverdueTaskNotifications } from "@/lib/tasks";
import type { InAppNotification } from "@/types";

export async function GET() {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    await syncOverdueTaskNotifications(auth.user.id);
    const db = await getDb();
    const notifications = await db.collection<InAppNotification>("notifications")
      .find({ userId: auth.user.id, resolvedAt: null })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    const unreadCount = notifications.filter(item => !item.readAt).length;
    return NextResponse.json({
      unreadCount,
      notifications: notifications.map(item => ({
        id: String(item._id),
        type: item.type,
        title: item.title,
        message: item.message,
        href: item.href,
        taskId: item.taskId,
        cropSlug: item.cropSlug,
        readAt: item.readAt ?? null,
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(req: Request) {
  const auth = await apiUser("FARMER");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const db = await getDb();
    const now = new Date();
    if (body.all === true) {
      await db.collection<InAppNotification>("notifications").updateMany({ userId: auth.user.id, resolvedAt: null, readAt: null }, { $set: { readAt: now, updatedAt: now } });
      return NextResponse.json({ ok: true });
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid notification identifier." }, { status: 400 });
    await db.collection<InAppNotification>("notifications").updateOne({ _id: new ObjectId(id), userId: auth.user.id }, { $set: { readAt: now, updatedAt: now } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
