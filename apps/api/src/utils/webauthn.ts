/**
 * WebAuthn server-side utilities — Step 11.25 / 11.26
 *
 * Minimal, standards-compliant WebAuthn RP implementation using only Node.js crypto.
 * No external WebAuthn libraries needed.
 *
 * Step 11.26: Challenges are now stored in Prisma-backed DB (WebAuthnChallenge)
 * with single-use enforcement, expiry, IP/UA logging.
 *
 * Supports ES256 (P-256 / ECDSA) and RS256 (RSASSA-PKCS1-v1_5) algorithms.
 */

import crypto from "crypto";
import { prisma } from "../prisma";

// ── Config ──

const RP_NAME = process.env.WEBAUTHN_RP_NAME || "Helvino";
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const RP_ORIGIN = process.env.WEBAUTHN_ORIGIN || "http://localhost:3000";

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Base64url helpers ──

export function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64UrlDecode(str: string): Buffer {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return Buffer.from(s, "base64");
}

// ── DB-backed Challenge Store (Step 11.26) ──

/**
 * Create a challenge and store in DB. Returns the challenge string (base64url).
 * Cleanup of expired challenges is lazy (done on create).
 */
export async function createChallengeDB(
  userId: string | null,
  userType: string,
  ip?: string,
  userAgent?: string
): Promise<string> {
  // Lazy cleanup: delete expired/used challenges older than 10 minutes
  await prisma.webAuthnChallenge.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  }).catch(() => {/* best-effort cleanup */});

  const challenge = base64UrlEncode(crypto.randomBytes(32));

  await prisma.webAuthnChallenge.create({
    data: {
      userType,
      userId,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      ip: ip?.substring(0, 45) || null,
      userAgent: userAgent?.substring(0, 256) || null,
    },
  });

  return challenge;
}

/**
 * Consume a challenge: look up by userId + userType, enforce single-use + expiry.
 * Returns the challenge string if valid, null otherwise.
 */
export async function consumeChallengeDB(
  userId: string | null,
  userType: string
): Promise<string | null> {
  // Find the most recent unused, unexpired challenge for this user
  const where: Record<string, unknown> = {
    userType,
    usedAt: null,
    expiresAt: { gt: new Date() },
  };
  if (userId) {
    where.userId = userId;
  }

  const entry = await prisma.webAuthnChallenge.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!entry) return null;

  // Mark as used (single-use enforcement)
  await prisma.webAuthnChallenge.update({
    where: { id: entry.id },
    data: { usedAt: new Date() },
  });

  return entry.challenge;
}

// Legacy in-memory wrappers kept for backward compat; now delegate to sync-safe variants
// that the routes call via async. The routes have been updated to use createChallengeDB/consumeChallengeDB.
export function createChallenge(userId: string, userType: string): string {
  // Synchronous fallback for dummy challenges (no DB write needed for anti-enumeration)
  return base64UrlEncode(crypto.randomBytes(32));
}

export function consumeChallenge(_userId: string, _userType: string): string | null {
  // Deprecated — routes should use consumeChallengeDB
  return null;
}

// ── Registration Options ──

export interface RegistrationOptionsInput {
  userId: string;
  userEmail: string;
  userName: string;
  existingCredentialIds: string[]; // base64url credential IDs to exclude
}

export function generateRegistrationOptions(input: RegistrationOptionsInput, _userType: string, challenge?: string) {
  const resolvedChallenge = challenge || createChallenge(input.userId, _userType);

  return {
    rp: { name: RP_NAME, id: RP_ID },
    user: {
      id: base64UrlEncode(Buffer.from(input.userId, "utf-8")),
      name: input.userEmail,
      displayName: input.userName,
    },
    challenge: resolvedChallenge,
    pubKeyCredParams: [
      { type: "public-key" as const, alg: -7 },  // ES256
      { type: "public-key" as const, alg: -257 }, // RS256
    ],
    timeout: 300000, // 5 minutes
    attestation: "none" as const,
    authenticatorSelection: {
      residentKey: "preferred" as const,
      userVerification: "preferred" as const,
    },
    excludeCredentials: input.existingCredentialIds.map((id) => ({
      type: "public-key" as const,
      id,
    })),
  };
}

