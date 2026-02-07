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

function wrapHtml(content: string, brandColor = "#0F5C5C"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="background:${brandColor};padding:24px 32px;">
<span style="font-size:20px;font-weight:700;color:#fff;">Helvino</span>
</td></tr>
<tr><td style="padding:32px;">
${content}
</td></tr>
<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
<p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Helvino &mdash; Secure customer communication</p>
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
    subject: (orgName) => `You've been invited to ${orgName} on Helvino`,
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
`),
  },
  tr: {
    subject: (orgName) => `${orgName} sizi Helvino'ya davet etti`,
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
`),
  },
  es: {
    subject: (orgName) => `Has sido invitado a ${orgName} en Helvino`,
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
`),
  },
};

// ── 2. Password Reset ──

const resetTemplates: Record<Locale, { subject: () => string; body: (link: string, expiresIn: string) => string }> = {
  en: {
    subject: () => "Reset your Helvino password",
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
`),
  },
  tr: {
    subject: () => "Helvino şifrenizi sıfırlayın",
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
`),
  },
  es: {
    subject: () => "Restablece tu contraseña de Helvino",
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
`),
  },
};

// ── 3. Recovery Approved ──

const recoveryApprovedTemplates: Record<Locale, { subject: () => string; body: (message: string) => string }> = {
  en: {
    subject: () => "Your Helvino account recovery has been approved",
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
`),
  },
  tr: {
    subject: () => "Helvino hesap kurtarma isteğiniz onaylandı",
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
`),
  },
  es: {
    subject: () => "Tu recuperación de cuenta Helvino ha sido aprobada",
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
`),
  },
};

// ── 4. Recovery Rejected ──

const recoveryRejectedTemplates: Record<Locale, { subject: () => string; body: (reason: string) => string }> = {
  en: {
    subject: () => "Your Helvino account recovery request was denied",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recovery Denied</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Your account recovery request has been reviewed and denied.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Reason:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  If you believe this is an error, please contact support with additional verification.
</p>
`),
  },
  tr: {
    subject: () => "Helvino hesap kurtarma isteğiniz reddedildi",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Kurtarma Reddedildi</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Hesap kurtarma isteğiniz incelendi ve reddedildi.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Neden:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Bunun bir hata olduğunu düşünüyorsanız ek doğrulama ile desteğe başvurun.
</p>
`),
  },
  es: {
    subject: () => "Tu solicitud de recuperación de cuenta Helvino fue denegada",
    body: (reason) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Recuperación Denegada</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Tu solicitud de recuperación de cuenta ha sido revisada y denegada.
</p>
${reason ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Motivo:</strong> ${reason}</p>` : ""}
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Si crees que esto es un error, contacta al soporte con verificación adicional.
</p>
`),
  },
};

// ── 5. Emergency Token Generated ──

const emergencyTokenTemplates: Record<Locale, { subject: () => string; body: () => string }> = {
  en: {
    subject: () => "Emergency access token generated for your Helvino account",
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
`),
  },
  tr: {
    subject: () => "Helvino hesabınız için acil erişim anahtarı oluşturuldu",
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
`),
  },
  es: {
    subject: () => "Se generó un token de acceso de emergencia para tu cuenta Helvino",
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
`),
  },
};

// ── Public API ──

function resolveLocale(lang?: string): Locale {
  if (lang === "tr") return "tr";
  if (lang === "es") return "es";
  return "en";
}

export function getInviteEmail(locale: string | undefined, orgName: string, role: string, link: string, expiresIn: string) {
  const l = resolveLocale(locale);
  return {
    subject: inviteTemplates[l].subject(orgName),
    html: inviteTemplates[l].body(orgName, role, link, expiresIn),
  };
}

export function getResetEmail(locale: string | undefined, link: string, expiresIn: string) {
  const l = resolveLocale(locale);
  return {
    subject: resetTemplates[l].subject(),
    html: resetTemplates[l].body(link, expiresIn),
  };
}

export function getRecoveryApprovedEmail(locale: string | undefined, message: string) {
  const l = resolveLocale(locale);
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

// ── 6. Email Verification ──

const verifyEmailTemplates: Record<Locale, { subject: () => string; body: (link: string) => string }> = {
  en: {
    subject: () => "Verify your email — Helvino",
    body: (link) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Verify your email</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Thanks for signing up! Click the button below to verify your email address and activate your account.
</p>
${buttonHtml(link, "Verify Email")}
<p style="color:#94a3b8;font-size:12px;">
  This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
</p>
`),
  },
  tr: {
    subject: () => "E-postanızı doğrulayın — Helvino",
    body: (link) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">E-postanızı doğrulayın</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  Kaydınız için teşekkürler! Hesabınızı etkinleştirmek için aşağıdaki düğmeye tıklayarak e-posta adresinizi doğrulayın.
</p>
${buttonHtml(link, "E-postayı Doğrula")}
<p style="color:#94a3b8;font-size:12px;">
  Bu bağlantı 24 saat içinde geçerliliğini yitirir. Bu hesabı siz oluşturmadıysanız bu e-postayı görmezden gelebilirsiniz.
</p>
`),
  },
  es: {
    subject: () => "Verifica tu email — Helvino",
    body: (link) => wrapHtml(`
<h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Verifica tu email</h2>
<p style="color:#475569;font-size:14px;line-height:1.6;">
  ¡Gracias por registrarte! Haz clic en el botón de abajo para verificar tu dirección de correo electrónico y activar tu cuenta.
</p>
${buttonHtml(link, "Verificar Email")}
<p style="color:#94a3b8;font-size:12px;">
  Este enlace caduca en 24 horas. Si no creaste esta cuenta, puedes ignorar este correo electrónico.
</p>
`),
  },
};

export function getVerifyEmailContent(locale: string | undefined, link: string) {
  const l = resolveLocale(locale);
  return {
    subject: verifyEmailTemplates[l].subject(),
    html: verifyEmailTemplates[l].body(link),
  };
}
