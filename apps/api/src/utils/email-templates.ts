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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Base HTML wrapper ──

const footerText: Record<Locale, string> = {
  en: "Helvion &mdash; Secure customer communication",
  tr: "Helvion &mdash; G\u00FCvenli m\u00FC\u015Fteri ileti\u015Fimi",
  es: "Helvion &mdash; Comunicaci\u00F3n segura con clientes",
};

const warmEmailColors = {
  primary: "#1A1D23",
  accent: "#F59E0B",
  highlight: "#FB7185",
  background: "#FFFBEB",
  muted: "#64748B",
};

function applyWarmPalette(content: string): string {
  const replacements: Array<[string, string]> = [
    ["#1f1b4d", warmEmailColors.primary],
    ["#0F5C5C", warmEmailColors.accent],
    ["#0f5c5c", warmEmailColors.accent],
    ["#4f46e5", warmEmailColors.accent],
    ["#4338ca", warmEmailColors.highlight],
    ["#1d4ed8", warmEmailColors.accent],
    ["#6d28d9", warmEmailColors.highlight],
    ["#5b21b6", warmEmailColors.highlight],
    ["#1e293b", warmEmailColors.primary],
    ["#0f172a", warmEmailColors.primary],
    ["#0b1020", warmEmailColors.primary],
    ["#1f2937", warmEmailColors.primary],
    ["#334155", "#334155"],
    ["#374151", "#334155"],
    ["#475569", warmEmailColors.muted],
    ["#6b7280", warmEmailColors.muted],
    ["#64748b", warmEmailColors.muted],
    ["#94a3b8", warmEmailColors.muted],
    ["#9ca3af", warmEmailColors.muted],
    ["#dc2626", warmEmailColors.highlight],
    ["#b91c1c", warmEmailColors.highlight],
    ["#f8fafc", warmEmailColors.background],
    ["#f9fafb", warmEmailColors.background],
    ["#eef2ff", "#FFF7ED"],
    ["#eff6ff", "#FFFBEB"],
    ["#f5f3ff", "#FFF7ED"],
    ["#ede9fe", "#FEF3C7"],
    ["#f0fdf4", "#FFFBEB"],
    ["#e2e8f0", "#FDE68A"],
    ["#e5e7eb", "#FDE68A"],
    ["#ddd6fe", "#FDE68A"],
    ["#c7d2fe", "#FDE68A"],
    ["#bfdbfe", "#FDE68A"],
    ["#166534", "#B45309"],
    ["#15803d", "#92400E"],
  ];

  return replacements.reduce((acc, [from, to]) => acc.split(from).join(to), content);
}

