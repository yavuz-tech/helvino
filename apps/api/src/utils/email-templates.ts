/**
 * Email Templates with i18n — Step 11.27
 *
 * Transactional email templates for:
 * - Portal invites
 * - Password reset
 * - Recovery approval / rejection
 * - Emergency token notification
 *
 * All templates support EN / TR / ES.
 * Avoids jargon: says "Authenticator app" not "TOTP".
 */

type Locale = "en" | "tr" | "es";

// ── Base HTML wrapper ──

const footerText: Record<Locale, string> = {
  en: "Helvion &mdash; Secure customer communication",
  tr: "Helvion &mdash; G\u00FCvenli m\u00FC\u015Fteri ileti\u015Fimi",
  es: "Helvion &mdash; Comunicaci\u00F3n segura con clientes",
};

function wrapHtml(content: string, brandColor = "#0F5C5C", locale: Locale = "en"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:${brandColor};padding:24px 32px;">
<span style="font-size:20px;font-weight:700;color:#fff;">Helvion</span>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">${footerText[locale]}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buttonHtml(url: string, label: string, color = "#0F5C5C"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:${color};border-radius:6px;padding:12px 28px;">
<a href="${url}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>
</td></tr>
</table>`;
}

// ── Templates ──

// ── 1. Portal Invite ──

const inviteTemplates: Record<Locale, { subject: (orgName: string) => string; body: (orgName: string, role: string, link: string, expiresIn: string) => string }> = {
  en: {
    subject: (orgName) => `You've been invited to ${orgName} on Helvion`,
    body: (orgName, role, link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">You're invited!</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  You've been invited to join <strong>${orgName}</strong> as <strong>${role}</strong>.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Click the button below to accept and create your account:
</p>
${buttonHtml(link, "Accept Invitation")}
<p style="color:#94a3b8;font-size:12px;">
  This link expires in ${expiresIn}. If you didn't expect this invitation, you can safely ignore this email.
</p>
`, "#0F5C5C", "en"),
  },
  tr: {
    subject: (orgName) => `${orgName} sizi Helvion'a davet etti`,
    body: (orgName, role, link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Davetlisiniz!</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  <strong>${orgName}</strong> organizasyonuna <strong>${role}</strong> olarak davet edildiniz.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Daveti kabul etmek ve hesabınızı oluşturmak için aşağıdaki düğmeye tıklayın:
</p>
${buttonHtml(link, "Daveti Kabul Et")}
<p style="color:#94a3b8;font-size:12px;">
  Bu bağlantı ${expiresIn} içinde geçerlidir. Bu daveti beklemiyorsanız bu e-postayı görmezden gelebilirsiniz.
</p>
`, "#0F5C5C", "tr"),
  },
  es: {
    subject: (orgName) => `Has sido invitado a ${orgName} en Helvion`,
    body: (orgName, role, link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">¡Estás invitado!</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Has sido invitado a unirte a <strong>${orgName}</strong> como <strong>${role}</strong>.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Haz clic en el botón de abajo para aceptar y crear tu cuenta:
</p>
${buttonHtml(link, "Aceptar Invitación")}
<p style="color:#94a3b8;font-size:12px;">
  Este enlace caduca en ${expiresIn}. Si no esperabas esta invitación, puedes ignorar este correo.
</p>
`, "#0F5C5C", "es"),
  },
};

// ── 2. Password Reset ──

