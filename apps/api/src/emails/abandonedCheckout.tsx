type SubjectVariant = "A" | "B" | "C";

interface AbandonedCheckoutEmailParams {
  name: string;
  planName: string;
  promoCode: string;
  checkoutUrl: string;
  originalPrice: string;
  discountedPrice: string;
  currencySuffix?: string;
  variant?: SubjectVariant;
}

interface AbandonedCheckoutEmailContent {
  subject: string;
  html: string;
  text: string;
  variant: SubjectVariant;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SUBJECT_LINES: Record<SubjectVariant, string> = {
  A: "Neredeyse bitmisti! 🎁 Size ozel %20 indirim",
  B: "Helvino planiniz hazir - Son adim kaldi!",
  C: "Kacirmayin: Ozel indirimli fiyat sizin icin sakli",
};

/**
 * Abandoned checkout campaign email (TR).
 * Premium marketing copy with friendly urgency.
 */
export function renderAbandonedCheckoutEmail(
  params: AbandonedCheckoutEmailParams
): AbandonedCheckoutEmailContent {
  const variant = params.variant ?? "A";
  const safeName = escapeHtml(params.name);
  const safePlanName = escapeHtml(params.planName);
  const safePromoCode = escapeHtml(params.promoCode);
  const safeCheckoutUrl = escapeHtml(params.checkoutUrl);
  const safeOriginalPrice = escapeHtml(params.originalPrice);
  const safeDiscountedPrice = escapeHtml(params.discountedPrice);
  const safeCurrencySuffix = escapeHtml(params.currencySuffix ?? "/ay");

  const subject = SUBJECT_LINES[variant];

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;background:#f8fafc;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:#0F5C5C;">
              <div style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Helvino</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px;color:#111827;">
              <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;">Merhaba ${safeName},</p>
              <p style="margin:0 0 18px 0;font-size:22px;line-height:1.35;font-weight:700;">Tam bir adim kalmisti! 🚀</p>
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#374151;">
                <strong>${safePlanName}</strong> planiniz icin odeme islemine basladiginizi gorduk, ancak tamamlanmamis gorunuyor.
                Belki bir sorun mu yasadiniz?
              </p>

              <div style="margin:0 0 20px 0;padding:16px;border:1px solid #dbeafe;background:#eff6ff;border-radius:10px;">
                <p style="margin:0 0 10px 0;font-size:18px;line-height:1.5;font-weight:700;color:#1d4ed8;">Sadece size ozel: %20 indirim! 🎁</p>
                <p style="margin:0 0 10px 0;color:#1f2937;font-size:14px;">Ilk aya ozel indirim kodunuz:</p>
                <div style="display:inline-block;border:2px dashed #1d4ed8;border-radius:8px;padding:10px 18px;background:#ffffff;font-size:24px;font-weight:800;letter-spacing:1.6px;color:#111827;">
                  ${safePromoCode}
                </div>
              </div>

              <div style="margin:0 0 20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
                <p style="margin:0 0 10px 0;font-weight:700;color:#111827;">Helvino ile:</p>
                <p style="margin:0;color:#374151;line-height:1.9;">
                  ✅ Sinirsiz canli destek konusmalari<br>
                  ✅ AI-destekli otomatik yanitlar<br>
                  ✅ WhatsApp &amp; Instagram entegrasyonu<br>
                  ✅ 7/24 musteri destegi
                </p>
              </div>

              <p style="margin:0 0 10px 0;font-size:16px;font-weight:700;color:#111827;">Simdi tamamlayin:</p>
              <div style="margin:0 0 14px 0;">
                <a href="${safeCheckoutUrl}" style="display:inline-block;background:#0F5C5C;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:9px;font-size:16px;font-weight:700;">
                  Odemeyi Tamamla
                </a>
              </div>
              <p style="margin:0 0 14px 0;font-size:16px;color:#374151;">
                Indirimli fiyat: <span style="text-decoration:line-through;color:#9ca3af;">${safeOriginalPrice}</span>
                <strong style="color:#111827;"> ${safeDiscountedPrice}${safeCurrencySuffix}</strong>
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;color:#b91c1c;font-weight:700;">Bu ozel fiyat 24 saat gecerli!</p>

              <p style="margin:0 0 4px 0;font-size:15px;color:#374151;">Iyi calismalar,</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">Helvino Ekibi</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 10px 0;font-size:13px;color:#6b7280;">
                P.S. Sorulariniz mi var? Cevaplamaktan mutluluk duyariz:
                <a href="mailto:support@helvino.com" style="color:#0F5C5C;text-decoration:none;">support@helvino.com</a>
              </p>
              <p style="margin:0;font-size:12px;">
                <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Abonelikten Cik</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Merhaba ${params.name},

Tam bir adim kalmisti! 🚀

${params.planName} planiniz icin odeme islemine basladiginizi gorduk, ancak tamamlanmamis gorunuyor.

Sadece size ozel: %20 indirim! 🎁

Ilk aya ozel indirim kodunuz: ${params.promoCode}

Helvino ile:
✅ Sinirsiz canli destek konusmalari
✅ AI-destekli otomatik yanitlar
✅ WhatsApp & Instagram entegrasyonu
✅ 7/24 musteri destegi

Simdi tamamlayin:
${params.checkoutUrl}

Indirimli fiyat: ${params.originalPrice} -> ${params.discountedPrice}${params.currencySuffix ?? "/ay"}

Bu ozel fiyat 24 saat gecerli!

Iyi calismalar,
Helvino Ekibi

P.S. Sorulariniz mi var? support@helvino.com`;

  return { subject, html, text, variant };
}