function wrapHtml(content: string, brandColor = warmEmailColors.accent, locale: Locale = "en"): string {
  const themedContent = applyWarmPalette(content);
  const themedBrandColor = applyWarmPalette(brandColor);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body, .email-bg, .email-card, .email-footer, .email-content {
    background-color: inherit;
    color: inherit;
  }
  @media (prefers-color-scheme: dark) {
    body, .email-bg, .email-card, .email-content, .email-footer {
      background: ${warmEmailColors.background} !important;
      color: ${warmEmailColors.primary} !important;
    }
    .email-card { background: #ffffff !important; border-color: #FDE68A !important; }
    .email-footer { background: ${warmEmailColors.background} !important; }
  }
</style>
</head>
<body bgcolor="${warmEmailColors.background}" style="margin:0;padding:0;background:${warmEmailColors.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table class="email-bg" width="100%" cellpadding="0" cellspacing="0" bgcolor="${warmEmailColors.background}" style="background:${warmEmailColors.background};padding:40px 0;">
<tr><td align="center">
<table class="email-card" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#fff;border-radius:16px;border:1px solid #FDE68A;overflow:hidden;box-shadow:0 12px 32px rgba(245,158,11,0.14);">
<tr><td style="background:${themedBrandColor};padding:24px 32px;">
<span style="font-size:20px;font-weight:700;color:${warmEmailColors.primary};">Helvion</span>
</td></tr>
<tr><td class="email-content" style="padding:32px;background:#ffffff;color:${warmEmailColors.primary};">
${themedContent}
</td></tr>
<tr><td class="email-footer" style="padding:16px 32px;background:${warmEmailColors.background};border-top:1px solid #FDE68A;">
<p style="margin:0;font-size:12px;color:${warmEmailColors.muted};text-align:center;">${footerText[locale]}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buttonHtml(url: string, label: string, color = warmEmailColors.accent): string {
  const themedColor = applyWarmPalette(color);
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="border-radius:12px;background:linear-gradient(135deg, ${themedColor} 0%, #FB923C 100%);padding:0;">
<a href="${url}" style="display:inline-block;padding:14px 30px;border-radius:12px;color:${warmEmailColors.primary};text-decoration:none;font-weight:700;font-size:14px;">${label}</a>
</td></tr>
</table>`;
}

// ── Templates ──

// ── 1. Portal Invite ──

const inviteTemplates: Record<Locale, { subject: (orgName: string) => string; body: (orgName: string, role: string, link: string, expiresIn: string) => string }> = {
  en: {
    subject: (orgName) => `${orgName} invited you to Helvion ✨`,
    body: (orgName, role, link, expiresIn) => {
      const safeOrg = escapeHtml(orgName);
      const safeRole = escapeHtml(role);
      const safeLink = escapeHtml(link);
      return wrapHtml(`
<div style="display:inline-block;margin:0 0 14px;padding:6px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Helvion Access ✨</div>
<p style="margin:0 0 8px;color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Team Invitation</p>
<h2 style="margin:0 0 10px;color:#0b1020;font-size:24px;line-height:1.25;">Welcome aboard! 👋</h2>
<p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.7;">
  You have been invited to join <strong>${safeOrg}</strong> on Helvion as <strong>${safeRole}</strong>.
</p>

<div style="margin:0 0 22px;padding:14px 16px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;">
  <p style="margin:0 0 6px;color:#6d28d9;font-size:12px;font-weight:700;">Invitation details</p>
  <p style="margin:0;color:#0f172a;font-size:13px;line-height:1.6;">
    Organization: <strong>${safeOrg}</strong><br>
    Role: <strong>${safeRole}</strong>
  </p>
</div>

<p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">
  Click below to accept your invitation and create your account:
</p>
${buttonHtml(link, "Accept Invitation", "#4f46e5")}

<div style="margin-top:12px;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;">
  <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;">Can’t use the button?</p>
  <a href="${safeLink}" style="color:#4338ca;font-size:12px;word-break:break-all;">${safeLink}</a>
</div>

<p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
  This link is valid for ${expiresIn}. If you were not expecting this invitation, you can safely ignore this email.
</p>
<p style="margin:12px 0 0;color:#64748b;font-size:13px;">
  See you in Helvion! 🚀
</p>
`, "#1f1b4d", "en");
    },
  },
  tr: {
    subject: (orgName) => `${orgName} sizi Helvion'a davet etti ✨`,
    body: (orgName, role, link, expiresIn) => {
      const safeOrg = escapeHtml(orgName);
      const safeRole = escapeHtml(role);
      const safeLink = escapeHtml(link);
      return wrapHtml(`
<div style="display:inline-block;margin:0 0 14px;padding:6px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Helvion Daveti ✨</div>
<p style="margin:0 0 8px;color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Ekip Daveti</p>
<h2 style="margin:0 0 10px;color:#0b1020;font-size:24px;line-height:1.25;">Aramıza hoş geldiniz! 👋</h2>
<p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.7;">
  <strong>${safeOrg}</strong> organizasyonuna Helvion üzerinde <strong>${safeRole}</strong> olarak davet edildiniz.
</p>

<div style="margin:0 0 22px;padding:14px 16px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;">
  <p style="margin:0 0 6px;color:#6d28d9;font-size:12px;font-weight:700;">Davet detayları</p>
  <p style="margin:0;color:#0f172a;font-size:13px;line-height:1.6;">
    Organizasyon: <strong>${safeOrg}</strong><br>
    Rol: <strong>${safeRole}</strong>
  </p>
</div>

<p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">
  Daveti kabul edip hesabınızı oluşturmak için aşağıdaki butona tıklayın:
</p>
${buttonHtml(link, "Daveti Kabul Et", "#4f46e5")}

<div style="margin-top:12px;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;">
  <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;">Buton açılmazsa bağlantıyı kullanın:</p>
  <a href="${safeLink}" style="color:#4338ca;font-size:12px;word-break:break-all;">${safeLink}</a>
</div>

<p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
  Bu bağlantı ${expiresIn} boyunca geçerlidir. Bu daveti beklemiyorsanız e-postayı güvenle görmezden gelebilirsiniz.
</p>
<p style="margin:12px 0 0;color:#64748b;font-size:13px;">
  Helvion'da görüşmek üzere! 🚀
</p>
`, "#1f1b4d", "tr");
    },
  },
  es: {
    subject: (orgName) => `${orgName} te invitó a Helvion ✨`,
    body: (orgName, role, link, expiresIn) => {
      const safeOrg = escapeHtml(orgName);
      const safeRole = escapeHtml(role);
      const safeLink = escapeHtml(link);
      return wrapHtml(`
<div style="display:inline-block;margin:0 0 14px;padding:6px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Invitación Helvion ✨</div>
<p style="margin:0 0 8px;color:#6d28d9;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Invitación al equipo</p>
<h2 style="margin:0 0 10px;color:#0b1020;font-size:24px;line-height:1.25;">¡Bienvenido al equipo! 👋</h2>
<p style="margin:0 0 22px;color:#475569;font-size:14px;line-height:1.7;">
  Has sido invitado a <strong>${safeOrg}</strong> en Helvion como <strong>${safeRole}</strong>.
</p>

<div style="margin:0 0 22px;padding:14px 16px;border-radius:10px;background:#f5f3ff;border:1px solid #ddd6fe;">
  <p style="margin:0 0 6px;color:#6d28d9;font-size:12px;font-weight:700;">Detalles de la invitación</p>
  <p style="margin:0;color:#0f172a;font-size:13px;line-height:1.6;">
    Organización: <strong>${safeOrg}</strong><br>
    Rol: <strong>${safeRole}</strong>
  </p>
</div>

<p style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">
  Haz clic en el botón para aceptar la invitación y crear tu cuenta:
</p>
${buttonHtml(link, "Aceptar Invitación", "#4f46e5")}

<div style="margin-top:12px;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;">
  <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;">¿No funciona el botón?</p>
  <a href="${safeLink}" style="color:#4338ca;font-size:12px;word-break:break-all;">${safeLink}</a>
</div>

<p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
  Este enlace es válido por ${expiresIn}. Si no esperabas esta invitación, puedes ignorar este correo con tranquilidad.
</p>
<p style="margin:12px 0 0;color:#64748b;font-size:13px;">
  ¡Nos vemos en Helvion! 🚀
</p>
`, "#1f1b4d", "es");
    },
  },
};

// ── 2. Password Reset ──

const resetTemplates: Record<Locale, { subject: () => string; body: (link: string, expiresIn: string) => string }> = {
  en: {
    subject: () => "Reset your Helvion password",
    body: (link, expiresIn) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">🔐 Password Reset</h2>
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
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">🔐 Şifre Sıfırlama</h2>
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
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">🔐 Restablecer Contraseña</h2>
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

// ── 6. Abandoned Checkout ──

const abandonedCheckoutTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (params: {
      name: string;
      planName: string;
      promoCode: string;
      checkoutUrl: string;
      expiresInHours: number;
      discountPercent: number;
    }) => string;
    text: (params: {
      name: string;
      planName: string;
      promoCode: string;
      checkoutUrl: string;
      expiresInHours: number;
      discountPercent: number;
    }) => string;
  }
> = {
  en: {
    subject: () => "Your Helvion checkout is waiting - special offer inside",
    body: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      wrapHtml(
        `
<p style="margin:0 0 10px;color:#6b7280;font-size:14px;">Hi ${escapeHtml(name)},</p>
<h2 style="margin:0 0 14px;color:#0f172a;font-size:24px;line-height:1.3;">You were one step away 🚀</h2>
<p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.7;">
  We noticed you started checkout for <strong>${escapeHtml(planName)}</strong>, but did not complete it.
</p>
<div style="margin:0 0 18px;padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
  <p style="margin:0 0 6px;color:#1d4ed8;font-size:15px;font-weight:700;">Exclusive offer: ${discountPercent}% off 🎁</p>
  <p style="margin:0 0 10px;color:#1f2937;font-size:13px;">Use this one-time code:</p>
  <div style="display:inline-block;border:2px dashed #1d4ed8;border-radius:8px;padding:10px 16px;background:#fff;font-size:22px;font-weight:800;letter-spacing:1.4px;color:#0f172a;">
    ${escapeHtml(promoCode)}
  </div>
</div>
<div style="margin:0 0 18px;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;color:#334155;line-height:1.8;font-size:13px;">
  ✅ Unlimited live chat conversations<br>
  ✅ AI-powered replies and automations<br>
  ✅ Omnichannel support (WhatsApp, Instagram, more)<br>
  ✅ Premium customer support
</div>
${buttonHtml(checkoutUrl, "Complete Checkout", "#0F5C5C")}
<p style="margin:10px 0 0;color:#b91c1c;font-size:13px;font-weight:700;">This offer expires in ${expiresInHours} hours.</p>
`,
        "#0F5C5C",
        "en"
      ),
    text: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      `Hi ${name},\n\nWe noticed you started checkout for ${planName}, but did not complete it.\n\nHere is your one-time ${discountPercent}% discount code: ${promoCode}\n\nComplete checkout: ${checkoutUrl}\n\nThis offer expires in ${expiresInHours} hours.\n\n- Helvion`,
  },
  tr: {
    subject: () => "Helvion odemeniz sizi bekliyor - size ozel teklif",
    body: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      wrapHtml(
        `
<p style="margin:0 0 10px;color:#6b7280;font-size:14px;">Merhaba ${escapeHtml(name)},</p>
<h2 style="margin:0 0 14px;color:#0f172a;font-size:24px;line-height:1.3;">Sadece bir adim kalmisti 🚀</h2>
<p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.7;">
  <strong>${escapeHtml(planName)}</strong> plani icin odeme adimina gectiginizi gorduk, ancak islem tamamlanmamis.
</p>
<div style="margin:0 0 18px;padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
  <p style="margin:0 0 6px;color:#1d4ed8;font-size:15px;font-weight:700;">Size ozel teklif: %${discountPercent} indirim 🎁</p>
  <p style="margin:0 0 10px;color:#1f2937;font-size:13px;">Tek kullanimlik kodunuz:</p>
  <div style="display:inline-block;border:2px dashed #1d4ed8;border-radius:8px;padding:10px 16px;background:#fff;font-size:22px;font-weight:800;letter-spacing:1.4px;color:#0f172a;">
    ${escapeHtml(promoCode)}
  </div>
</div>
<div style="margin:0 0 18px;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;color:#334155;line-height:1.8;font-size:13px;">
  ✅ Sinirsiz canli sohbet gorusmesi<br>
  ✅ Yapay zeka destekli yanitlar ve otomasyonlar<br>
  ✅ Coklu kanal destegi (WhatsApp, Instagram ve daha fazlasi)<br>
  ✅ Premium musteri destegi
</div>
${buttonHtml(checkoutUrl, "Odemeyi Tamamla", "#0F5C5C")}
<p style="margin:10px 0 0;color:#b91c1c;font-size:13px;font-weight:700;">Bu teklif ${expiresInHours} saat icinde sona erer.</p>
`,
        "#0F5C5C",
        "tr"
      ),
    text: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      `Merhaba ${name},\n\n${planName} plani icin odeme adimina gectiginizi gorduk, ancak islem tamamlanmamis.\n\nTek kullanimlik %${discountPercent} indirim kodunuz: ${promoCode}\n\nOdemeyi tamamlayin: ${checkoutUrl}\n\nBu teklif ${expiresInHours} saat icinde sona erer.\n\n- Helvion`,
  },
  es: {
    subject: () => "Tu checkout de Helvion te espera - oferta especial",
    body: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      wrapHtml(
        `
<p style="margin:0 0 10px;color:#6b7280;font-size:14px;">Hola ${escapeHtml(name)},</p>
<h2 style="margin:0 0 14px;color:#0f172a;font-size:24px;line-height:1.3;">Te quedaste a un paso 🚀</h2>
<p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.7;">
  Vimos que iniciaste el checkout para el plan <strong>${escapeHtml(planName)}</strong>, pero no lo completaste.
</p>
<div style="margin:0 0 18px;padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
  <p style="margin:0 0 6px;color:#1d4ed8;font-size:15px;font-weight:700;">Oferta exclusiva: ${discountPercent}% de descuento 🎁</p>
  <p style="margin:0 0 10px;color:#1f2937;font-size:13px;">Tu codigo de un solo uso:</p>
  <div style="display:inline-block;border:2px dashed #1d4ed8;border-radius:8px;padding:10px 16px;background:#fff;font-size:22px;font-weight:800;letter-spacing:1.4px;color:#0f172a;">
    ${escapeHtml(promoCode)}
  </div>
</div>
<div style="margin:0 0 18px;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc;color:#334155;line-height:1.8;font-size:13px;">
  ✅ Conversaciones de chat en vivo ilimitadas<br>
  ✅ Respuestas y automatizaciones con IA<br>
  ✅ Soporte multicanal (WhatsApp, Instagram y mas)<br>
  ✅ Soporte premium
</div>
${buttonHtml(checkoutUrl, "Completar Checkout", "#0F5C5C")}
<p style="margin:10px 0 0;color:#b91c1c;font-size:13px;font-weight:700;">Esta oferta vence en ${expiresInHours} horas.</p>
`,
        "#0F5C5C",
        "es"
      ),
    text: ({ name, planName, promoCode, checkoutUrl, expiresInHours, discountPercent }) =>
      `Hola ${name},\n\nVimos que iniciaste el checkout para ${planName}, pero no lo completaste.\n\nAqui tienes tu codigo de descuento de ${discountPercent}% para un solo uso: ${promoCode}\n\nCompleta el checkout: ${checkoutUrl}\n\nEsta oferta vence en ${expiresInHours} horas.\n\n- Helvion`,
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
export function normalizeRequestLocale(
  locale?: string,
  cookieLocale?: string,
  acceptLanguage?: string,
  fallbackLocale?: string
): Locale {
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
  // 4. Organization/user preferred language fallback
  if (fallbackLocale !== undefined && fallbackLocale !== null && fallbackLocale !== "") {
    return resolveLocale(fallbackLocale);
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
    `Welcome aboard! 👋\n\nYou have been invited to join ${orgName} on Helvion as ${role}.\n\nAccept your invitation:\n${link}\n\nThis link is valid for ${expiresIn}. If you were not expecting this invitation, you can safely ignore this email.\n\nSee you in Helvion! 🚀\n— Helvion`,
  tr: (orgName, role, link, expiresIn) =>
    `Aramıza hoş geldiniz! 👋\n\n${orgName} organizasyonuna Helvion üzerinde ${role} olarak davet edildiniz.\n\nDaveti kabul edin:\n${link}\n\nBu bağlantı ${expiresIn} boyunca geçerlidir. Bu daveti beklemiyorsanız e-postayı güvenle görmezden gelebilirsiniz.\n\nHelvion'da görüşmek üzere! 🚀\n— Helvion`,
  es: (orgName, role, link, expiresIn) =>
    `¡Bienvenido al equipo! 👋\n\nHas sido invitado a ${orgName} en Helvion como ${role}.\n\nAcepta tu invitación:\n${link}\n\nEste enlace es válido por ${expiresIn}. Si no esperabas esta invitación, puedes ignorar este correo con tranquilidad.\n\n¡Nos vemos en Helvion! 🚀\n— Helvion`,
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

export function getAbandonedCheckoutEmail(
  locale: string | undefined,
  params: {
    name: string;
    planName: string;
    promoCode: string;
    checkoutUrl: string;
    expiresInHours: number;
    discountPercent: number;
  }
) {
  const l = resolveLocale(locale);
  return {
    subject: abandonedCheckoutTemplates[l].subject(),
    html: abandonedCheckoutTemplates[l].body(params),
    text: abandonedCheckoutTemplates[l].text(params),
  };
}

// ── 6. Email Verification (warm + friendly, Gmail-safe div layout) ──

const verifyFooterText: Record<Locale, string> = {
  en: "Helvion \u2014 Customer communication platform",
  tr: "Helvion \u2014 M\u00FC\u015Fteri ileti\u015Fim platformu",
  es: "Helvion \u2014 Plataforma de comunicaci\u00F3n con clientes",
};

function verifyHtml(content: string, locale: Locale = "en"): string {
  const themedContent = applyWarmPalette(content);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:${warmEmailColors.primary};background:${warmEmailColors.background};">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #FDE68A;box-shadow:0 12px 32px rgba(245,158,11,0.14);">
<div style="text-align:center;margin-bottom:24px;">
  <span style="font-size:28px;font-weight:700;color:${warmEmailColors.primary};">Helvion</span>
</div>
${themedContent}
</div>
<p style="text-align:center;margin-top:24px;font-size:12px;color:${warmEmailColors.muted};">
  ${verifyFooterText[locale]}<br>
  <a href="https://helvion.io" style="color:${warmEmailColors.highlight};">helvion.io</a>
</p>
</div>
</body>
</html>`;
}

const verifyEmailTemplates: Record<Locale, { subject: () => string; body: (link: string) => string }> = {
  en: {
    subject: () => "Helvion - Verify your email address",
    body: (link) => verifyHtml(`
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">📧 Verify your email</h2>
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
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">📧 E-postanizi dogrulayin</h2>
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
<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;text-align:center;">📧 Verifica tu email</h2>
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

// -- 7. Account Unlock Email --
const unlockTemplates: Record<Locale, { subject: () => string; body: (token: string) => string; text: (token: string) => string }> = {
  en: {
    subject: () => "Your account was temporarily locked",
    body: (token) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">⚠️ Account locked for security</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  We detected too many failed login attempts and temporarily locked your account.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Unlock token:
</p>
<div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#0f172a;word-break:break-all;">${escapeHtml(token)}</code>
</div>
<p style="color:#94a3b8;font-size:12px;line-height:1.6;">
  This token expires in 30 minutes and can be used once.
</p>
`, "#0F5C5C", "en"),
    text: (token) =>
      `Your account was temporarily locked due to too many failed login attempts.\n\nUnlock token:\n${token}\n\nThis token expires in 30 minutes and can be used once.`,
  },
  tr: {
    subject: () => "Hesabiniz gecici olarak kilitlendi",
    body: (token) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">⚠️ Hesabiniz guvenlik nedeniyle kilitlendi</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Cok fazla hatali giris denemesi algiladik ve hesabinizi gecici olarak kilitledik.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Kilit acma tokeni:
</p>
<div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#0f172a;word-break:break-all;">${escapeHtml(token)}</code>
</div>
<p style="color:#94a3b8;font-size:12px;line-height:1.6;">
  Bu token 30 dakika gecerlidir ve tek kullanimliktir.
</p>
`, "#0F5C5C", "tr"),
    text: (token) =>
      `Cok fazla hatali giris denemesi nedeniyle hesabinizi gecici olarak kilitledik.\n\nKilit acma tokeni:\n${token}\n\nBu token 30 dakika gecerlidir ve tek kullanimliktir.`,
  },
  es: {
    subject: () => "Tu cuenta fue bloqueada temporalmente",
    body: (token) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">⚠️ Cuenta bloqueada por seguridad</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Detectamos demasiados intentos fallidos de inicio de sesion y bloqueamos temporalmente tu cuenta.
</p>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Token de desbloqueo:
</p>
<div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
  <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#0f172a;word-break:break-all;">${escapeHtml(token)}</code>
</div>
<p style="color:#94a3b8;font-size:12px;line-height:1.6;">
  Este token expira en 30 minutos y es de un solo uso.
</p>
`, "#0F5C5C", "es"),
    text: (token) =>
      `Detectamos demasiados intentos fallidos y bloqueamos temporalmente tu cuenta.\n\nToken de desbloqueo:\n${token}\n\nEste token expira en 30 minutos y es de un solo uso.`,
  },
};

export function getAccountUnlockEmail(locale: string | undefined, unlockToken: string) {
  const l = resolveLocale(locale);
  return {
    subject: unlockTemplates[l].subject(),
    html: unlockTemplates[l].body(unlockToken),
    text: unlockTemplates[l].text(unlockToken),
  };
}

// -- 8. Password Changed Notification --
const passwordChangedTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (details: { time: string; ip: string; device: string; supportUrl: string }) => string;
    text: (details: { time: string; ip: string; device: string; supportUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "Your password was changed",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">✅ Password changed successfully</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">Your portal password was changed.</p>
<ul style="color:#334155;font-size:13px;line-height:1.7;padding-left:18px;">
  <li><strong>Time:</strong> ${escapeHtml(d.time)}</li>
  <li><strong>IP:</strong> ${escapeHtml(d.ip)}</li>
  <li><strong>Device:</strong> ${escapeHtml(d.device)}</li>
</ul>
<p style="color:#475569;font-size:14px;line-height:1.6;">Wasn't you? Contact support immediately.</p>
${buttonHtml(d.supportUrl, "Contact Support", "#0F5C5C")}
`,
        "#0F5C5C",
        "en"
      ),
    text: (d) =>
      `Your password was changed.\nTime: ${d.time}\nIP: ${d.ip}\nDevice: ${d.device}\nWasn't you? Contact support: ${d.supportUrl}`,
  },
  tr: {
    subject: () => "Sifreniz degistirildi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">✅ Sifreniz basariyla degistirildi</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">Portal sifreniz degistirildi.</p>
<ul style="color:#334155;font-size:13px;line-height:1.7;padding-left:18px;">
  <li><strong>Zaman:</strong> ${escapeHtml(d.time)}</li>
  <li><strong>IP:</strong> ${escapeHtml(d.ip)}</li>
  <li><strong>Cihaz:</strong> ${escapeHtml(d.device)}</li>
</ul>
<p style="color:#475569;font-size:14px;line-height:1.6;">Bu islemi siz yapmadiysaniz hemen destekle iletisime gecin.</p>
${buttonHtml(d.supportUrl, "Destek ile Iletisime Gec", "#0F5C5C")}
`,
        "#0F5C5C",
        "tr"
      ),
    text: (d) =>
      `Sifreniz degistirildi.\nZaman: ${d.time}\nIP: ${d.ip}\nCihaz: ${d.device}\nBu islemi siz yapmadiysaniz destek: ${d.supportUrl}`,
  },
  es: {
    subject: () => "Tu contrasena fue cambiada",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">✅ Contrasena cambiada correctamente</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">La contrasena de tu portal fue cambiada.</p>
<ul style="color:#334155;font-size:13px;line-height:1.7;padding-left:18px;">
  <li><strong>Hora:</strong> ${escapeHtml(d.time)}</li>
  <li><strong>IP:</strong> ${escapeHtml(d.ip)}</li>
  <li><strong>Dispositivo:</strong> ${escapeHtml(d.device)}</li>
</ul>
<p style="color:#475569;font-size:14px;line-height:1.6;">Si no fuiste tu, contacta soporte de inmediato.</p>
${buttonHtml(d.supportUrl, "Contactar Soporte", "#0F5C5C")}
`,
        "#0F5C5C",
        "es"
      ),
    text: (d) =>
      `Tu contrasena fue cambiada.\nHora: ${d.time}\nIP: ${d.ip}\nDispositivo: ${d.device}\nSi no fuiste tu: ${d.supportUrl}`,
  },
};

export function getPasswordChangedEmail(
  locale: string | undefined,
  details: { time: string; ip: string; device: string; supportUrl: string }
) {
  const l = resolveLocale(locale);
  return {
    subject: passwordChangedTemplates[l].subject(),
    html: passwordChangedTemplates[l].body(details),
    text: passwordChangedTemplates[l].text(details),
  };
}

// -- 9. Welcome Email --
const welcomeTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { name: string; dashboardUrl: string }) => string;
    text: (data: { name: string; dashboardUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "👋 Welcome to Helvion",
    body: ({ name, dashboardUrl }) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">👋 Welcome to Helvion</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Hi ${escapeHtml(name)}, your workspace is ready. You can now start conversations, configure AI, and invite your team.
</p>
${buttonHtml(dashboardUrl, "Open Dashboard")}
<p style="margin:10px 0 0;color:#64748B;font-size:13px;line-height:1.6;">
  Need help? Our team is here for you.
</p>
`,
        "#F59E0B",
        "en"
      ),
    text: ({ name, dashboardUrl }) =>
      `👋 Welcome to Helvion\n\nHi ${name}, your workspace is ready.\nOpen dashboard: ${dashboardUrl}\n\n- Helvion`,
  },
  tr: {
    subject: () => "👋 Helvion'a hos geldiniz",
    body: ({ name, dashboardUrl }) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">👋 Helvion'a hos geldiniz</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Merhaba ${escapeHtml(name)}, calisma alaniniz hazir. Artik sohbetleri baslatabilir, AI ayarlarini yapabilir ve ekibinizi davet edebilirsiniz.
</p>
${buttonHtml(dashboardUrl, "Panele Git")}
<p style="margin:10px 0 0;color:#64748B;font-size:13px;line-height:1.6;">
  Yardima ihtiyaciniz olursa buradayiz.
</p>
`,
        "#F59E0B",
        "tr"
      ),
    text: ({ name, dashboardUrl }) =>
      `👋 Helvion'a hos geldiniz\n\nMerhaba ${name}, calisma alaniniz hazir.\nPanele git: ${dashboardUrl}\n\n- Helvion`,
  },
  es: {
    subject: () => "👋 Bienvenido a Helvion",
    body: ({ name, dashboardUrl }) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">👋 Bienvenido a Helvion</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Hola ${escapeHtml(name)}, tu espacio ya esta listo. Ya puedes iniciar conversaciones, configurar IA e invitar a tu equipo.
</p>
${buttonHtml(dashboardUrl, "Abrir Panel")}
<p style="margin:10px 0 0;color:#64748B;font-size:13px;line-height:1.6;">
  Si necesitas ayuda, estamos aqui.
</p>
`,
        "#F59E0B",
        "es"
      ),
    text: ({ name, dashboardUrl }) =>
      `👋 Bienvenido a Helvion\n\nHola ${name}, tu espacio ya esta listo.\nAbrir panel: ${dashboardUrl}\n\n- Helvion`,
  },
};

export function getWelcomeEmail(locale: string | undefined, data: { name: string; dashboardUrl: string }) {
  const l = resolveLocale(locale);
  return {
    subject: welcomeTemplates[l].subject(),
    html: welcomeTemplates[l].body(data),
    text: welcomeTemplates[l].text(data),
  };
}

// -- 10. Login Notification Email --
const loginNotificationTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { time: string; ip: string; device: string; location?: string; securityUrl: string }) => string;
    text: (data: { time: string; ip: string; device: string; location?: string; securityUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "✨ New login to your Helvion account",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✨ Login activity detected</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  We noticed a successful login to your account.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Time:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Device:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Location:</strong> ${escapeHtml(d.location)}` : ""}
</div>
${buttonHtml(d.securityUrl, "Review Security")}
`,
        "#F59E0B",
        "en"
      ),
    text: (d) =>
      `✨ Login activity detected\nTime: ${d.time}\nIP: ${d.ip}\nDevice: ${d.device}${d.location ? `\nLocation: ${d.location}` : ""}\nReview security: ${d.securityUrl}`,
  },
  tr: {
    subject: () => "✨ Hesabiniza yeni giris yapildi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✨ Giris aktivitesi algilandi</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Hesabiniza basarili bir giris tespit ettik.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Zaman:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Cihaz:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Konum:</strong> ${escapeHtml(d.location)}` : ""}
</div>
${buttonHtml(d.securityUrl, "Guvenligi Incele")}
`,
        "#F59E0B",
        "tr"
      ),
    text: (d) =>
      `✨ Giris aktivitesi algilandi\nZaman: ${d.time}\nIP: ${d.ip}\nCihaz: ${d.device}${d.location ? `\nKonum: ${d.location}` : ""}\nGuvenligi incele: ${d.securityUrl}`,
  },
  es: {
    subject: () => "✨ Nuevo acceso a tu cuenta Helvion",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✨ Actividad de acceso detectada</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Detectamos un inicio de sesion exitoso en tu cuenta.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Hora:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Dispositivo:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Ubicacion:</strong> ${escapeHtml(d.location)}` : ""}
</div>
${buttonHtml(d.securityUrl, "Revisar Seguridad")}
`,
        "#F59E0B",
        "es"
      ),
    text: (d) =>
      `✨ Actividad de acceso detectada\nHora: ${d.time}\nIP: ${d.ip}\nDispositivo: ${d.device}${d.location ? `\nUbicacion: ${d.location}` : ""}\nRevisar seguridad: ${d.securityUrl}`,
  },
};

function forceWarmPremiumLoginEmail(html: string): string {
  return html
    .replace(/#3B82F6/gi, warmEmailColors.accent)
    .replace(/#2563EB/gi, "#FB923C")
    .replace(/#1E40AF/gi, warmEmailColors.highlight)
    .replace(/rgba\(59,\s*130,\s*246,\s*([0-9.]+)\)/gi, "rgba(245, 158, 11, $1)")
    .replace(/rgba\(37,\s*99,\s*235,\s*([0-9.]+)\)/gi, "rgba(251, 146, 60, $1)")
    .replace(/rgba\(30,\s*64,\s*175,\s*([0-9.]+)\)/gi, "rgba(251, 113, 133, $1)")
    .replace(
      /linear-gradient\(135deg,\s*#3B82F6\s*0%,\s*#2563EB\s*100%\)/gi,
      "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)"
    )
    .replace(
      /linear-gradient\(135deg,\s*#2563EB\s*0%,\s*#1E40AF\s*100%\)/gi,
      "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)"
    );
}

export function getLoginNotificationEmailTemplate(
  locale: string | undefined,
  data: { time: string; ip: string; device: string; location?: string; securityUrl: string }
) {
  const l = resolveLocale(locale);
  const rawHtml = loginNotificationTemplates[l].body(data);
  const html = forceWarmPremiumLoginEmail(rawHtml);
  return {
    subject: loginNotificationTemplates[l].subject(),
    html,
    text: loginNotificationTemplates[l].text(data),
  };
}

// -- 11. New Device Email --
const newDeviceTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { time: string; ip: string; device: string; location?: string; securityUrl: string }) => string;
    text: (data: { time: string; ip: string; device: string; location?: string; securityUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "🔔 New device detected",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 New device detected</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  A new device has accessed your account.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Time:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Device:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Location:</strong> ${escapeHtml(d.location)}` : ""}
