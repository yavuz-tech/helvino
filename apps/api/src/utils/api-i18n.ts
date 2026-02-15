/**
 * API Error Message i18n
 *
 * Provides translated error messages for API responses.
 * Uses the same locale detection as email templates (cookie → Accept-Language → "en").
 *
 * Usage:
 *   import { t, getRequestLocale } from "../utils/api-i18n";
 *   const locale = getRequestLocale(request);
 *   return { error: t(locale, "auth.invalidCredentials") };
 */

import { FastifyRequest } from "fastify";
import { extractLocaleCookie, normalizeRequestLocale } from "./email-templates";

export type Locale = "en" | "tr" | "es";

// ── Translation map ──
// Keys follow "namespace.messageKey" convention.
// Keep messages concise and user-friendly.

const messages: Record<string, Record<Locale, string>> = {
  // ── Auth / Login ──
  "auth.invalidCredentials": {
    en: "Invalid email or password",
    tr: "Geçersiz e-posta veya şifre",
    es: "Correo electrónico o contraseña inválidos",
  },
  "auth.accountLocked": {
    en: "Account is temporarily locked due to failed attempts",
    tr: "Hesap, başarısız denemeler nedeniyle geçici olarak kilitlendi",
    es: "La cuenta está temporalmente bloqueada debido a intentos fallidos",
  },
  "auth.accountLockedTooMany": {
    en: "Account locked due to too many failed attempts.",
    tr: "Çok fazla başarısız deneme nedeniyle hesap kilitlendi.",
    es: "Cuenta bloqueada debido a demasiados intentos fallidos.",
  },
  "auth.accountDeactivated": {
    en: "Account is deactivated",
    tr: "Hesap devre dışı bırakıldı",
    es: "La cuenta está desactivada",
  },
  "auth.tooManyLoginAttempts": {
    en: "Too many login attempts",
    tr: "Çok fazla giriş denemesi",
    es: "Demasiados intentos de inicio de sesión",
  },
  "auth.tooManyAdminLoginAttempts": {
    en: "Too many admin login attempts",
    tr: "Çok fazla yönetici giriş denemesi",
    es: "Demasiados intentos de inicio de sesión de administrador",
  },
  "auth.emailPasswordRequired": {
    en: "Email and password required",
    tr: "E-posta ve şifre gerekli",
    es: "Se requieren correo electrónico y contraseña",
  },
  "auth.captchaRequired": {
    en: "CAPTCHA verification is required",
    tr: "CAPTCHA doğrulaması gerekli",
    es: "Se requiere verificación CAPTCHA",
  },
  "auth.captchaFailed": {
    en: "CAPTCHA verification failed",
    tr: "CAPTCHA doğrulaması başarısız oldu",
    es: "La verificación CAPTCHA falló",
  },
  "auth.notAuthenticated": {
    en: "Not authenticated",
    tr: "Oturum açılmamış",
    es: "No autenticado",
  },
  "auth.authRequired": {
    en: "Authentication required",
    tr: "Kimlik doğrulaması gerekli",
    es: "Autenticación requerida",
  },
  "auth.invalidSession": {
    en: "Invalid session",
    tr: "Geçersiz oturum",
    es: "Sesión inválida",
  },
  "auth.sessionCreateFailed": {
    en: "Unable to create session. Please try again.",
    tr: "Oturum oluşturulamadı. Lütfen tekrar deneyin.",
    es: "No se pudo crear la sesión. Inténtalo de nuevo.",
  },
  "auth.userNotFound": {
    en: "User not found",
    tr: "Kullanıcı bulunamadı",
    es: "Usuario no encontrado",
  },
  "auth.invalidOrigin": {
    en: "Forbidden: Invalid origin",
    tr: "Yasak: Geçersiz kaynak",
    es: "Prohibido: Origen inválido",
  },
  "auth.mfaRequired": {
    en: "MFA is required for all admin users",
    tr: "Tüm yönetici kullanıcılar için MFA gereklidir",
    es: "Se requiere MFA para todos los usuarios administradores",
  },
  "auth.mfaPending": {
    en: "MFA verification pending",
    tr: "MFA doğrulaması bekleniyor",
    es: "Verificación MFA pendiente",
  },
  "auth.userNoLongerExists": {
    en: "User no longer exists",
    tr: "Kullanıcı artık mevcut değil",
    es: "El usuario ya no existe",
  },
  "auth.internalConfigError": {
    en: "Internal server configuration error",
    tr: "Sunucu yapılandırma hatası",
    es: "Error de configuración del servidor",
  },

  // ── Refresh Token ──
  "auth.refreshTokenRequired": {
    en: "refreshToken is required",
    tr: "Yenileme jetonu gerekli",
    es: "Se requiere token de actualización",
  },
  "auth.refreshTokenInvalid": {
    en: "Invalid refresh token",
    tr: "Geçersiz yenileme jetonu",
    es: "Token de actualización inválido",
  },
  "auth.refreshTokenExpired": {
    en: "Refresh token has expired",
    tr: "Yenileme jetonunun süresi doldu",
    es: "El token de actualización ha expirado",
  },

  // ── Emergency Lock / Unlock ──
  "auth.emergencyTokenRequired": {
    en: "Emergency lock token is required",
    tr: "Acil kilitleme jetonu gerekli",
    es: "Se requiere token de bloqueo de emergencia",
  },
  "auth.emergencyTokenInvalid": {
    en: "Invalid or expired emergency lock token",
    tr: "Geçersiz veya süresi dolmuş acil kilitleme jetonu",
    es: "Token de bloqueo de emergencia inválido o expirado",
  },
  "auth.emergencyTokenUsed": {
    en: "Emergency lock token has already been used",
    tr: "Acil kilitleme jetonu zaten kullanıldı",
    es: "El token de bloqueo de emergencia ya fue utilizado",
  },
  "auth.accountLockedAndRevoked": {
    en: "Account locked and sessions revoked",
    tr: "Hesap kilitlendi ve oturumlar iptal edildi",
    es: "Cuenta bloqueada y sesiones revocadas",
  },
  "auth.unlockTokenRequired": {
    en: "Unlock token is required",
    tr: "Kilit açma jetonu gerekli",
    es: "Se requiere token de desbloqueo",
  },
  "auth.unlockTokenInvalid": {
    en: "Invalid unlock token",
    tr: "Geçersiz kilit açma jetonu",
    es: "Token de desbloqueo inválido",
  },
  "auth.unlockTokenUsed": {
    en: "Unlock token has already been used",
    tr: "Kilit açma jetonu zaten kullanıldı",
    es: "El token de desbloqueo ya fue utilizado",
  },
  "auth.unlockTokenExpired": {
    en: "Unlock token has expired",
    tr: "Kilit açma jetonunun süresi doldu",
    es: "El token de desbloqueo ha expirado",
  },
  "auth.accountUnlocked": {
    en: "Account unlocked successfully",
    tr: "Hesap kilidi başarıyla açıldı",
    es: "Cuenta desbloqueada exitosamente",
  },

  // ── Signup / Registration ──
  "signup.tooManyAttempts": {
    en: "Too many registration attempts",
    tr: "Çok fazla kayıt denemesi",
    es: "Demasiados intentos de registro",
  },
  "signup.emailServiceUnavailable": {
    en: "Email service is temporarily unavailable. Please contact support.",
    tr: "E-posta hizmeti geçici olarak kullanılamıyor. Lütfen destek ile iletişime geçin.",
    es: "El servicio de correo electrónico no está disponible temporalmente. Contacte al soporte.",
  },
  "signup.disposableEmail": {
    en: "Disposable email addresses are not allowed",
    tr: "Tek kullanımlık e-posta adresleri kabul edilmiyor",
    es: "Las direcciones de correo electrónico desechables no están permitidas",
  },
  "signup.verificationSent": {
    en: "If this email is available, a verification link has been sent.",
    tr: "Bu e-posta uygunsa doğrulama bağlantısı gönderildi.",
    es: "Si este correo está disponible, se ha enviado un enlace de verificación.",
  },
  "signup.verificationFailed": {
    en: "Verification email could not be delivered. Please try again in a few minutes.",
    tr: "Doğrulama e-postası gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.",
    es: "No se pudo enviar el correo de verificación. Inténtalo en unos minutos.",
  },
  "signup.processingError": {
    en: "Unable to process registration",
    tr: "Kayıt işlemi gerçekleştirilemedi",
    es: "No se pudo procesar el registro",
  },
  "signup.resendSuccess": {
    en: "If an unverified account exists, a new verification email has been sent.",
    tr: "Doğrulanmamış bir hesap varsa yeni doğrulama e-postası gönderildi.",
    es: "Si existe una cuenta no verificada, se ha enviado un nuevo correo de verificación.",
  },
  "signup.invalidVerificationParams": {
    en: "Missing or invalid verification parameters",
    tr: "Eksik veya geçersiz doğrulama parametreleri",
    es: "Parámetros de verificación faltantes o inválidos",
  },
  "signup.invalidVerificationLink": {
    en: "Invalid verification link",
    tr: "Geçersiz doğrulama bağlantısı",
    es: "Enlace de verificación inválido",
  },
  "signup.emailVerified": {
    en: "Email verified successfully.",
    tr: "E-posta başarıyla doğrulandı.",
    es: "Correo electrónico verificado exitosamente.",
  },
  "signup.tooManyVerificationChecks": {
    en: "Too many verification status checks",
    tr: "Çok fazla doğrulama durum kontrolü",
    es: "Demasiadas verificaciones de estado",
  },
  "signup.missingEmail": {
    en: "Missing email",
    tr: "E-posta eksik",
    es: "Falta el correo electrónico",
  },

  // ── Password Reset ──
  "reset.invalidOrExpiredToken": {
    en: "Invalid or expired reset token",
    tr: "Geçersiz veya süresi dolmuş sıfırlama jetonu",
    es: "Token de restablecimiento inválido o expirado",
  },
  "reset.linkExpired": {
    en: "Reset link has expired",
    tr: "Sıfırlama bağlantısının süresi doldu",
    es: "El enlace de restablecimiento ha expirado",
  },
  "reset.invalidLink": {
    en: "Invalid reset link",
    tr: "Geçersiz sıfırlama bağlantısı",
    es: "Enlace de restablecimiento inválido",
  },
  "reset.tokenAlreadyUsed": {
    en: "This reset token has already been used",
    tr: "Bu sıfırlama jetonu zaten kullanıldı",
    es: "Este token de restablecimiento ya fue utilizado",
  },
  "reset.tokenExpired": {
    en: "Reset token has expired",
    tr: "Sıfırlama jetonunun süresi doldu",
    es: "El token de restablecimiento ha expirado",
  },
  "reset.successNoSession": {
    en: "Password reset. Please log in.",
    tr: "Şifre sıfırlandı. Lütfen giriş yapın.",
    es: "Contraseña restablecida. Por favor, inicie sesión.",
  },
  "reset.success": {
    en: "Password reset successfully",
    tr: "Şifre başarıyla sıfırlandı",
    es: "Contraseña restablecida exitosamente",
  },

  // ── Plan / Entitlement ──
  "plan.configError": {
    en: "Plan configuration error. Please contact support.",
    tr: "Plan yapılandırma hatası. Lütfen destek ile iletişime geçin.",
    es: "Error de configuración del plan. Contacte al soporte.",
  },
  "plan.subscriptionInactive": {
    en: "Subscription inactive. Please upgrade or renew your plan.",
    tr: "Abonelik etkin değil. Lütfen planınızı yükseltin veya yenileyin.",
    es: "Suscripción inactiva. Actualice o renueve su plan.",
  },
  "plan.conversationLimitReached": {
    en: "Monthly conversation limit reached ({used}/{limit}). Upgrade your plan for more.",
    tr: "Aylık konuşma limiti doldu ({used}/{limit}). Daha fazlası için planınızı yükseltin.",
    es: "Límite mensual de conversaciones alcanzado ({used}/{limit}). Actualice su plan.",
  },
  "plan.messageLimitReached": {
    en: "Monthly message limit reached ({used}/{limit}). Upgrade your plan for more.",
    tr: "Aylık mesaj limiti doldu ({used}/{limit}). Daha fazlası için planınızı yükseltin.",
    es: "Límite mensual de mensajes alcanzado ({used}/{limit}). Actualice su plan.",
  },
  "plan.trialExpired": {
    en: "Trial period has expired. Please upgrade to continue.",
    tr: "Deneme süresi doldu. Devam etmek için lütfen planınızı yükseltin.",
    es: "El período de prueba ha expirado. Actualice para continuar.",
  },
};

/**
 * Get translated message by key.
 * Supports {placeholder} interpolation.
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const entry = messages[key];
  if (!entry) {
    // Fallback: return the English message or the key itself
    return key;
  }

  let msg = entry[locale] || entry.en;

  // Interpolate {placeholder} patterns
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return msg;
}

/**
 * Detect request locale from body → cookie → Accept-Language header.
 * Re-uses the same priority chain as email templates.
 *
 * @param bodyLocale - Explicit locale from request body (highest priority)
 */
export function getRequestLocale(request: FastifyRequest, bodyLocale?: string): Locale {
  const cookieLang = extractLocaleCookie(request.headers.cookie as string);
  return normalizeRequestLocale(
    bodyLocale,
    cookieLang,
    request.headers["accept-language"] as string
  );
}
