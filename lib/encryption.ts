import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Derives the encryption key from the ENCRYPTION_SECRET environment variable.
 * Uses scrypt for secure key derivation.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ENCRYPTION_SECRET environment variable must be at least 32 characters"
    );
  }
  // Use scrypt for key derivation with a fixed salt for consistency
  return scryptSync(secret, "agent-config-salt-v1", 32);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in format: iv:tag:encrypted (all base64 encoded)
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (all base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypts a ciphertext string encrypted with encryptSecret.
 * Expects format: iv:tag:encrypted (all base64 encoded)
 */
export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivB64, tagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

/**
 * Encrypts an object of agent secrets as JSON.
 */
export function encryptAgentSecrets(secrets: Record<string, string>): string {
  return encryptSecret(JSON.stringify(secrets));
}

/**
 * Decrypts an encrypted agent secrets JSON object.
 */
export function decryptAgentSecrets(
  encrypted: string
): Record<string, string> {
  const json = decryptSecret(encrypted);
  return JSON.parse(json);
}

/**
 * Checks if encryption is properly configured.
 * Returns true if ENCRYPTION_SECRET is set and valid.
 */
export function isEncryptionConfigured(): boolean {
  const secret = process.env.ENCRYPTION_SECRET;
  return !!secret && secret.length >= 32;
}