</div>
<p style="margin:0 0 12px;color:#64748B;font-size:13px;">If this was not you, secure your account immediately.</p>
${buttonHtml(d.securityUrl, "Secure My Account")}
`,
        "#F59E0B",
        "en"
      ),
    text: (d) =>
      `🔔 New device detected\nTime: ${d.time}\nIP: ${d.ip}\nDevice: ${d.device}${d.location ? `\nLocation: ${d.location}` : ""}\nSecure account: ${d.securityUrl}`,
  },
  tr: {
    subject: () => "🔔 Yeni cihaz algilandi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 Yeni cihaz algilandi</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Hesabiniza yeni bir cihazdan erisim saglandi.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Zaman:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Cihaz:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Konum:</strong> ${escapeHtml(d.location)}` : ""}
</div>
<p style="margin:0 0 12px;color:#64748B;font-size:13px;">Bu islem size ait degilse hesabinizi hemen guvenceye alin.</p>
${buttonHtml(d.securityUrl, "Hesabimi Guvenceye Al")}
`,
        "#F59E0B",
        "tr"
      ),
    text: (d) =>
      `🔔 Yeni cihaz algilandi\nZaman: ${d.time}\nIP: ${d.ip}\nCihaz: ${d.device}${d.location ? `\nKonum: ${d.location}` : ""}\nHesabi guvenceye al: ${d.securityUrl}`,
  },
  es: {
    subject: () => "🔔 Nuevo dispositivo detectado",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 Nuevo dispositivo detectado</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Se detecto acceso desde un nuevo dispositivo en tu cuenta.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Hora:</strong> ${escapeHtml(d.time)}<br>
  <strong>IP:</strong> ${escapeHtml(d.ip)}<br>
  <strong>Dispositivo:</strong> ${escapeHtml(d.device)}${d.location ? `<br><strong>Ubicacion:</strong> ${escapeHtml(d.location)}` : ""}
</div>
<p style="margin:0 0 12px;color:#64748B;font-size:13px;">Si no fuiste tu, protege tu cuenta inmediatamente.</p>
${buttonHtml(d.securityUrl, "Proteger Mi Cuenta")}
`,
        "#F59E0B",
        "es"
      ),
    text: (d) =>
      `🔔 Nuevo dispositivo detectado\nHora: ${d.time}\nIP: ${d.ip}\nDispositivo: ${d.device}${d.location ? `\nUbicacion: ${d.location}` : ""}\nProteger cuenta: ${d.securityUrl}`,
  },
};

