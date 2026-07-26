const crypto = require("crypto");

function getEncryptionKey() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("Credential encryption key is not configured.");
    error.statusCode = 500;
    throw error;
  }
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptCredential(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decryptCredential(payload) {
  const [version, ivValue, tagValue, encryptedValue] = String(payload || "").split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    const error = new Error("Stored credential is unavailable.");
    error.statusCode = 409;
    throw error;
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encryptCredential, decryptCredential };
