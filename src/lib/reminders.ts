import prisma from "@/lib/prisma";

export const REMINDER_THRESHOLDS = [90, 60, 30, 15, 7] as const;

export interface ReminderRunResult {
  processedInstruments: number;
  createdNotifications: number;
  skippedDuplicates: number;
  details: Array<{
    instrumentId: string;
    referenceNumber: string;
    threshold: number;
    daysLeft: number;
    notifiedUsersCount: number;
  }>;
}

/**
 * Maturity Reminders Engine
 *
 * Scans active and submitted instruments, computes days to maturity against now,
 * and generates alerts for instruments matching or within warning thresholds (90, 60, 30, 15, 7 days).
 *
 * Dispatches notifications to:
 *   1. All users belonging to the owning institution
 *   2. All Scrutiny Officers in the regulation bureau
 *
 * Strictly prevents duplicate notifications for the same instrument and threshold window.
 */
export async function runMaturityReminders(): Promise<ReminderRunResult> {
  const now = new Date();

  // Find all relevant instruments that have not yet been released, rejected, renewed or replaced
  const instruments = await prisma.instrument.findMany({
    where: {
      status: {
        in: ["ACTIVE", "EXPIRING_SOON", "SUBMITTED", "VERIFIED", "MISMATCH"],
      },
    },
    include: {
      institution: true,
    },
  });

  // Bureau scrutiny officers to alert
  const scrutinyOfficers = await prisma.user.findMany({
    where: { role: "SCRUTINY_OFFICER" },
  });

  let createdNotifications = 0;
  let skippedDuplicates = 0;
  const details: ReminderRunResult["details"] = [];

  for (const inst of instruments) {
    const maturityDate = new Date(inst.maturityDate);
    const diffMs = maturityDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Only process forward-looking instruments within maximum 90-day warning horizon
    if (daysLeft < 0 || daysLeft > 90) {
      continue;
    }

    // Identify applicable threshold: find the smallest threshold that daysLeft is <=
    // e.g. If daysLeft is 6, thresholds [90, 60, 30, 15, 7] all apply, but we evaluate
    // each threshold level to record milestone notifications
    const applicableThresholds = REMINDER_THRESHOLDS.filter((t) => daysLeft <= t);

    // Institution users
    const institutionUsers = await prisma.user.findMany({
      where: { institutionId: inst.institutionId },
    });

    // Combine recipients: institution members + scrutiny officers
    const recipientMap = new Map<string, { id: string; name: string }>();
    for (const u of institutionUsers) {
      recipientMap.set(u.id, { id: u.id, name: u.name });
    }
    for (const u of scrutinyOfficers) {
      recipientMap.set(u.id, { id: u.id, name: u.name });
    }
    const recipients = Array.from(recipientMap.values());

    for (const threshold of applicableThresholds) {
      const alertTitle = `Maturity Alert (${threshold}d): ${inst.referenceNumber}`;
      let notifiedForThreshold = 0;

      for (const recipient of recipients) {
        // Check for existing notification for this user, instrument reference, and threshold
        const existing = await prisma.notification.findFirst({
          where: {
            userId: recipient.id,
            title: alertTitle,
          },
        });

        if (existing) {
          skippedDuplicates++;
          continue;
        }

        const formattedMaturity = maturityDate.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

        await prisma.notification.create({
          data: {
            userId: recipient.id,
            title: alertTitle,
            body: `Security Deposit/FDR ${inst.referenceNumber} (${inst.bankName}, ₹${inst.amount.toLocaleString("en-IN")}) matures in ${daysLeft} days on ${formattedMaturity}. Owned by ${inst.institution?.name || "Institution"}.`,
            read: false,
          },
        });

        createdNotifications++;
        notifiedForThreshold++;
      }

      if (notifiedForThreshold > 0) {
        details.push({
          instrumentId: inst.id,
          referenceNumber: inst.referenceNumber,
          threshold,
          daysLeft,
          notifiedUsersCount: notifiedForThreshold,
        });
      }
    }

    // Automatically transition ACTIVE instruments within warning horizon to EXPIRING_SOON
    if (inst.status === "ACTIVE" && daysLeft <= 90) {
      await prisma.instrument.update({
        where: { id: inst.id },
        data: { status: "EXPIRING_SOON" },
      });
    }
  }

  return {
    processedInstruments: instruments.length,
    createdNotifications,
    skippedDuplicates,
    details,
  };
}