export function getNewDeviceDetectedEmail(
  locale: string | undefined,
  data: { time: string; ip: string; device: string; location?: string; securityUrl: string }
) {
  const l = resolveLocale(locale);
  return {
    subject: newDeviceTemplates[l].subject(),
    html: newDeviceTemplates[l].body(data),
    text: newDeviceTemplates[l].text(data),
  };
}

// -- 12. MFA Setup Success Email --
const mfaSetupSuccessTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { time: string; securityUrl: string }) => string;
    text: (data: { time: string; securityUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "🛡️ MFA setup completed",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🛡️ MFA is now active</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Great job. Your account is now protected with multi-factor authentication.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Activated at:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.securityUrl, "Manage Security")}
`,
        "#F59E0B",
        "en"
      ),
    text: (d) => `🛡️ MFA setup completed\nActivated at: ${d.time}\nManage security: ${d.securityUrl}`,
  },
  tr: {
    subject: () => "🛡️ MFA kurulumu tamamlandi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🛡️ MFA artik aktif</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Harika. Hesabiniz artik cok adimli dogrulama ile korunuyor.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Aktif edilme zamani:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.securityUrl, "Guvenligi Yonet")}
`,
        "#F59E0B",
        "tr"
      ),
    text: (d) => `🛡️ MFA kurulumu tamamlandi\nAktif edilme zamani: ${d.time}\nGuvenligi yonet: ${d.securityUrl}`,
  },
  es: {
    subject: () => "🛡️ Configuracion de MFA completada",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🛡️ MFA ya esta activa</h2>
<p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.7;">
  Excelente. Tu cuenta ahora esta protegida con autenticacion multifactor.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Activada en:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.securityUrl, "Gestionar Seguridad")}
