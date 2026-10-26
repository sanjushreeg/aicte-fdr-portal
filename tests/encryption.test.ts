import { encrypt, decrypt } from "../src/lib/encryption";

describe("AES-256-GCM Encryption & Decryption", () => {
  it("should encrypt and decrypt plaintext accurately", () => {
    const secretMessage = "AICTE-Confidential-Deposit-Record-REF-99999";
    const encrypted = encrypt(secretMessage);

    expect(encrypted).not.toBe(secretMessage);
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secretMessage);
  });

  it("should fail decryption when ciphertext is tampered", () => {
    const secretMessage = "SensitiveBankVerificationKey";
    const encrypted = encrypt(secretMessage);
    const [iv, tag, ciphertext] = encrypted.split(":");

    // Tamper ciphertext
    const tamperedCipher = ciphertext.substring(0, ciphertext.length - 2) + "AB";
    const tamperedPayload = `${iv}:${tag}:${tamperedCipher}`;

    expect(() => decrypt(tamperedPayload)).toThrow();
  });

  it("should fail decryption when authentication tag is tampered", () => {
    const secretMessage = "TamperTagCheck";
    const encrypted = encrypt(secretMessage);
    const [iv, tag, ciphertext] = encrypted.split(":");

    // Modify the auth tag
    const fakeTag = Buffer.alloc(16, 0).toString("base64");
    const tamperedPayload = `${iv}:${fakeTag}:${ciphertext}`;

    expect(() => decrypt(tamperedPayload)).toThrow();
  });
});
