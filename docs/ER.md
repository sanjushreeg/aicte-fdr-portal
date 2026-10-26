# Entity-Relationship Diagram (ERD) - AICTE FDR Portal

## Architecture Overview
The database schema is designed for SQLite compatibility (enums stored as validated strings, structured payloads as JSON strings).

Key architectural tenets:
1. **Logical Document vs Physical Versioning**: `Document` holds metadata and logical state, while immutable physical file uploads and checksums reside in `DocumentVersion` (with unique `(documentId, version)` constraint).
2. **One-to-Many Bank Verifications**: `Verification` records every verification attempt, source adapter (`MOCK_BANK_API`, `MANUAL`), and confirmed banking payload.
3. **Discrepancy as Single Source of Truth**: `Discrepancy` tracks all amount mismatches, duplicate FDR detection, missing documents, and resolution audit trails with an optional link to `Verification`.
4. **Performance Indexes**: Strategic indexes on high-frequency query fields: `Instrument(status)`, `Instrument(maturityDate)`, `Instrument(institutionId)`, and `Discrepancy(status)`.

---

```mermaid
erDiagram
    Institution ||--o{ User : "employs"
    Institution ||--o{ Instrument : "owns"
    User ||--o{ Instrument : "creates (createdBy)"
    User ||--o{ DocumentVersion : "uploads (uploadedBy)"
    User ||--o{ ReleaseRequest : "requests (requestedBy)"
    User ||--o{ Observation : "logs (officer)"
    User ||--o{ Notification : "receives"
    User ||--o{ AuditLog : "triggers (performedBy)"

    Instrument ||--o{ Instrument : "renews (parentId)"
    Instrument ||--o{ Document : "contains"
    Instrument ||--o{ Verification : "undergoes"
    Instrument ||--o{ Discrepancy : "flags"
    Instrument ||--o{ ReleaseRequest : "targets"
    Instrument ||--o{ Observation : "annotated_by"

    Document ||--|{ DocumentVersion : "versioned_as"
    Verification ||--o{ Discrepancy : "identifies"

    Institution {
        string id PK
        string aicteId UK
        string name
        string state
        datetime createdAt
        datetime updatedAt
    }

    User {
        string id PK
        string name
        string email UK
        string passwordHash
        string role
        string institutionId FK
        datetime createdAt
        datetime updatedAt
    }

    Instrument {
        string id PK
        string type "FDR | SECURITY_DEPOSIT"
        string referenceNumber "Non-unique for duplicate detection"
        string bankName
        string bankBranch
        float amount
        datetime issueDate
        datetime maturityDate "Indexed"
        string status "Indexed"
        string institutionId FK "Indexed"
        string createdById FK
        boolean verifiedByBank
        string parentId FK "Self-referencing renewal chain"
        datetime createdAt
        datetime updatedAt
    }

    Document {
        string id PK
        string instrumentId FK
        string name
        string category "FDR_COPY | DEPOSIT_CONFIRMATION | ..."
        int currentVersion
        datetime createdAt
        datetime updatedAt
    }

    DocumentVersion {
        string id PK
        string documentId FK "UK(documentId, version)"
        int version "UK(documentId, version)"
        string filePath "Encrypted storage path"
        string mimeType
        int sizeBytes
        string sha256
        string uploadedById FK
        datetime uploadedAt
    }

    Verification {
        string id PK
        string instrumentId FK
        datetime requestedAt
        datetime completedAt "Nullable"
        string status "SUCCESS | MISMATCH | PENDING | ..."
        string bankData "Nullable JSON string"
        string source "MOCK_BANK_API | MANUAL | ..."
        string requestedById "Nullable user reference"
    }

    Discrepancy {
        string id PK
        string instrumentId FK
        string verificationId FK "Nullable"
        string code "AMOUNT_MISMATCH | DUPLICATE_FDR | MISSING_DOCUMENT | ..."
        string severity "low | medium | high | critical"
        string status "Indexed: OPEN | RESOLVED | WAIVED"
        string details "JSON details payload"
        datetime detectedAt
        datetime resolvedAt "Nullable"
        string resolvedById "Nullable user reference"
    }

    ReleaseRequest {
        string id PK
        string instrumentId FK
        string requestedById FK
        string status "SUBMITTED | APPROVED | REJECTED"
        string remarks "Nullable"
        datetime createdAt
        datetime updatedAt
    }

    Observation {
        string id PK
        string instrumentId FK
        string officerId FK
        string note
        datetime createdAt
    }

    Notification {
        string id PK
        string userId FK
        string title
        string body
        boolean read
        datetime createdAt
    }

    ReminderRule {
        string id PK
        int daysBefore
        string channel "IN_APP_EMAIL | SMS_IN_APP_EMAIL | EMAIL"
        int escalateAfterDays
        string escalateToRole "APPROVING_AUTHORITY"
        boolean enabled
    }

    AuditLog {
        string id PK
        string action
        string entity
        string entityId
        string before "Nullable JSON string"
        string after "Nullable JSON string"
        string performedById FK
        string ip
        datetime timestamp
    }
```
