"use client";

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  clearPortalOnboardingDeferredForSession,
  storePortalRefreshToken,
} from "@/lib/portal-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PasskeyLoginButtonProps {
  area: "portal" | "admin";
  email: string;
  onSuccess: (result?: { showSecurityOnboarding?: boolean }) => void;
  onError: (msg: string) => void;
  className?: string;
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (trimmed === "[object Event]" || trimmed === "[object Object]") return fallback;
    return trimmed;
  }
  if (value && typeof value === "object") {
    const asRecord = value as { message?: unknown; error?: unknown };
    if (typeof asRecord.message === "string" && asRecord.message.trim()) {
      return asRecord.message.trim();
    }
    if (typeof asRecord.error === "string" && asRecord.error.trim()) {
      return asRecord.error.trim();
    }
  }
  return fallback;
}

function normalizePasskeyErrorMessage(raw: string, t: (key: string) => string): string {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return t("passkeys.loginFailed");
  if (normalized.includes("no passkeys registered for this account")) {
    return t("passkeys.noPasskeysForAccount");
  }
  if (normalized.includes("email is required")) {
    return t("passkeys.emailRequired");
  }
  return raw;
}

/**
 * "Sign in with passkey" button for login pages.
 */
export default function PasskeyLoginButton({
  area,
  email,
  onSuccess,
  onError,
  className,
}: PasskeyLoginButtonProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const basePath = area === "portal" ? "/portal/webauthn" : "/admin/webauthn";

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      onError(t("passkeys.emailRequired"));
      return;
    }

    if (!window.PublicKeyCredential) {
      onError(t("passkeys.notSupported"));
      return;
    }

    setLoading(true);
    if (area === "portal") {
      clearPortalOnboardingDeferredForSession();
    }

    try {
      // 1. Get login options
      const optRes = await fetch(`${API_URL}${basePath}/login/options`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!optRes.ok) {
        const data = await optRes.json().catch(() => ({}));
        onError(
          normalizePasskeyErrorMessage(
            getErrorMessage(data?.error, t("passkeys.noPasskeysForAccount")),
            t
          )
        );
        setLoading(false);
        return;
      }

      const { options } = await optRes.json();

      // 2. Start assertion via WebAuthn API
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: base64UrlToBuffer(options.challenge),
        allowCredentials: (options.allowCredentials || []).map(
          (c: { type: string; id: string }) => ({
            ...c,
            id: base64UrlToBuffer(c.id),
          })
        ),
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        setLoading(false);
        return;
      }

      // 3. Verify with server
      const assertionResponse = credential.response as AuthenticatorAssertionResponse;
      const credentialData = {
        id: bufferToBase64Url(credential.rawId),
        rawId: bufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: bufferToBase64Url(assertionResponse.authenticatorData),
          clientDataJSON: bufferToBase64Url(assertionResponse.clientDataJSON),
          signature: bufferToBase64Url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle
            ? bufferToBase64Url(assertionResponse.userHandle)
            : undefined,
        },
      };

      const verifyRes = await fetch(`${API_URL}${basePath}/login/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialData, email: email.trim() }),
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (data.ok) {
          if (area === "portal" && data.refreshToken) {
            storePortalRefreshToken(data.refreshToken);
          }
          onSuccess({
            showSecurityOnboarding: area === "portal" ? Boolean(data.showSecurityOnboarding) : false,
          });
          return;
        }
      }

      const errData = await verifyRes.json().catch(() => ({}));
      onError(
        normalizePasskeyErrorMessage(
          getErrorMessage(errData?.error, t("passkeys.loginFailed")),
          t
        )
      );
    } catch (err) {
      // User cancelled the browser prompt
      if (err instanceof Error && (err.name === "AbortError" || err.name === "NotAllowedError")) {
        // User cancelled — do nothing
      } else {
        onError(t("passkeys.loginFailed"));
      }
    }

    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handlePasskeyLogin}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-[#F3E8D8] rounded-lg text-sm font-medium text-amber-800 hover:border-amber-400 hover:bg-[#FFFBF5] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className || ""}`}
    >
      <Fingerprint size={18} />
      {loading ? t("passkeys.loginLoading") : t("passkeys.loginButton")}
    </button>
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
