/**
 * Email Verification Template — Step 11.50
 */

import { renderBaseTemplate, renderPlainText } from "./base";

export interface VerifyEmailTemplateParams {
  verificationLink: string;
  recipientEmail: string;
  expiresInMinutes?: number;
}

export function renderVerifyEmail(params: VerifyEmailTemplateParams) {
  const { verificationLink, recipientEmail, expiresInMinutes = 30 } = params;

  const body = `
    <p style="margin: 0 0 16px 0;">Welcome to Helvino!</p>
    <p style="margin: 0 0 16px 0;">Please verify your email address (<strong>${recipientEmail}</strong>) to complete your registration.</p>
    <p style="margin: 0 0 24px 0;">Click the button below to verify your email:</p>
    
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 24px auto;">
      <tr>
        <td style="border-radius: 6px; background-color: #111827;">
          <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
            Verify Email
          </a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">This link will expire in ${expiresInMinutes} minutes.</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">If you didn't create a Helvino account, you can safely ignore this email.</p>
    
    <p style="margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${verificationLink}" style="color: #2563eb; word-break: break-all;">${verificationLink}</a>
    </p>
  `;

  const html = renderBaseTemplate({
    title: "Verify Your Email",
    preheader: "Complete your Helvino registration",
    body,
  });

  const text = renderPlainText(`
    Welcome to Helvino!
    
    Please verify your email address (${recipientEmail}) to complete your registration.
    
    Click the link below to verify your email:
    ${verificationLink}
    
    This link will expire in ${expiresInMinutes} minutes.
    
    If you didn't create a Helvino account, you can safely ignore this email.
  `);

  return {
    subject: "Verify Your Helvino Email",
    html,
    text,
  };
}