const resetTemplates: Record<Locale, { subject: () => string; body: (link: string, expiresIn: string) => string }> = {
  en: {
    subject: () => "Reset your Helvion password",
    body: (link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Password Reset</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  We received a request to reset your password. Click the button below to choose a new password:
</p>
${buttonHtml(link, "Reset Password")}
<p style="color:#94a3b8;font-size:12px;">
  This link expires in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.
  Your password will remain unchanged.
</p>
`, "#0F5C5C", "en"),
  },
  tr: {
    subject: () => "Helvion şifrenizi sıfırlayın",
    body: (link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Şifre Sıfırlama</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Şifrenizi sıfırlama isteği aldık. Yeni bir şifre belirlemek için aşağıdaki düğmeye tıklayın:
</p>
${buttonHtml(link, "Şifreyi Sıfırla")}
<p style="color:#94a3b8;font-size:12px;">
  Bu bağlantı ${expiresIn} içinde geçerlidir. Şifre sıfırlama isteğinde bulunmadıysanız bu e-postayı görmezden gelebilirsiniz.
  Şifreniz değişmeden kalacaktır.
</p>
`, "#0F5C5C", "tr"),
  },
  es: {
    subject: () => "Restablece tu contraseña de Helvion",
    body: (link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Restablecer Contraseña</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para elegir una nueva:
</p>
${buttonHtml(link, "Restablecer Contraseña")}
<p style="color:#94a3b8;font-size:12px;">
  Este enlace caduca en ${expiresIn}. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.
  Tu contraseña permanecerá sin cambios.
</p>
`, "#0F5C5C", "es"),
  },
};

// ── 3. Recovery Approved ──

export type RecoveryApprovedMessageKey = "mfa_reset" | "login_ok";

const recoveryApprovedMessages: Record<Locale, Record<RecoveryApprovedMessageKey, string>> = {
  en: {
    mfa_reset: "Your authenticator app has been reset. You will need to set it up again on next login.",
    login_ok: "You can now log in normally.",
  },
  tr: {
    mfa_reset: "Doğrulayıcı uygulamanız sıfırlandı. Bir sonraki girişte yeniden kurmanız gerekecek.",
    login_ok: "Artık normal şekilde giriş yapabilirsiniz.",
  },
  es: {
    mfa_reset: "Tu aplicación de autenticación se ha restablecido. Deberás configurarla de nuevo en el próximo inicio de sesión.",
    login_ok: "Ahora puedes iniciar sesión con normalidad.",
  },
};

const recoveryApprovedTemplates: Record<Locale, { subject: () => string; body: (message: string) => string }> = {
  en: {
    subject: () => "Your Helvion account recovery has been approved",
    body: (message) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recovery Approved</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Your account recovery request has been approved. ${message}
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  You can now log in to your account. If your authenticator app was reset, you will be prompted to set it up again.
</p>
<p style="color:#94a3b8;font-size:12px;">
  If you did not request account recovery, please contact support immediately.
</p>
`, "#0F5C5C", "en"),
  },
  tr: {
    subject: () => "Helvion hesap kurtarma isteğiniz onaylandı",
    body: (message) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Kurtarma Onaylandı</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Hesap kurtarma isteğiniz onaylandı. ${message}
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Artık hesabınıza giriş yapabilirsiniz. Doğrulama uygulamanız sıfırlandıysa yeniden kurmanız istenecektir.
</p>
<p style="color:#94a3b8;font-size:12px;">
  Hesap kurtarma talebinde bulunmadıysanız derhal desteğe başvurun.
</p>
`, "#0F5C5C", "tr"),
  },
  es: {
    subject: () => "Tu recuperación de cuenta Helvion ha sido aprobada",
    body: (message) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recuperación Aprobada</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Tu solicitud de recuperación de cuenta ha sido aprobada. ${message}
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Ahora puedes iniciar sesión. Si tu aplicación de autenticación fue restablecida, se te pedirá configurarla de nuevo.
</p>
<p style="color:#94a3b8;font-size:12px;">
  Si no solicitaste la recuperación de cuenta, contacta al soporte de inmediato.
</p>
`, "#0F5C5C", "es"),
  },
};

// ── 4. Recovery Rejected ──

