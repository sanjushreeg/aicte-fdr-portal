import crypto from "crypto";

// AES-256-GCM configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "aicte_portal_default_secret_key_32_bytes!!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (base64)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM with authentication tag validation.
 * Throws error if corrupted/tampered.
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected iv:authTag:ciphertext");
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid Auth Tag length");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
