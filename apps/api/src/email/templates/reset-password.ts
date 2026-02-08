/**
 * Password Reset Email Template — Step 11.50
 */

import { renderBaseTemplate, renderPlainText } from "./base";

export interface ResetPasswordTemplateParams {
  resetLink: string;
  recipientEmail: string;
  expiresInMinutes?: number;
}

export function renderResetPasswordEmail(params: ResetPasswordTemplateParams) {
  const { resetLink, recipientEmail, expiresInMinutes = 30 } = params;

  const body = `
    <p style="margin: 0 0 16px 0;">Hello,</p>
    <p style="margin: 0 0 16px 0;">We received a request to reset the password for your Helvino account (<strong>${recipientEmail}</strong>).</p>
    <p style="margin: 0 0 24px 0;">Click the button below to reset your password:</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
      <tr>
        <td style="border-radius: 6px; background-color: #111827;">
          <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">This link will expire in ${expiresInMinutes} minutes.</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">If you didn't request a password reset, you can safely ignore this email.</p>
    
    <p style="margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
    </p>
  `;

  const html = renderBaseTemplate({
    title: "Reset Your Password",
    preheader: "Reset your Helvino password",
    body,
  });

  const text = renderPlainText(`
    Hello,
    
    We received a request to reset the password for your Helvino account (${recipientEmail}).
    
    Click the link below to reset your password:
    ${resetLink}
    
    This link will expire in ${expiresInMinutes} minutes.
    
    If you didn't request a password reset, you can safely ignore this email.
  `);

  return {
    subject: "Reset Your Helvino Password",
    html,
    text,
  };
}
