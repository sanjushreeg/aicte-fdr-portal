// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Cleaning up old database tables...");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminderRule.deleteMany();
  await prisma.discrepancy.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.observation.deleteMany();
  await prisma.releaseRequest.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();

  console.log("⚙️ Creating Reminder Rules with channel, escalateAfterDays, escalateToRole...");
  const rules = [
    { daysBefore: 90, channel: "EMAIL", escalateAfterDays: 14, escalateToRole: "APPROVING_AUTHORITY" },
    { daysBefore: 60, channel: "IN_APP_EMAIL", escalateAfterDays: 10, escalateToRole: "APPROVING_AUTHORITY" },
    { daysBefore: 30, channel: "IN_APP_EMAIL", escalateAfterDays: 7, escalateToRole: "APPROVING_AUTHORITY" },
    { daysBefore: 15, channel: "IN_APP_EMAIL", escalateAfterDays: 5, escalateToRole: "APPROVING_AUTHORITY" },
    { daysBefore: 7, channel: "SMS_IN_APP_EMAIL", escalateAfterDays: 3, escalateToRole: "APPROVING_AUTHORITY" },
  ];
  for (const r of rules) {
    await prisma.reminderRule.create({ data: { ...r, enabled: true } });
  }

  // 40 Indian states / UTs
  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman & Nicobar", "Chandigarh",
    "Dadra & Nagar Haveli", "Daman & Diu", "Delhi", "Lakshadweep", "Puducherry",
    "Jammu & Kashmir", "Ladakh", "Telangana", "Madhya Pradesh", "Uttar Pradesh"
  ];

  const collegePrefixes = [
    "National Institute of Technology", "Government Engineering College",
    "Indian Institute of Science & Technology", "Apex Institute of Management",
    "Bharti Vidyapeeth Institute", "Sardar Patel College of Engineering",
    "Heritage Institute of Technology", "Vidyalankar Institute",
    "Kalinga Technical Campus", "Rajiv Gandhi Memorial Institute"
  ];

  console.log("🏫 Creating 40 institutions across Indian states...");
  const institutions = [];
  for (let i = 0; i < 40; i++) {
    const prefix = collegePrefixes[i % collegePrefixes.length];
    const state = states[i % states.length];
    const inst = await prisma.institution.create({
      data: {
        aicteId: `1-${10000000 + i}`,
        name: `${prefix}, ${state} (AICTE Campus ${i + 1})`,
        state: state,
      },
    });
    institutions.push(inst);
  }

  // Use bcrypt for secure password hashing
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  console.log("👥 Creating 12 demo users across all 4 roles...");
  const userDefs = [
    { name: "Dr. Rajesh Sharma (Admin)", email: "admin0@example.com", role: "ADMIN", instIdx: null },
    { name: "Smt. Sunita Rao (Admin Bureau)", email: "admin1@example.com", role: "ADMIN", instIdx: null },
    { name: "Shri. Arvind Kumar (Scrutiny Lead)", email: "scrutinyofficer1@example.com", role: "SCRUTINY_OFFICER", instIdx: null },
    { name: "Dr. Meenakshi Sundaram (Scrutiny Officer)", email: "scrutinyofficer2@example.com", role: "SCRUTINY_OFFICER", instIdx: null },
    { name: "Prof. Vikram Malhotra (Scrutiny Desk)", email: "scrutinyofficer3@example.com", role: "SCRUTINY_OFFICER", instIdx: null },
    { name: "Dr. K. S. Radhakrishnan (Approving Member)", email: "approving_authority2@example.com", role: "APPROVING_AUTHORITY", instIdx: null },
    { name: "Dr. Anita Desai (Director Approval)", email: "approving_authority3@example.com", role: "APPROVING_AUTHORITY", instIdx: null },
    { name: "Registrar - Institution 0 (NIT AP)", email: "institution0@example.com", role: "INSTITUTION", instIdx: 0 },
    { name: "Registrar - Institution 1 (GEC Arunachal)", email: "institution1@example.com", role: "INSTITUTION", instIdx: 1 },
    { name: "Finance Officer - Institution 2 (Assam)", email: "institution2@example.com", role: "INSTITUTION", instIdx: 2 },
    { name: "Authorized Signatory - Institution 3 (Bihar)", email: "institution3@example.com", role: "INSTITUTION", instIdx: 3 },
    { name: "Dean Admin - Institution 4 (Chhattisgarh)", email: "institution4@example.com", role: "INSTITUTION", instIdx: 4 },
  ];

  const demoUsers = [];
  for (const u of userDefs) {
    const instId = u.instIdx !== null ? institutions[u.instIdx].id : null;
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: hash("Password123"),
        role: u.role,
        institutionId: instId,
      },
    });
    demoUsers.push(user);
  }

  const banks = [
    { name: "State Bank of India", branch: "New Delhi Main Branch" },
    { name: "Punjab National Bank", branch: "Connaught Place Branch" },
    { name: "Canara Bank", branch: "Bangalore Town Hall Branch" },
    { name: "HDFC Bank", branch: "Bandra Kurla Complex Branch" },
    { name: "ICICI Bank", branch: "Nariman Point Branch" },
    { name: "Bank of Baroda", branch: "Baroda Mandvi Branch" }
  ];

  const statuses = [
    "SUBMITTED", "VERIFIED", "MISMATCH", "ACTIVE",
    "EXPIRING_SOON", "MATURED", "EXPIRED", "RENEWED",
    "REPLACED", "RELEASED", "REJECTED"
  ];

  console.log("📜 Creating 120 baseline instruments with Document and DocumentVersion...");
  const instAdmin = demoUsers[0];
  const instUsers = demoUsers.filter(u => u.role === "INSTITUTION");

  const createdInstruments = [];
  const now = new Date();

  for (let i = 0; i < 120; i++) {
    const institution = institutions[i % institutions.length];
    const assignedCreator = instUsers.find(u => u.institutionId === institution.id) || instAdmin;
    const bank = banks[i % banks.length];
    const type = i % 3 === 0 ? "SECURITY_DEPOSIT" : "FDR";
    const refNum = `FDR-${2024000 + i}`;
    const amount = 500000 + (i * 25000) % 4500000;
    
    let status = statuses[i % statuses.length];
    const issueDate = new Date(now.getTime() - (365 + (i * 10)) * 24 * 60 * 60 * 1000);
    let maturityDate;

    if (status === "MATURED" || status === "EXPIRED") {
      maturityDate = new Date(now.getTime() - (15 + (i % 60)) * 24 * 60 * 60 * 1000);
    } else if (status === "EXPIRING_SOON") {
      maturityDate = new Date(now.getTime() + (20 + (i % 60)) * 24 * 60 * 60 * 1000);
    } else {
      maturityDate = new Date(now.getTime() + (180 + (i * 15)) * 24 * 60 * 60 * 1000);
    }

    const verifiedByBank = (status === "VERIFIED" || status === "MISMATCH" || status === "ACTIVE");

    const inst = await prisma.instrument.create({
      data: {
        type,
        referenceNumber: refNum,
        bankName: bank.name,
        bankBranch: bank.branch,
        amount: amount,
        issueDate,
        maturityDate,
        status,
        institutionId: institution.id,
        createdById: assignedCreator.id,
        verifiedByBank,
      },
    });

    createdInstruments.push(inst);

    // Create Document record
    const doc = await prisma.document.create({
      data: {
        instrumentId: inst.id,
        name: `${type}_Certificate_${refNum}.pdf`,
        category: "FDR_COPY",
        currentVersion: 1,
      },
    });

    // Create DocumentVersion record
    await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        filePath: `/encrypted/vault/${inst.id}/${refNum}_v1.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 245000 + (i * 1234) % 500000,
        sha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85${i % 10}`,
        uploadedById: assignedCreator.id,
      },
    });

    // If verified or active, add verification record
    if (verifiedByBank) {
      await prisma.verification.create({
        data: {
          instrumentId: inst.id,
          requestedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          status: status === "MISMATCH" ? "MISMATCH" : "SUCCESS",
          source: "MOCK_CBS_ADAPTER",
          bankData: JSON.stringify({
            referenceNumber: refNum,
            bankName: bank.name,
            confirmedAmount: amount,
            status: "VERIFIED_ACTIVE",
          }),
        },
      });
    }
  }

  console.log("🌱 Planting required explicit edge cases...");

  // Case 1: Amount mismatch with bank verification and discrepancy record
  const mismatchInst = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: "FDR-MISMATCH-2026",
      bankName: "State Bank of India",
      bankBranch: "Parliament Street, New Delhi",
      amount: 2500000.0, // Submitted amount: 25 Lakhs
      issueDate: new Date("2024-01-10"),
      maturityDate: new Date("2027-01-10"),
      status: "MISMATCH",
      institutionId: institutions[0].id,
      createdById: instUsers[0].id,
      verifiedByBank: true,
    },
  });

  const mismatchDoc = await prisma.document.create({
    data: {
      instrumentId: mismatchInst.id,
      name: "FDR_Mismatch_Original_Copy.pdf",
      category: "FDR_COPY",
      currentVersion: 1,
    },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: mismatchDoc.id,
      version: 1,
      filePath: `/encrypted/vault/${mismatchInst.id}/mismatch_v1.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 312000,
      sha256: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
      uploadedById: instUsers[0].id,
    },
  });

  // Multiple verifications demonstrating re-verification history
  await prisma.verification.create({
    data: {
      instrumentId: mismatchInst.id,
      requestedAt: new Date("2024-01-12T10:00:00Z"),
      completedAt: new Date("2024-01-12T10:05:00Z"),
      status: "MISMATCH",
      source: "MOCK_CBS_ADAPTER",
      bankData: JSON.stringify({
        referenceNumber: "FDR-MISMATCH-2026",
        bankName: "State Bank of India",
        bankBranch: "Parliament Street, New Delhi",
        confirmedAmount: 2000000.0,
        issueDate: "2024-01-10",
        maturityDate: "2027-01-10",
        status: "ACTIVE_IN_CORE_BANKING",
        verificationApi: "SBI_CBS_V3_MOCK",
      }),
    },
  });

  await prisma.discrepancy.create({
    data: {
      instrumentId: mismatchInst.id,
      code: "AMOUNT_MISMATCH",
      severity: "critical",
      status: "OPEN",
      details: JSON.stringify({
        field: "amount",
        submittedAmount: 2500000.0,
        bankConfirmedAmount: 2000000.0,
        variance: -500000.0,
        description: "Submitted amount exceeds core banking deposit by INR 5,00,000.00",
      }),
    },
  });

  // Case 2: Exact days-to-maturity cases: 7 days, 30 days, 90 days
  const maturityDays = [7, 30, 90];
  for (const days of maturityDays) {
    const matDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const matureInst = await prisma.instrument.create({
      data: {
        type: "FDR",
        referenceNumber: `FDR-EXPIRE-${days}D-TARGET`,
        bankName: "Punjab National Bank",
        bankBranch: "Connaught Place Branch",
        amount: 1500000.0,
        issueDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        maturityDate: matDate,
        status: "EXPIRING_SOON",
        institutionId: institutions[1].id,
        createdById: instUsers[1].id,
        verifiedByBank: true,
      },
    });

    const mDoc = await prisma.document.create({
      data: {
        instrumentId: matureInst.id,
        name: `FDR_Bond_${days}days.pdf`,
        category: "FDR_COPY",
        currentVersion: 1,
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: mDoc.id,
        version: 1,
        filePath: `/encrypted/vault/${matureInst.id}/bond_v1.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 198000,
        sha256: `c1c2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef${days}`,
        uploadedById: instUsers[1].id,
      },
    });
  }

  // Case 3: Duplicate FDR number pair
  const duplicateFdrNumber = "FDR-DUP-999888";
  const dupInst1 = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: duplicateFdrNumber,
      bankName: "HDFC Bank",
      bankBranch: "Bandra Kurla Complex",
      amount: 1000000.0,
      issueDate: new Date("2023-05-15"),
      maturityDate: new Date("2026-05-15"),
      status: "ACTIVE",
      institutionId: institutions[2].id, // Institution 2 (Assam)
      createdById: instUsers[2].id,
      verifiedByBank: true,
    },
  });
  const dupDoc1 = await prisma.document.create({
    data: {
      instrumentId: dupInst1.id,
      name: "FDR_Original_Assam.pdf",
      category: "FDR_COPY",
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: dupDoc1.id,
      version: 1,
      filePath: `/encrypted/vault/${dupInst1.id}/assam_v1.pdf`,
      uploadedById: instUsers[2].id,
    },
  });

  const dupInst2 = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: duplicateFdrNumber,
      bankName: "HDFC Bank",
      bankBranch: "Bandra Kurla Complex",
      amount: 1000000.0,
      issueDate: new Date("2023-06-20"),
      maturityDate: new Date("2026-06-20"),
      status: "SUBMITTED",
      institutionId: institutions[3].id, // Institution 3 (Bihar)
      createdById: instUsers[3].id,
      verifiedByBank: false,
    },
  });
  const dupDoc2 = await prisma.document.create({
    data: {
      instrumentId: dupInst2.id,
      name: "FDR_Submitted_Bihar.pdf",
      category: "FDR_COPY",
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: dupDoc2.id,
      version: 1,
      filePath: `/encrypted/vault/${dupInst2.id}/bihar_v1.pdf`,
      uploadedById: instUsers[3].id,
    },
  });

  await prisma.discrepancy.create({
    data: {
      instrumentId: dupInst2.id,
      code: "DUPLICATE_FDR",
      severity: "critical",
      status: "OPEN",
      details: JSON.stringify({
        field: "referenceNumber",
        duplicateWithInstrumentId: dupInst1.id,
        duplicateWithInstitution: institutions[2].name,
        description: `Duplicate FDR reference number detected! Already registered under ${institutions[2].name}`,
      }),
    },
  });

  // Case 4: Missing mandatory document instrument
  const missingDocInst = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: "FDR-MISSING-DOC-FLAG",
      bankName: "Canara Bank",
      bankBranch: "Bangalore Town Hall",
      amount: 750000.0,
      issueDate: new Date("2024-03-01"),
      maturityDate: new Date("2027-03-01"),
      status: "SUBMITTED",
      institutionId: institutions[4].id,
      createdById: instUsers[4].id,
      verifiedByBank: false,
    },
  });
  // Intentionally NO Document and NO DocumentVersion records created for missingDocInst

  await prisma.discrepancy.create({
    data: {
      instrumentId: missingDocInst.id,
      code: "MISSING_DOCUMENT",
      severity: "high",
      status: "OPEN",
      details: JSON.stringify({
        field: "documents",
        description: "Mandatory deposit receipt copy not uploaded",
      }),
    },
  });

  // Case 5: Renewal Chain (Original -> Renewed FDR) with multi-version documents
  const origInst = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: "FDR-ORIG-CHAIN-001",
      bankName: "Bank of Baroda",
      bankBranch: "Baroda Mandvi Branch",
      amount: 3000000.0,
      issueDate: new Date("2021-08-01"),
      maturityDate: new Date("2024-08-01"),
      status: "RENEWED",
      institutionId: institutions[0].id,
      createdById: instUsers[0].id,
      verifiedByBank: true,
    },
  });
  const chainDoc = await prisma.document.create({
    data: {
      instrumentId: origInst.id,
      name: "FDR_Original_Fixed_Deposit.pdf",
      category: "FDR_COPY",
      currentVersion: 2,
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: chainDoc.id,
      version: 1,
      filePath: `/encrypted/vault/${origInst.id}/chain_orig_v1.pdf`,
      uploadedById: instUsers[0].id,
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: chainDoc.id,
      version: 2,
      filePath: `/encrypted/vault/${origInst.id}/chain_orig_v2_notarized.pdf`,
      uploadedById: instUsers[0].id,
    },
  });

  const renewedInst = await prisma.instrument.create({
    data: {
      type: "FDR",
      referenceNumber: "FDR-RENEWED-CHAIN-002",
      bankName: "Bank of Baroda",
      bankBranch: "Baroda Mandvi Branch",
      amount: 3000000.0,
      issueDate: new Date("2024-08-01"),
      maturityDate: new Date("2027-08-01"),
      status: "ACTIVE",
      institutionId: institutions[0].id,
      createdById: instUsers[0].id,
      verifiedByBank: true,
      parentId: origInst.id, // Linked parent!
    },
  });
  const renewDoc = await prisma.document.create({
    data: {
      instrumentId: renewedInst.id,
      name: "FDR_Renewal_Receipt_2024.pdf",
      category: "RENEWAL_LETTER",
      currentVersion: 1,
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: renewDoc.id,
      version: 1,
      filePath: `/encrypted/vault/${renewedInst.id}/renewal_receipt_v1.pdf`,
      uploadedById: instUsers[0].id,
    },
  });

  // Case 6: Pending Release Request with Institution & Instrument
  const releaseInst = await prisma.instrument.create({
    data: {
      type: "SECURITY_DEPOSIT",
      referenceNumber: "SEC-DEP-RELEASE-PENDING-99",
      bankName: "State Bank of India",
      bankBranch: "New Delhi Main Branch",
      amount: 5000000.0,
      issueDate: new Date("2018-09-01"),
      maturityDate: new Date("2026-09-01"),
      status: "ACTIVE",
      institutionId: institutions[1].id,
      createdById: instUsers[1].id,
      verifiedByBank: true,
    },
  });
  const relDoc = await prisma.document.create({
    data: {
      instrumentId: releaseInst.id,
      name: "Security_Deposit_Bond.pdf",
      category: "DEPOSIT_CONFIRMATION",
      currentVersion: 1,
    },
  });
  await prisma.documentVersion.create({
    data: {
      documentId: relDoc.id,
      version: 1,
      filePath: `/encrypted/vault/${releaseInst.id}/sec_v1.pdf`,
      uploadedById: instUsers[1].id,
    },
  });

  await prisma.releaseRequest.create({
    data: {
      instrumentId: releaseInst.id,
      requestedById: instUsers[1].id,
      status: "SUBMITTED",
      remarks: "Institution course closure approved under AICTE Bureau order #AICTE/2026/REL/4401. Requesting unconditional release of security deposit.",
    },
  });

  // Seed 14 Notifications
  console.log("🔔 Seeding 14 notifications across roles...");
  const notificationsData = [
    {
      userId: demoUsers[0].id,
      title: "Duplicate FDR Alert Detected",
      body: "FDR #FDR-DUP-999888 was submitted by Institution 3, which matches an active record for Institution 2.",
      read: false,
    },
    {
      userId: demoUsers[0].id,
      title: "Daily Maturity Scan Complete",
      body: "System scan completed. 3 instruments approaching 7, 30, and 90-day threshold deadlines.",
      read: true,
    },
    {
      userId: demoUsers[2].id,
      title: "Bank Verification Mismatch: FDR-MISMATCH-2026",
      body: "Discrepancy flagged: Submitted Rs 25,00,000 vs Bank confirmed Rs 20,00,000. Immediate scrutiny review required.",
      read: false,
    },
    {
      userId: demoUsers[2].id,
      title: "Missing Document Notice: FDR-MISSING-DOC-FLAG",
      body: "New submission from Institution 4 has missing deposit copy. Query generated to institution.",
      read: false,
    },
    {
      userId: demoUsers[3].id,
      title: "Release Request Assigned for Scrutiny Checklist",
      body: "Security deposit SEC-DEP-RELEASE-PENDING-99 submitted for release review by Institution 1.",
      read: false,
    },
    {
      userId: demoUsers[5].id,
      title: "Pending Release Approval Escalation",
      body: "Release request #SEC-DEP-RELEASE-PENDING-99 has completed preliminary scrutiny and awaits approval.",
      read: false,
    },
    {
      userId: demoUsers[5].id,
      title: "Quarterly Deposit Exposure Report Ready",
      body: "State-wise exposure summary updated: INR 48.5 Crore held across 40 institutions.",
      read: true,
    },
    {
      userId: instUsers[0].id,
      title: "FDR Renewal Recorded Successfully",
      body: "Your renewal instrument FDR-RENEWED-CHAIN-002 has been linked with original FDR-ORIG-CHAIN-001.",
      read: true,
    },
    {
      userId: instUsers[0].id,
      title: "Verification Discrepancy Observation Logged",
      body: "Scrutiny bureau recorded an observation regarding amount discrepancy on FDR-MISMATCH-2026.",
      read: false,
    },
    {
      userId: instUsers[1].id,
      title: "Urgent: FDR Expiring in 7 Days",
      body: "Instrument FDR-EXPIRE-7D-TARGET is maturing within 7 days. Please upload renewal or extension receipt.",
      read: false,
    },
    {
      userId: instUsers[1].id,
      title: "Release Request #SEC-DEP-RELEASE-PENDING-99 Under Review",
      body: "Your release request has been assigned to Regulation Bureau Scrutiny Officer.",
      read: true,
    },
    {
      userId: instUsers[2].id,
      title: "FDR Expiring in 30 Days Notice",
      body: "Instrument FDR-EXPIRE-30D-TARGET matures on the scheduled date. Please verify renewal status.",
      read: false,
    },
    {
      userId: instUsers[3].id,
      title: "Submission Query: Duplicate Instrument Number",
      body: "Reference #FDR-DUP-999888 flagged by Scrutiny. Please submit original bank confirmation certificate.",
      read: false,
    },
    {
      userId: instUsers[4].id,
      title: "Document Re-upload Required",
      body: "Submission FDR-MISSING-DOC-FLAG is missing mandatory deposit receipt. Upload required within 7 days.",
      read: false,
    },
  ];

  for (const n of notificationsData) {
    await prisma.notification.create({ data: n });
  }

  // Seed Initial Audit Logs
  console.log("📝 Seeding initial Audit Logs...");
  const auditEntries = [
    {
      action: "LOGIN",
      entity: "User",
      entityId: demoUsers[0].id,
      performedById: demoUsers[0].id,
      ip: "10.0.1.42",
      after: JSON.stringify({ email: demoUsers[0].email, role: "ADMIN" }),
    },
    {
      action: "CREATE",
      entity: "Instrument",
      entityId: mismatchInst.id,
      performedById: instUsers[0].id,
      ip: "192.168.1.10",
      after: JSON.stringify({ referenceNumber: mismatchInst.referenceNumber, amount: mismatchInst.amount }),
    },
    {
      action: "VERIFY",
      entity: "Instrument",
      entityId: mismatchInst.id,
      performedById: demoUsers[2].id,
      ip: "10.0.2.15",
      after: JSON.stringify({ status: "MISMATCH", discrepancyCount: 1 }),
    },
    {
      action: "CREATE",
      entity: "ReleaseRequest",
      entityId: releaseInst.id,
      performedById: instUsers[1].id,
      ip: "192.168.2.22",
      after: JSON.stringify({ instrument: releaseInst.referenceNumber, status: "SUBMITTED" }),
    },
    {
      action: "LOGIN",
      entity: "User",
      entityId: demoUsers[5].id,
      performedById: demoUsers[5].id,
      ip: "10.0.3.8",
      after: JSON.stringify({ email: demoUsers[5].email, role: "APPROVING_AUTHORITY" }),
    },
  ];

  for (const a of auditEntries) {
    await prisma.auditLog.create({ data: a });
  }

  console.log("✅ Seed completed successfully with DocumentVersion, multi-verification, and extended ReminderRules!");
}

main()
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
