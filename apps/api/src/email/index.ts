/**
 * Email Module — Step 11.50
 *
 * Exports:
 * - sendEmail (re-export from mailer.ts)
 * - Template helpers
 * - Provider registry (extended with Postmark)
 */

// Re-export core mailer functionality
export { sendEmail, sendEmailAsync, getMailProviderName } from "../utils/mailer";
export type { EmailPayload, EmailResult, EmailProvider } from "../utils/mailer";

// Template exports
export { renderResetPasswordEmail } from "./templates/reset-password";
export type { ResetPasswordTemplateParams } from "./templates/reset-password";

export { renderVerifyEmail } from "./templates/verify-email";
export type { VerifyEmailTemplateParams } from "./templates/verify-email";

export { renderNotificationEmail } from "./templates/notification";
export type { NotificationTemplateParams } from "./templates/notification";

export { renderBaseTemplate, renderPlainText } from "./templates/base";
export type { BaseTemplateParams } from "./templates/base";

// Provider exports (for advanced usage)
export { PostmarkEmailProvider } from "./providers/postmark";
export { NoopEmailProvider } from "./providers/noop";