// ── Login Options ──

export function generateLoginOptions(
  _userId: string,
  _userType: string,
  credentialIds: string[],
  challenge?: string
) {
  const resolvedChallenge = challenge || createChallenge(_userId, _userType);

  return {
    rpId: RP_ID,
    challenge: resolvedChallenge,
    timeout: 300000,
    userVerification: "preferred" as const,
    allowCredentials: credentialIds.map((id) => ({
      type: "public-key" as const,
      id,
    })),
  };
}

// ── Registration Verification ──

export interface RegistrationResponse {
  id: string; // credential ID (base64url)
  rawId: string; // credential ID raw (base64url)
  type: string;
  response: {
    attestationObject: string; // base64url
    clientDataJSON: string;    // base64url
  };
  authenticatorAttachment?: string;
  clientExtensionResults?: Record<string, unknown>;
}

interface VerifiedRegistration {
  credentialId: string;  // base64url
  publicKey: string;     // base64url DER-encoded SubjectPublicKeyInfo
  counter: number;
  aaguid: string;
  transports: string[];
}

/**
 * Verify WebAuthn registration response.
 */
export function verifyRegistration(
  credential: RegistrationResponse,
  expectedChallenge: string
): VerifiedRegistration {
  // 1. Decode clientDataJSON
  const clientDataBuf = base64UrlDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(clientDataBuf.toString("utf-8"));

  // 2. Verify type
  if (clientData.type !== "webauthn.create") {
    throw new Error("Invalid clientData type");
  }

  // 3. Verify challenge
  if (clientData.challenge !== expectedChallenge) {
    throw new Error("Challenge mismatch");
  }

  // 4. Verify origin
  if (clientData.origin !== RP_ORIGIN) {
    throw new Error(`Origin mismatch: expected ${RP_ORIGIN}, got ${clientData.origin}`);
  }

  // 5. Decode attestation object (CBOR-lite for "none" attestation)
  const attObjBuf = base64UrlDecode(credential.response.attestationObject);
  const authData = parseAttestationObject(attObjBuf);

  // 6. Verify RP ID hash
  const rpIdHash = crypto.createHash("sha256").update(RP_ID).digest();
  if (!authData.rpIdHash.equals(rpIdHash)) {
    throw new Error("RP ID hash mismatch");
  }

  // 7. Check user-present flag
  if (!(authData.flags & 0x01)) {
    throw new Error("User presence flag not set");
  }

  return {
    credentialId: credential.id,
    publicKey: base64UrlEncode(authData.publicKeyDer),
    counter: authData.counter,
    aaguid: authData.aaguid,
    transports: [],
  };
}

// ── Login (Assertion) Verification ──

export interface AssertionResponse {
  id: string; // credential ID (base64url)
  rawId: string;
  type: string;
  response: {
    authenticatorData: string; // base64url
    clientDataJSON: string;    // base64url
    signature: string;         // base64url
    userHandle?: string;       // base64url
  };
}

/**
 * Verify WebAuthn assertion (login).
 * Returns the new counter value.
 */