const recoveryRejectedTemplates: Record<Locale, { subject: () => string; body: (reason: string) => string }> = {
  en: {
    subject: () => "Your Helvion account recovery request was denied",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recovery Denied</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Your account recovery request has been reviewed and denied.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  If you believe this is an error, please contact support with additional verification.
</p>
`, "#0F5C5C", "en"),
  },
  tr: {
    subject: () => "Helvion hesap kurtarma isteğiniz reddedildi",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Kurtarma Reddedildi</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Hesap kurtarma isteğiniz incelendi ve reddedildi.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Neden:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Bunun bir hata olduğunu düşünüyorsanız ek doğrulama ile desteğe başvurun.
</p>
`, "#0F5C5C", "tr"),
  },
  es: {
    subject: () => "Tu solicitud de recuperación de cuenta Helvion fue denegada",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recuperación Denegada</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Tu solicitud de recuperación de cuenta ha sido revisada y denegada.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Motivo:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Si crees que esto es un error, contacta al soporte con verificación adicional.
</p>
`, "#0F5C5C", "es"),
  },
};

// ── 5. Emergency Token Generated ──

const emergencyTokenTemplates: Record<Locale, { subject: () => string; body: () => string }> = {
  en: {
    subject: () => "Emergency access token generated for your Helvion account",
    body: () => wrapHtml(`
<h2 style="margin:0 0 16px;color:#dc2626;font-size:20px;">⚠️ Emergency Access</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  An emergency access token was generated for your account. This token provides limited access
  to reset your security settings.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  <strong>If you did not generate this token, your account may be compromised.</strong>
  Please change your password and review your security settings immediately.
</p>
<p style="color:#94a3b8;font-size:12px;">
  The token expires in 10 minutes and can only be used once.
  A new token cannot be generated for 30 days.
</p>
`, "#0F5C5C", "en"),
  },
  tr: {
    subject: () => "Helvion hesabınız için acil erişim anahtarı oluşturuldu",
    body: () => wrapHtml(`
<h2 style="margin:0 0 16px;color:#dc2626;font-size:20px;">⚠️ Acil Erişim</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Hesabınız için bir acil erişim anahtarı oluşturuldu. Bu anahtar güvenlik ayarlarınızı
  sıfırlamak için sınırlı erişim sağlar.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  <strong>Bu anahtarı siz oluşturmadıysanız hesabınız tehlikeye girmiş olabilir.</strong>
  Lütfen şifrenizi hemen değiştirin ve güvenlik ayarlarınızı gözden geçirin.
</p>
<p style="color:#94a3b8;font-size:12px;">
  Anahtar 10 dakika içinde sona erer ve yalnızca bir kez kullanılabilir.
  Yeni bir anahtar 30 gün boyunca oluşturulamaz.
</p>
`, "#0F5C5C", "tr"),
  },
  es: {
    subject: () => "Se generó un token de acceso de emergencia para tu cuenta Helvion",
    body: () => wrapHtml(`
<h2 style="margin:0 0 16px;color:#dc2626;font-size:20px;">⚠️ Acceso de Emergencia</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Se generó un token de acceso de emergencia para tu cuenta. Este token proporciona acceso limitado
  para restablecer tu configuración de seguridad.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  <strong>Si no generaste este token, tu cuenta puede estar comprometida.</strong>
  Cambia tu contraseña y revisa tu configuración de seguridad de inmediato.
</p>
<p style="color:#94a3b8;font-size:12px;">
  El token caduca en 10 minutos y solo puede usarse una vez.
  No se puede generar un nuevo token durante 30 días.
</p>
`, "#0F5C5C", "es"),
  },
};

// ── Public API ──

function resolveLocale(lang?: string): Locale {
  if (lang === "tr") return "tr";
  if (lang === "es") return "es";
  return "en";
}

/**
 * Normalize request locale to email locale (en/tr/es).
 * Priority chain (first truthy wins):
 *   1. body.locale — frontend explicitly sends UI language
 *   2. helvino_lang cookie — i18n system persists user's language choice (180d)
 *   3. Accept-Language header — browser language
 *   4. "en" fallback
 */
export function normalizeRequestLocale(locale?: string, cookieLocale?: string, acceptLanguage?: string): Locale {
  // 1. Explicit body.locale from frontend
  if (locale !== undefined && locale !== null && locale !== "") return resolveLocale(locale);
  // 2. helvino_lang cookie (set by i18n context)
  if (cookieLocale !== undefined && cookieLocale !== null && cookieLocale !== "") return resolveLocale(cookieLocale);
  // 3. Accept-Language
  if (acceptLanguage) {
    const first = acceptLanguage.split(",")[0]?.toLowerCase().trim() || "";
    if (first.startsWith("tr")) return "tr";
    if (first.startsWith("es")) return "es";
  }
  return "en";
}

/** Extract helvino_lang cookie value from raw Cookie header string */
export function extractLocaleCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)helvino_lang=([^;]*)/);
  return match ? match[1] : undefined;
}

const invitePlainTexts: Record<Locale, (orgName: string, role: string, link: string, expiresIn: string) => string> = {
  en: (orgName, role, link, expiresIn) =>
    `You're invited!\n\nYou've been invited to join ${orgName} as ${role}. Click the link below to accept and create your account:\n\n${link}\n\nThis link expires in ${expiresIn}. If you didn't expect this invitation, you can safely ignore this email.\n\n— Helvion`,
  tr: (orgName, role, link, expiresIn) =>
    `Davetlisiniz!\n\n${orgName} organizasyonuna ${role} olarak davet edildiniz. Daveti kabul etmek ve hesabınızı oluşturmak için aşağıdaki bağlantıya tıklayın:\n\n${link}\n\nBu bağlantı ${expiresIn} içinde geçerlidir. Bu daveti beklemiyorsanız bu e-postayı görmezden gelebilirsiniz.\n\n— Helvion`,
  es: (orgName, role, link, expiresIn) =>
    `¡Estás invitado!\n\nHas sido invitado a unirte a ${orgName} como ${role}. Haz clic en el enlace para aceptar y crear tu cuenta:\n\n${link}\n\nEste enlace caduca en ${expiresIn}. Si no esperabas esta invitación, puedes ignorar este correo.\n\n— Helvion`,
};

