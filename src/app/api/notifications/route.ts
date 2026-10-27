import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/serverAuth";

/**
 * GET /api/notifications
 * Returns all notifications for the currently authenticated user.
 */
export async function GET(req: Request) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return NextResponse.json({
    total: notifications.length,
    unreadCount,
    notifications,
  });
}

/**
 * PATCH /api/notifications
 * Marks a notification (or all notifications) as read.
 */
export async function PATCH(req: Request) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { id, all } = body;

  if (all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ success: true, message: "All notifications marked as read." });
  }

  if (id) {
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== user.id) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return NextResponse.json({ success: true, notification: updated });
  }

  return NextResponse.json({ error: "Please specify 'id' or 'all: true'" }, { status: 400 });
}