export function verifyAssertion(
  credential: AssertionResponse,
  expectedChallenge: string,
  storedPublicKeyB64: string,
  storedCounter: number
): { newCounter: number } {
  // 1. Decode clientDataJSON
  const clientDataBuf = base64UrlDecode(credential.response.clientDataJSON);
  const clientData = JSON.parse(clientDataBuf.toString("utf-8"));

  // 2. Verify type
  if (clientData.type !== "webauthn.get") {
    throw new Error("Invalid clientData type");
  }

  // 3. Verify challenge
  if (clientData.challenge !== expectedChallenge) {
    throw new Error("Challenge mismatch");
  }

  // 4. Verify origin
  if (clientData.origin !== RP_ORIGIN) {
    throw new Error(`Origin mismatch: expected ${RP_ORIGIN}, got ${clientData.origin}`);
  }

  // 5. Parse authenticator data
  const authDataBuf = base64UrlDecode(credential.response.authenticatorData);
  const rpIdHash = authDataBuf.subarray(0, 32);
  const flags = authDataBuf[32];
  const counter = authDataBuf.readUInt32BE(33);

  // 6. Verify RP ID hash
  const expectedRpIdHash = crypto.createHash("sha256").update(RP_ID).digest();
  if (!rpIdHash.equals(expectedRpIdHash)) {
    throw new Error("RP ID hash mismatch");
  }

  // 7. User presence
  if (!(flags & 0x01)) {
    throw new Error("User presence flag not set");
  }

  // 8. Counter check (anti-replay)
  if (counter > 0 && counter <= storedCounter) {
    throw new Error("Counter did not increase — possible cloned authenticator");
  }

  // 9. Verify signature
  const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
  const signedData = Buffer.concat([authDataBuf, clientDataHash]);
  const signature = base64UrlDecode(credential.response.signature);
  const publicKeyDer = base64UrlDecode(storedPublicKeyB64);

  // Try EC (ES256) first, then RSA (RS256)
  let verified = false;

  // ES256 (P-256)
  try {
    const keyObj = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    verified = crypto.createVerify("SHA256").update(signedData).verify(
      { key: keyObj, dsaEncoding: "ieee-p1363" },
      signature
    );
  } catch {
    // Not an EC key or verification failed
  }

  if (!verified) {
    // RS256 fallback
    try {
      const keyObj = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
      verified = crypto.createVerify("SHA256").update(signedData).verify(keyObj, signature);
    } catch {
      // Not an RSA key either
    }
  }

  if (!verified) {
    throw new Error("Signature verification failed");
  }

  return { newCounter: counter };
}

// ── CBOR / Attestation Parsing ──

interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: number;
  counter: number;
  aaguid: string;
  publicKeyDer: Buffer;
}

/**
 * Parse attestation object for "none" attestation.
 * Minimal CBOR parser for the expected structure.
 */
function parseAttestationObject(buf: Buffer): ParsedAuthData {
  // Find authData in CBOR map. For "none" attestation the structure is:
  // { fmt: "none", attStmt: {}, authData: <bytes> }
  // We use a simple approach: find the authData bytes marker.

  const authDataOffset = findCborByteString(buf, "authData");
  if (authDataOffset < 0) {
    throw new Error("Could not find authData in attestation object");
  }

  const authData = extractCborByteString(buf, authDataOffset);

  return parseAuthenticatorData(authData);
}

function parseAuthenticatorData(authData: Buffer): ParsedAuthData {
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const counter = authData.readUInt32BE(33);

  // Attested credential data present?
  if (!(flags & 0x40)) {
    throw new Error("No attested credential data in authData");
  }

  // Parse attested credential data
  const aaguidBuf = authData.subarray(37, 53);
  const aaguid = formatAaguid(aaguidBuf);

  const credIdLen = authData.readUInt16BE(53);
  // Skip credential ID
  const coseKeyOffset = 55 + credIdLen;
  const coseKeyBuf = authData.subarray(coseKeyOffset);

  // Parse COSE key and convert to DER SubjectPublicKeyInfo
  const publicKeyDer = coseKeyToDer(coseKeyBuf);

  return { rpIdHash, flags, counter, aaguid, publicKeyDer };
}

