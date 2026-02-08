/**
 * Base Email Template — Step 11.50
 *
 * Provides consistent layout for all transactional emails.
 * Inline styles for maximum email client compatibility.
 */

export interface BaseTemplateParams {
  title: string;
  preheader?: string;
  body: string;
  footer?: string;
}

export function renderBaseTemplate(params: BaseTemplateParams): string {
  const { title, preheader, body, footer } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { border-collapse: collapse; }
  </style>
</head>
<body style="background-color: #f5f5f5; margin: 0; padding: 0; width: 100%;">
  ${preheader ? `<div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div>` : ''}
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">Helvion</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; color: #374151; font-size: 16px; line-height: 24px;">
              ${body}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; color: #6b7280; font-size: 14px; line-height: 20px; border-top: 1px solid #e5e7eb;">
              ${footer || `
                <p style="margin: 0 0 8px 0;">This is an automated message from Helvion.</p>
                <p style="margin: 0;">If you did not request this email, please ignore it.</p>
              `}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function renderPlainText(body: string): string {
  // Strip HTML tags for plain text version
  return body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}