/** Translate role names (agent/admin/owner) for email templates */
const roleNames: Record<Locale, Record<string, string>> = {
  en: { agent: "Agent", admin: "Admin", owner: "Owner" },
  tr: { agent: "Temsilci", admin: "Yönetici", owner: "Sahip" },
  es: { agent: "Agente", admin: "Administrador", owner: "Propietario" },
};

function translateRole(role: string, locale: Locale): string {
  return roleNames[locale][role.toLowerCase()] || role;
}

export function getInviteEmail(locale: string | undefined, orgName: string, role: string, link: string, expiresIn: string) {
  const l = resolveLocale(locale);
  const localizedRole = translateRole(role, l);
  return {
    subject: inviteTemplates[l].subject(orgName),
    html: inviteTemplates[l].body(orgName, localizedRole, link, expiresIn),
    text: invitePlainTexts[l](orgName, localizedRole, link, expiresIn),
  };
}

const resetPlainTexts: Record<Locale, (link: string, expiresIn: string) => string> = {
  en: (link, expiresIn) =>
    `Password Reset\n\nWe received a request to reset your password. Click the link below to choose a new password:\n\n${link}\n\nThis link expires in ${expiresIn}. If you didn't request a password reset, you can safely ignore this email.\n\n— Helvion`,
  tr: (link, expiresIn) =>
    `Şifre Sıfırlama\n\nŞifrenizi sıfırlama isteği aldık. Yeni bir şifre belirlemek için aşağıdaki bağlantıya tıklayın:\n\n${link}\n\nBu bağlantı ${expiresIn} içinde geçerlidir. Şifre sıfırlama isteğinde bulunmadıysanız bu e-postayı görmezden gelebilirsiniz.\n\n— Helvion`,
  es: (link, expiresIn) =>
    `Restablecer Contraseña\n\nRecibimos una solicitud para restablecer tu contraseña. Haz clic en el enlace para elegir una nueva:\n\n${link}\n\nEste enlace caduca en ${expiresIn}. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.\n\n— Helvion`,
};

export function getResetEmail(locale: string | undefined, link: string, expiresIn: string) {
  const l = resolveLocale(locale);
  return {
    subject: resetTemplates[l].subject(),
    html: resetTemplates[l].body(link, expiresIn),
    text: resetPlainTexts[l](link, expiresIn),
  };
}

export function getRecoveryApprovedEmail(locale: string | undefined, messageKey: RecoveryApprovedMessageKey) {
  const l = resolveLocale(locale);
  const message = recoveryApprovedMessages[l][messageKey];
  return {
    subject: recoveryApprovedTemplates[l].subject(),
    html: recoveryApprovedTemplates[l].body(message),
  };
}

export function getRecoveryRejectedEmail(locale: string | undefined, reason: string) {
  const l = resolveLocale(locale);
  return {
    subject: recoveryRejectedTemplates[l].subject(),
    html: recoveryRejectedTemplates[l].body(reason),
  };
}

export function getEmergencyTokenEmail(locale: string | undefined) {
  const l = resolveLocale(locale);
  return {
    subject: emergencyTokenTemplates[l].subject(),
    html: emergencyTokenTemplates[l].body(),
  };
}

// ── 6. Email Verification (warm + friendly, Gmail-safe div layout) ──

const verifyFooterText: Record<Locale, string> = {
  en: "Helvion \u2014 Customer communication platform",
  tr: "Helvion \u2014 M\u00FC\u015Fteri ileti\u015Fim platformu",
  es: "Helvion \u2014 Plataforma de comunicaci\u00F3n con clientes",
};