function formatAaguid(buf: Buffer): string {
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ── CBOR helpers (minimal, handles the expected WebAuthn structures) ──

function findCborByteString(buf: Buffer, key: string): number {
  // Search for the text string key followed by a byte string
  const keyBytes = Buffer.from(key, "utf-8");
  for (let i = 0; i < buf.length - keyBytes.length - 1; i++) {
    // CBOR text string: major type 3
    const majorType = (buf[i] >> 5) & 0x07;
    const addInfo = buf[i] & 0x1f;
    if (majorType === 3 && addInfo === keyBytes.length) {
      if (buf.subarray(i + 1, i + 1 + keyBytes.length).equals(keyBytes)) {
        return i + 1 + keyBytes.length;
      }
    }
  }
  return -1;
}

function extractCborByteString(buf: Buffer, offset: number): Buffer {
  const majorType = (buf[offset] >> 5) & 0x07;
  if (majorType !== 2) {
    throw new Error(`Expected CBOR byte string at offset ${offset}, got major type ${majorType}`);
  }

  const addInfo = buf[offset] & 0x1f;
  let length: number;
  let dataOffset: number;

  if (addInfo < 24) {
    length = addInfo;
    dataOffset = offset + 1;
  } else if (addInfo === 24) {
    length = buf[offset + 1];
    dataOffset = offset + 2;
  } else if (addInfo === 25) {
    length = buf.readUInt16BE(offset + 1);
    dataOffset = offset + 3;
  } else {
    throw new Error(`Unsupported CBOR additional info: ${addInfo}`);
  }

  return buf.subarray(dataOffset, dataOffset + length);
}

// ── COSE Key → DER conversion ──

/**
 * Convert a COSE public key to DER-encoded SubjectPublicKeyInfo.
 * Supports EC2 (kty=2, ES256) and RSA (kty=3, RS256).
 */
function coseKeyToDer(coseKeyBuf: Buffer): Buffer {
  // Minimal CBOR map parse
  const map = parseCborMap(coseKeyBuf);

  const kty = map.get(1) as number;

  if (kty === 2) {
    // EC2 key (P-256)
    const x = map.get(-2) as Buffer;
    const y = map.get(-3) as Buffer;
    return ec256ToDer(x, y);
  } else if (kty === 3) {
    // RSA key
    const n = map.get(-1) as Buffer;
    const e = map.get(-2) as Buffer;
    return rsaToDer(n, e);
  }

  throw new Error(`Unsupported COSE key type: ${kty}`);
}

function ec256ToDer(x: Buffer, y: Buffer): Buffer {
  // Uncompressed point: 0x04 || x || y
  const point = Buffer.concat([Buffer.from([0x04]), x, y]);

  // SubjectPublicKeyInfo for EC P-256
  const oid = Buffer.from(
    "3059301306072a8648ce3d020106082a8648ce3d030107034200",
    "hex"
  );

  return Buffer.concat([oid, point]);
}

function rsaToDer(n: Buffer, e: Buffer): Buffer {
  // Simplified RSA SubjectPublicKeyInfo construction
  const nInt = wrapAsn1Integer(n);
  const eInt = wrapAsn1Integer(e);
  const seq = wrapAsn1Sequence(Buffer.concat([nInt, eInt]));
  const bitString = Buffer.concat([
    Buffer.from([0x03]),
    asn1Length(seq.length + 1),
    Buffer.from([0x00]),
    seq,
  ]);

  const algorithmId = Buffer.from(
    "300d06092a864886f70d0101010500",
    "hex"
  );

  return wrapAsn1Sequence(Buffer.concat([algorithmId, bitString]));
}

function wrapAsn1Integer(buf: Buffer): Buffer {
  // Ensure leading zero if high bit set
  const needsPad = buf[0] & 0x80;
  const data = needsPad ? Buffer.concat([Buffer.from([0x00]), buf]) : buf;
  return Buffer.concat([Buffer.from([0x02]), asn1Length(data.length), data]);
}

function wrapAsn1Sequence(content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x30]), asn1Length(content.length), content]);
}

