import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { runMaturityReminders } from "@/lib/reminders";
import { AuditService } from "@/lib/audit";

/**
 * POST /api/admin/run-reminders
 *
 * Triggers the maturity reminder scan across all instruments.
 * Creates notifications for institutions and scrutiny officers for instruments
 * reaching 90/60/30/15/7 days before maturity.
 *
 * Restricted to ADMIN role only.
 */
export async function POST(req: Request) {
  const { error, user } = await requireAuth(req, ["ADMIN"]);
  if (error) return error;

  try {
    const result = await runMaturityReminders();

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    await AuditService.log({
      action: "RUN_REMINDERS",
      entity: "System",
      entityId: "MATURITY_REMINDERS",
      performedById: user.id,
      ip: clientIp,
      after: {
        processedInstruments: result.processedInstruments,
        createdNotifications: result.createdNotifications,
        skippedDuplicates: result.skippedDuplicates,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Maturity reminder scan executed. Created ${result.createdNotifications} notifications (${result.skippedDuplicates} duplicate alerts skipped).`,
      result,
    });
  } catch (err: any) {
    console.error("Error executing maturity reminders:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to execute maturity reminder scan" },
      { status: 500 }
    );
  }
}