`,
        "#F59E0B",
        "es"
      ),
    text: (d) => `🛡️ Configuracion de MFA completada\nActivada en: ${d.time}\nGestionar seguridad: ${d.securityUrl}`,
  },
};

export function getMfaSetupSuccessEmail(locale: string | undefined, data: { time: string; securityUrl: string }) {
  const l = resolveLocale(locale);
  return {
    subject: mfaSetupSuccessTemplates[l].subject(),
    html: mfaSetupSuccessTemplates[l].body(data),
    text: mfaSetupSuccessTemplates[l].text(data),
  };
}

// -- 13. Account Locked / Unlocked Email --
type AccountStatus = "locked" | "unlocked";
const accountStatusTemplates: Record<
  Locale,
  {
    subject: (status: AccountStatus) => string;
    body: (data: { status: AccountStatus; time: string; supportUrl: string }) => string;
    text: (data: { status: AccountStatus; time: string; supportUrl: string }) => string;
  }
> = {
  en: {
    subject: (status) => (status === "locked" ? "⚠️ Your account is locked" : "✅ Your account has been unlocked"),
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">${d.status === "locked" ? "⚠️ Account locked" : "✅ Account unlocked"}</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  ${d.status === "locked" ? "Your account was temporarily locked for security reasons." : "Access to your account has been restored."}
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Time:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.supportUrl, "Contact Support")}
`,
        d.status === "locked" ? "#FB7185" : "#F59E0B",
        "en"
      ),
    text: (d) =>
      `${d.status === "locked" ? "⚠️ Account locked" : "✅ Account unlocked"}\nTime: ${d.time}\nSupport: ${d.supportUrl}`,
  },
  tr: {
    subject: (status) => (status === "locked" ? "⚠️ Hesabiniz kilitlendi" : "✅ Hesabinizin kilidi acildi"),
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">${d.status === "locked" ? "⚠️ Hesap kilitlendi" : "✅ Hesap kilidi acildi"}</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  ${d.status === "locked" ? "Hesabiniz guvenlik nedeniyle gecici olarak kilitlendi." : "Hesabiniza erisim yeniden saglandi."}
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Zaman:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.supportUrl, "Destekle Iletisim Kur")}
`,
        d.status === "locked" ? "#FB7185" : "#F59E0B",
        "tr"
      ),
    text: (d) =>
      `${d.status === "locked" ? "⚠️ Hesap kilitlendi" : "✅ Hesap kilidi acildi"}\nZaman: ${d.time}\nDestek: ${d.supportUrl}`,
  },
  es: {
    subject: (status) => (status === "locked" ? "⚠️ Tu cuenta esta bloqueada" : "✅ Tu cuenta fue desbloqueada"),
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">${d.status === "locked" ? "⚠️ Cuenta bloqueada" : "✅ Cuenta desbloqueada"}</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  ${d.status === "locked" ? "Tu cuenta fue bloqueada temporalmente por seguridad." : "El acceso a tu cuenta fue restaurado."}
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;"><strong>Hora:</strong> ${escapeHtml(d.time)}</p>
${buttonHtml(d.supportUrl, "Contactar Soporte")}
`,
        d.status === "locked" ? "#FB7185" : "#F59E0B",
        "es"
      ),
    text: (d) =>
      `${d.status === "locked" ? "⚠️ Cuenta bloqueada" : "✅ Cuenta desbloqueada"}\nHora: ${d.time}\nSoporte: ${d.supportUrl}`,
  },
};