function asn1Length(len: number): Buffer {
  if (len < 128) return Buffer.from([len]);
  if (len < 256) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

// ── Minimal CBOR map parser ──

function parseCborMap(buf: Buffer): Map<number, unknown> {
  const result = new Map<number, unknown>();
  let offset = 0;

  // Read map header
  const mapMajor = (buf[offset] >> 5) & 0x07;
  if (mapMajor !== 5) throw new Error("Expected CBOR map");
  const mapLen = buf[offset] & 0x1f;
  offset++;

  if (mapLen === 24) {
    // 1-byte length follows
    offset++;
  }

  const count = mapLen < 24 ? mapLen : buf[offset - 1];

  for (let i = 0; i < count && offset < buf.length; i++) {
    const [key, newOffset1] = readCborValue(buf, offset);
    offset = newOffset1;
    const [value, newOffset2] = readCborValue(buf, offset);
    offset = newOffset2;
    result.set(key as number, value);
  }

  return result;
}

function readCborValue(buf: Buffer, offset: number): [unknown, number] {
  const initial = buf[offset];
  const major = (initial >> 5) & 0x07;
  const addInfo = initial & 0x1f;

  switch (major) {
    case 0: { // Unsigned integer
      if (addInfo < 24) return [addInfo, offset + 1];
      if (addInfo === 24) return [buf[offset + 1], offset + 2];
      if (addInfo === 25) return [buf.readUInt16BE(offset + 1), offset + 3];
      if (addInfo === 26) return [buf.readUInt32BE(offset + 1), offset + 5];
      throw new Error(`Unsupported CBOR uint length: ${addInfo}`);
    }
    case 1: { // Negative integer
      if (addInfo < 24) return [-(addInfo + 1), offset + 1];
      if (addInfo === 24) return [-(buf[offset + 1] + 1), offset + 2];
      if (addInfo === 25) return [-(buf.readUInt16BE(offset + 1) + 1), offset + 3];
      throw new Error(`Unsupported CBOR nint length: ${addInfo}`);
    }
    case 2: { // Byte string
      let len: number;
      let start: number;
      if (addInfo < 24) { len = addInfo; start = offset + 1; }
      else if (addInfo === 24) { len = buf[offset + 1]; start = offset + 2; }
      else if (addInfo === 25) { len = buf.readUInt16BE(offset + 1); start = offset + 3; }
      else throw new Error(`Unsupported CBOR bstr length: ${addInfo}`);
      return [buf.subarray(start, start + len), start + len];
    }
    case 3: { // Text string
      let len: number;
      let start: number;
      if (addInfo < 24) { len = addInfo; start = offset + 1; }
      else if (addInfo === 24) { len = buf[offset + 1]; start = offset + 2; }
      else if (addInfo === 25) { len = buf.readUInt16BE(offset + 1); start = offset + 3; }
      else throw new Error(`Unsupported CBOR tstr length: ${addInfo}`);
      return [buf.subarray(start, start + len).toString("utf-8"), start + len];
    }
    case 5: { // Map (skip inner items)
      let count: number;
      let off = offset + 1;
      if (addInfo < 24) { count = addInfo; }
      else if (addInfo === 24) { count = buf[off]; off++; }
      else throw new Error(`Unsupported CBOR map length: ${addInfo}`);
      for (let i = 0; i < count; i++) {
        const [, o1] = readCborValue(buf, off); off = o1;
        const [, o2] = readCborValue(buf, off); off = o2;
      }
      return [{}, off];
    }
    case 7: { // Simple values (false, true, null)
      if (addInfo === 20) return [false, offset + 1];
      if (addInfo === 21) return [true, offset + 1];
      if (addInfo === 22) return [null, offset + 1];
      return [null, offset + 1];
    }
    default:
      throw new Error(`Unsupported CBOR major type: ${major} at offset ${offset}`);
  }
}

// ── Exports for config ──

export function getWebAuthnConfig() {
  return { rpName: RP_NAME, rpId: RP_ID, origin: RP_ORIGIN };
}
