/**
 * Notification Email Template — Step 11.50
 *
 * Generic template for system notifications (security alerts, billing updates, etc.)
 */

import { renderBaseTemplate, renderPlainText } from "./base";

export interface NotificationTemplateParams {
  title: string;
  message: string;
  actionLink?: string;
  actionLabel?: string;
  severity?: "info" | "warning" | "critical";
}

export function renderNotificationEmail(params: NotificationTemplateParams) {
  const { title, message, actionLink, actionLabel, severity = "info" } = params;

  const severityColors = {
    info: { bg: "#2563eb", text: "#1e40af" },
    warning: { bg: "#f59e0b", text: "#d97706" },
    critical: { bg: "#dc2626", text: "#b91c1c" },
  };

  const colors = severityColors[severity];

  const body = `
    ${severity === "critical" || severity === "warning" ? `
      <div style="margin: 0 0 24px 0; padding: 12px 16px; background-color: ${severity === "critical" ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${colors.bg}; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${colors.text};">
          ${severity === "critical" ? '⚠️ Security Alert' : '⚡ Important Notice'}
        </p>
      </div>
    ` : ''}
    
    <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">${title}</p>
    <p style="margin: 0 0 24px 0;">${message}</p>
    
    ${actionLink && actionLabel ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
        <tr>
          <td style="border-radius: 6px; background-color: ${colors.bg};">
            <a href="${actionLink}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
              ${actionLabel}
            </a>
          </td>
        </tr>
      </table>
    ` : ''}
  `;

  const html = renderBaseTemplate({
    title,
    preheader: title,
    body,
  });

  const text = renderPlainText(`
    ${title}
    
    ${message}
    
    ${actionLink && actionLabel ? `${actionLabel}: ${actionLink}` : ''}
  `);

  return {
    subject: title,
    html,
    text,
  };
}