function verifyHtml(content: string, locale: Locale = "en"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#333;background:#f9fafb;">
<div style="max-width:540px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border-radius:12px;padding:36px 32px;border:1px solid #e5e7eb;">
<div style="text-align:center;margin-bottom:24px;">
  <span style="font-size:28px;font-weight:700;color:#0F5C5C;">Helvion</span>
</div>
${content}
</div>
<p style="text-align:center;margin-top:24px;font-size:12px;color:#9ca3af;">
  ${verifyFooterText[locale]}<br>
  <a href="https://helvion.io" style="color:#9ca3af;">helvion.io</a>
</p>
</div>
</body>
</html>`;
}

const verifyEmailTemplates: Record<Locale, { subject: () => string; body: (link: string) => string }> = {
  en: {
    subject: () => "Helvion - Verify your email address",
    body: (link) => verifyHtml(`
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">\u{1F44B} Hey, welcome aboard!</h2>
<p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px;">We\u2019re so glad you\u2019re here.</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 8px;">
  You\u2019re just one step away from getting started \u{1F680}
</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 24px;">
  Click the button below to verify your email and activate your account:
</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${link}" style="display:inline-block;background:#0F5C5C;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">\u2705 Verify My Email</a>
</div>
<div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:24px 0 0;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">\u{1F4AC} What\u2019s next?</p>
  <p style="margin:0;font-size:13px;color:#15803d;line-height:1.6;">
    \u2714\uFE0F Set up your live chat widget in minutes<br>
    \u2714\uFE0F Start real-time conversations with visitors<br>
    \u2714\uFE0F Explore AI-powered tools for your team
  </p>
</div>
<p style="font-size:12px;color:#9ca3af;margin-top:24px;line-height:1.5;">
  This link is valid for 24 hours. If you didn\u2019t sign up for Helvion, just ignore this email \u2014 no worries!
</p>
<p style="font-size:13px;color:#6b7280;margin-top:16px;">
  Cheers \u{1F49A}<br>
  <strong>The Helvion Team</strong>
</p>
`, "en"),
  },
  tr: {
    subject: () => "Helvion - E-posta adresinizi do\u011Frulay\u0131n",
    body: (link) => verifyHtml(`
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">\u{1F44B} Merhaba, ho\u015F geldiniz!</h2>
<p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px;">Sizi aram\u0131zda g\u00F6rmekten \u00E7ok mutluyuz.</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 8px;">
  Ba\u015Flamak i\u00E7in sadece bir ad\u0131m kald\u0131 \u{1F680}
</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 24px;">
  A\u015Fa\u011F\u0131daki butona t\u0131klayarak e-posta adresinizi do\u011Frulay\u0131n ve hesab\u0131n\u0131z\u0131 aktifle\u015Ftirin:
</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${link}" style="display:inline-block;background:#0F5C5C;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">\u2705 E-postam\u0131 Do\u011Frula</a>
</div>
<div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:24px 0 0;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">\u{1F4AC} S\u0131rada ne var?</p>
  <p style="margin:0;font-size:13px;color:#15803d;line-height:1.6;">
    \u2714\uFE0F Canl\u0131 sohbet widget\u2019\u0131n\u0131z\u0131 dakikalar i\u00E7inde kurun<br>
    \u2714\uFE0F Ziyaret\u00E7ilerinizle ger\u00E7ek zamanl\u0131 sohbet ba\u015Flat\u0131n<br>
    \u2714\uFE0F Yapay zeka destekli ara\u00E7lar\u0131 ke\u015Ffedin
  </p>
</div>
<p style="font-size:12px;color:#9ca3af;margin-top:24px;line-height:1.5;">
  Bu ba\u011Flant\u0131 24 saat ge\u00E7erlidir. E\u011Fer bu hesab\u0131 siz olu\u015Fturmad\u0131ysan\u0131z bu e-postay\u0131 g\u00F6rmezden gelebilirsiniz \u2014 sorun de\u011Fil!
</p>
<p style="font-size:13px;color:#6b7280;margin-top:16px;">
  Sevgilerle \u{1F49A}<br>
  <strong>Helvion Ekibi</strong>
</p>
`, "tr"),
  },
  es: {
    subject: () => "Helvion - Verifica tu direcci\u00F3n de email",
    body: (link) => verifyHtml(`
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">\u{1F44B} \u00A1Hola, bienvenido!</h2>
<p style="text-align:center;color:#6b7280;font-size:14px;margin:0 0 24px;">\u00A1Nos alegra mucho que est\u00E9s aqu\u00ED!</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 8px;">
  Est\u00E1s a un solo paso de comenzar \u{1F680}
</p>
<p style="font-size:14px;line-height:1.7;color:#374151;margin:0 0 24px;">
  Haz clic en el bot\u00F3n de abajo para verificar tu email y activar tu cuenta:
</p>
<div style="text-align:center;margin:28px 0;">
  <a href="${link}" style="display:inline-block;background:#0F5C5C;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">\u2705 Verificar mi Email</a>
</div>
<div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin:24px 0 0;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">\u{1F4AC} \u00BFQu\u00E9 sigue?</p>
  <p style="margin:0;font-size:13px;color:#15803d;line-height:1.6;">
    \u2714\uFE0F Configura tu widget de chat en minutos<br>
    \u2714\uFE0F Empieza conversaciones en tiempo real<br>
    \u2714\uFE0F Explora herramientas de IA para tu equipo
  </p>
</div>
<p style="font-size:12px;color:#9ca3af;margin-top:24px;line-height:1.5;">
  Este enlace es v\u00E1lido por 24 horas. Si no creaste una cuenta, ignora este correo \u2014 \u00A1sin problema!
</p>
<p style="font-size:13px;color:#6b7280;margin-top:16px;">
  Con cari\u00F1o \u{1F49A}<br>
  <strong>El equipo de Helvion</strong>
</p>
`, "es"),
  },
};

// Plain text versions for better deliverability (Gmail prefers multipart)
const verifyEmailPlainText: Record<Locale, (link: string) => string> = {
  en: (link) => `\u{1F44B} Hey, welcome aboard!

We\u2019re so glad you\u2019re here.

You\u2019re just one step away from getting started \u{1F680}
Click the link below to verify your email and activate your account:

${link}

\u{1F4AC} What\u2019s next?
\u2714\uFE0F Set up your live chat widget in minutes
\u2714\uFE0F Start real-time conversations with visitors
\u2714\uFE0F Explore AI-powered tools for your team

This link is valid for 24 hours. If you didn\u2019t sign up for Helvion, just ignore this email.

Cheers \u{1F49A}
The Helvion Team`,
  tr: (link) => `\u{1F44B} Merhaba, ho\u015F geldiniz!

Sizi aram\u0131zda g\u00F6rmekten \u00E7ok mutluyuz.

Ba\u015Flamak i\u00E7in sadece bir ad\u0131m kald\u0131 \u{1F680}
A\u015Fa\u011F\u0131daki ba\u011Flant\u0131ya t\u0131klayarak e-posta adresinizi do\u011Frulay\u0131n:

${link}

\u{1F4AC} S\u0131rada ne var?
\u2714\uFE0F Canl\u0131 sohbet widget\u2019\u0131n\u0131z\u0131 dakikalar i\u00E7inde kurun
\u2714\uFE0F Ziyaret\u00E7ilerinizle ger\u00E7ek zamanl\u0131 sohbet ba\u015Flat\u0131n
\u2714\uFE0F Yapay zeka destekli ara\u00E7lar\u0131 ke\u015Ffedin

Bu ba\u011Flant\u0131 24 saat ge\u00E7erlidir. E\u011Fer bu hesab\u0131 siz olu\u015Fturmad\u0131ysan\u0131z g\u00F6rmezden gelebilirsiniz.

Sevgilerle \u{1F49A}
Helvion Ekibi`,
  es: (link) => `\u{1F44B} \u00A1Hola, bienvenido!

\u00A1Nos alegra mucho que est\u00E9s aqu\u00ED!

Est\u00E1s a un solo paso de comenzar \u{1F680}
Haz clic en el enlace para verificar tu email:

${link}

\u{1F4AC} \u00BFQu\u00E9 sigue?
\u2714\uFE0F Configura tu widget de chat en minutos
\u2714\uFE0F Empieza conversaciones en tiempo real
\u2714\uFE0F Explora herramientas de IA para tu equipo

Este enlace es v\u00E1lido por 24 horas. Si no creaste una cuenta, ignora este correo.

Con cari\u00F1o \u{1F49A}
El equipo de Helvion`,
};

export function getVerifyEmailContent(locale: string | undefined, link: string) {
  const l = resolveLocale(locale);
  return {
    subject: verifyEmailTemplates[l].subject(),
    html: verifyEmailTemplates[l].body(link),
    text: verifyEmailPlainText[l](link),
  };
}
