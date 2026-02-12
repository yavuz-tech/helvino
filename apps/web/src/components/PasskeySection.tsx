"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useStepUp } from "@/contexts/StepUpContext";
import { Fingerprint, Trash2, Plus, Key, ShieldOff, LogOut } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PasskeyCredential {
  id: string;
  credentialId: string;
  nickname: string | null;
  createdAt: string;
  lastUsedAt: string;
}

interface PasskeySectionProps {
  area: "portal" | "admin";
}

/**
 * Reusable passkey management section for Portal and Admin security pages.
 */
export default function PasskeySection({ area }: PasskeySectionProps) {
  const { t } = useI18n();
  const { withStepUp } = useStepUp();
  const [credentials, setCredentials] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nickname, setNickname] = useState("");
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokingAllSessions, setRevokingAllSessions] = useState(false);

  const basePath = area === "portal" ? "/portal/webauthn" : "/admin/webauthn";

  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}${basePath}/credentials`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [basePath]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleAdd = async () => {
    setMessage(null);

    // Check browser support
    if (!window.PublicKeyCredential) {
      setMessage({ type: "error", text: t("passkeys.notSupported") });
      return;
    }

    setAdding(true);

    try {
      // 1. Get registration options (requires step-up)
      const optResult = await withStepUp(
        () => fetch(`${API_URL}${basePath}/register/options`, { credentials: "include" }),
        area
      );

      if (optResult.cancelled) { setAdding(false); return; }
      if (!optResult.ok || !optResult.data) {
        setMessage({ type: "error", text: t("passkeys.challengeError") });
        setAdding(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { options } = optResult.data as { options: any };

      // 2. Create credential via WebAuthn API
      const user = options.user as { id: string; name: string; displayName: string };
      const excludeCreds = (options.excludeCredentials || []) as { type: string; id: string }[];
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64UrlToBuffer(options.challenge as string),
        user: {
          ...user,
          id: base64UrlToBuffer(user.id),
        },
        excludeCredentials: excludeCreds.map((c) => ({
          ...c,
          id: base64UrlToBuffer(c.id),
        })),
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        setMessage({ type: "error", text: t("passkeys.registrationFailed") });
        setAdding(false);
        return;
      }

      // 3. Send to server for verification (also requires step-up)
      const attestationResponse = credential.response as AuthenticatorAttestationResponse;
      const credentialData = {
        id: bufferToBase64Url(credential.rawId),
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          attestationObject: bufferToBase64Url(attestationResponse.attestationObject),
          clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
        },
      };

      const verifyResult = await withStepUp(
        () =>
          fetch(`${API_URL}${basePath}/register/verify`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: credentialData, nickname: nickname || undefined }),
          }),
        area
      );

      if (verifyResult.cancelled) { setAdding(false); return; }
      if (verifyResult.ok) {
        setMessage({ type: "success", text: t("passkeys.added") });
        setNickname("");
        setShowNicknameInput(false);
        loadCredentials();
      } else {
        const data = verifyResult.data as Record<string, unknown> | undefined;
        setMessage({ type: "error", text: (data?.error as string) || t("passkeys.registrationFailed") });
      }
    } catch (err) {
      // User cancelled the browser dialog or other error
      const msg = err instanceof Error ? err.message : t("passkeys.registrationFailed");
      if (!msg.includes("cancelled") && !msg.includes("AbortError")) {
        setMessage({ type: "error", text: msg });
      }
    }
    setAdding(false);
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setMessage(null);

    const result = await withStepUp(
      () =>
        fetch(`${API_URL}${basePath}/credentials/${id}/revoke`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      area
    );

    if (result.cancelled) { setRevokingId(null); return; }
    if (result.ok) {
      setMessage({ type: "success", text: t("passkeys.revoked") });
      loadCredentials();
    } else {
      setMessage({ type: "error", text: "Failed to remove passkey" });
    }
    setRevokingId(null);
  };

  const handleRevokeAll = async () => {
    if (!confirm(t("passkeys.revokeAllConfirm"))) return;
    setRevokingAll(true);
    setMessage(null);

    const result = await withStepUp(
      () =>
        fetch(`${API_URL}${basePath}/credentials/revoke-all`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      area
    );

    if (result.cancelled) { setRevokingAll(false); return; }
    if (result.ok) {
      setMessage({ type: "success", text: t("passkeys.revokeAllSuccess") });
      loadCredentials();
    } else {
      setMessage({ type: "error", text: t("common.error") });
    }
    setRevokingAll(false);
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm(t("passkeys.revokeAllSessionsConfirm"))) return;
    setRevokingAllSessions(true);
    setMessage(null);

    const result = await withStepUp(
      () =>
        fetch(`${API_URL}${basePath}/sessions/revoke-all`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      area
    );

    if (result.cancelled) { setRevokingAllSessions(false); return; }
    if (result.ok) {
      setMessage({ type: "success", text: t("passkeys.revokeAllSessionsSuccess") });
    } else {
      setMessage({ type: "error", text: t("common.error") });
    }
    setRevokingAllSessions(false);
  };

  return (
    <div className="bg-white rounded-lg border border-[#F3E8D8] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Fingerprint size={20} className="text-amber-700" />
          <h2 className="text-lg font-semibold text-amber-900">{t("passkeys.title")}</h2>
        </div>
      </div>

      <p className="text-sm text-amber-700 mb-4">{t("passkeys.description")}</p>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Credentials list */}
      {loading ? (
        <div className="text-sm text-amber-600 py-4">{t("common.loading")}</div>
      ) : credentials.length === 0 ? (
        <div className="text-sm text-amber-600 py-4 border-t border-[#F3E8D8]">
          {t("passkeys.noPasskeys")}
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between p-3 border border-[#F3E8D8] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Key size={16} className="text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    {cred.nickname || t("passkeys.title")}
                  </p>
                  <p className="text-xs text-amber-600" suppressHydrationWarning>
                    {t("passkeys.createdAt")}: {new Date(cred.createdAt).toLocaleDateString()}{" "}
                    &middot; {t("passkeys.lastUsed")}: {new Date(cred.lastUsedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(cred.id)}
                disabled={revokingId === cred.id}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title={t("passkeys.revoke")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add passkey */}
      {showNicknameInput ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t("passkeys.nicknamePlaceholder")}
            className="flex-1 px-3 py-2 text-sm border border-[#F3E8D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {adding ? t("passkeys.adding") : <><Plus size={14} /> {t("passkeys.add")}</>}
          </button>
          <button
            onClick={() => { setShowNicknameInput(false); setNickname(""); }}
            className="px-3 py-2 text-sm text-amber-700 hover:text-amber-900"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNicknameInput(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors"
        >
          <Plus size={14} />
          {t("passkeys.add")}
        </button>
      )}

      {/* Lifecycle actions */}
      {credentials.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#F3E8D8]">
          <button
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <ShieldOff size={14} />
            {revokingAll ? t("common.loading") : t("passkeys.revokeAll")}
          </button>
          <button
            onClick={handleRevokeAllSessions}
            disabled={revokingAllSessions}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            <LogOut size={14} />
            {revokingAllSessions ? t("common.loading") : t("passkeys.revokeAllSessions")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Utility helpers ──

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let s = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