export function getAccountStatusEmail(
  locale: string | undefined,
  data: { status: AccountStatus; time: string; supportUrl: string }
) {
  const l = resolveLocale(locale);
  return {
    subject: accountStatusTemplates[l].subject(data.status),
    html: accountStatusTemplates[l].body(data),
    text: accountStatusTemplates[l].text(data),
  };
}

// -- 14. Location Change Alert Email --
const locationChangeAlertTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { previousLocation: string; newLocation: string; securityUrl: string }) => string;
    text: (data: { previousLocation: string; newLocation: string; securityUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "🔔 Login from a new location",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 New location detected</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  We detected a login from a location different than your recent sign-ins.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Previous:</strong> ${escapeHtml(d.previousLocation)}<br>
  <strong>New:</strong> ${escapeHtml(d.newLocation)}
</div>
${buttonHtml(d.securityUrl, "Secure My Account", "#FB7185")}
`,
        "#F59E0B",
        "en"
      ),
    text: (d) => `🔔 Login from a new location\nPrevious: ${d.previousLocation}\nNew: ${d.newLocation}\nSecure account: ${d.securityUrl}`,
  },
  tr: {
    subject: () => "🔔 Yeni konumdan giris tespit edildi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 Yeni konum algilandi</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Son girislerinize gore farkli bir konumdan erisim tespit ettik.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Onceki:</strong> ${escapeHtml(d.previousLocation)}<br>
  <strong>Yeni:</strong> ${escapeHtml(d.newLocation)}
</div>
${buttonHtml(d.securityUrl, "Hesabimi Guvenceye Al", "#FB7185")}
`,
        "#F59E0B",
        "tr"
      ),
    text: (d) =>
      `🔔 Yeni konumdan giris tespit edildi\nOnceki: ${d.previousLocation}\nYeni: ${d.newLocation}\nHesabi guvenceye al: ${d.securityUrl}`,
  },
  es: {
    subject: () => "🔔 Inicio de sesion desde una nueva ubicacion",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">🔔 Nueva ubicacion detectada</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Detectamos un acceso desde una ubicacion diferente a tus inicios recientes.
</p>
<div style="margin:0 0 14px;padding:12px 14px;background:#FFF7ED;border:1px solid #FDE68A;border-radius:10px;color:#1A1D23;font-size:13px;line-height:1.7;">
  <strong>Anterior:</strong> ${escapeHtml(d.previousLocation)}<br>
  <strong>Nueva:</strong> ${escapeHtml(d.newLocation)}
</div>
${buttonHtml(d.securityUrl, "Proteger Mi Cuenta", "#FB7185")}
`,
        "#F59E0B",
        "es"
      ),
    text: (d) =>
      `🔔 Inicio de sesion desde nueva ubicacion\nAnterior: ${d.previousLocation}\nNueva: ${d.newLocation}\nProteger cuenta: ${d.securityUrl}`,
  },
};

export function getLocationChangeAlertEmailTemplate(
  locale: string | undefined,
  data: { previousLocation: string; newLocation: string; securityUrl: string }
) {
  const l = resolveLocale(locale);
  return {
    subject: locationChangeAlertTemplates[l].subject(),
    html: locationChangeAlertTemplates[l].body(data),
    text: locationChangeAlertTemplates[l].text(data),
  };
}

// -- 15. Session Revoked Email --
const sessionRevokedTemplates: Record<
  Locale,
  {
    subject: () => string;
    body: (data: { deviceName: string; sessionsUrl: string }) => string;
    text: (data: { deviceName: string; sessionsUrl: string }) => string;
  }
> = {
  en: {
    subject: () => "✅ An old session was logged out",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✅ Session limit applied</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  One older session was automatically signed out to protect your account.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;line-height:1.6;">
  <strong>Removed device:</strong> ${escapeHtml(d.deviceName)}
</p>
${buttonHtml(d.sessionsUrl, "Review Active Sessions")}
`,
        "#F59E0B",
        "en"
      ),
    text: (d) => `✅ An old session was logged out\nRemoved device: ${d.deviceName}\nReview sessions: ${d.sessionsUrl}`,
  },
  tr: {
    subject: () => "✅ Eski bir oturum kapatildi",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✅ Oturum limiti uygulandi</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Hesabinizi korumak icin eski bir oturum otomatik olarak kapatildi.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;line-height:1.6;">
  <strong>Kapatilan cihaz:</strong> ${escapeHtml(d.deviceName)}
</p>
${buttonHtml(d.sessionsUrl, "Aktif Oturumlari Incele")}
`,
        "#F59E0B",
        "tr"
      ),
    text: (d) => `✅ Eski bir oturum kapatildi\nKapatilan cihaz: ${d.deviceName}\nOturumlari incele: ${d.sessionsUrl}`,
  },
  es: {
    subject: () => "✅ Se cerro una sesion anterior",
    body: (d) =>
      wrapHtml(
        `
<h2 style="margin:0 0 10px;color:#1A1D23;font-size:22px;">✅ Se aplico limite de sesiones</h2>
<p style="margin:0 0 12px;color:#64748B;font-size:14px;line-height:1.7;">
  Una sesion anterior se cerro automaticamente para proteger tu cuenta.
</p>
<p style="margin:0 0 14px;color:#64748B;font-size:13px;line-height:1.6;">
  <strong>Dispositivo cerrado:</strong> ${escapeHtml(d.deviceName)}
</p>
${buttonHtml(d.sessionsUrl, "Revisar Sesiones Activas")}
`,
        "#F59E0B",
        "es"
      ),
    text: (d) => `✅ Se cerro una sesion anterior\nDispositivo cerrado: ${d.deviceName}\nRevisar sesiones: ${d.sessionsUrl}`,
  },
};

export function getSessionRevokedEmailTemplate(
  locale: string | undefined,
  data: { deviceName: string; sessionsUrl: string }
) {
  const l = resolveLocale(locale);
  return {
    subject: sessionRevokedTemplates[l].subject(),
    html: sessionRevokedTemplates[l].body(data),
    text: sessionRevokedTemplates[l].text(data),
  };
}
