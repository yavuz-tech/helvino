export interface AbandonedCheckoutEmailParams {
  name: string;
  planName: string;
  promoCode: string;
  checkoutUrl: string;
  expiresInHours?: number;
}

export function renderAbandonedCheckoutEmail(
  params: AbandonedCheckoutEmailParams
): string {
  const { name, planName, promoCode, checkoutUrl, expiresInHours = 24 } = params;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Helvino planiniz sizi bekliyor!</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;background:#f8fafc;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;background:#0F5C5C;color:#fff;font-size:24px;font-weight:700;">Helvino</td></tr>
        <tr><td style="padding:30px 28px;color:#111827;">
          <p style="margin:0 0 12px 0;font-size:16px;">Merhaba ${name},</p>
          <p style="margin:0 0 18px 0;font-size:22px;line-height:1.35;font-weight:700;">Tam bir adim kalmisti! 🚀</p>
          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#374151;">
            <strong>${planName}</strong> planiniz icin odeme islemine basladiginizi gorduk, ancak tamamlanmamis gorunuyor.
          </p>
          <div style="margin:0 0 20px 0;padding:16px;border:1px solid #dbeafe;background:#eff6ff;border-radius:10px;">
            <p style="margin:0 0 10px 0;font-size:18px;font-weight:700;color:#1d4ed8;">Sadece size ozel: %20 indirim! 🎁</p>
            <p style="margin:0 0 10px 0;color:#1f2937;font-size:14px;">Ilk aya ozel indirim kodunuz:</p>
            <div style="display:inline-block;border:2px dashed #1d4ed8;border-radius:8px;padding:10px 18px;background:#fff;font-size:24px;font-weight:800;letter-spacing:1.6px;color:#111827;">
              ${promoCode}
            </div>
          </div>
          <div style="margin:0 0 20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#374151;line-height:1.9;">
            ✅ Sinirsiz canli destek konusmalari<br>
            ✅ AI-destekli otomatik yanitlar<br>
            ✅ WhatsApp &amp; Instagram entegrasyonu<br>
            ✅ 7/24 musteri destegi
          </div>
          <a href="${checkoutUrl}" style="display:inline-block;background:#0F5C5C;color:#fff;text-decoration:none;padding:14px 22px;border-radius:9px;font-size:16px;font-weight:700;">Odemeyi Tamamla</a>
          <p style="margin:14px 0 20px 0;font-size:14px;color:#b91c1c;font-weight:700;">Bu ozel kod ${expiresInHours} saat gecerli!</p>
          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
            Odemeye devam etmek icin butona tiklayin. Kodunuz checkout adiminda otomatik olarak gorunecektir.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
