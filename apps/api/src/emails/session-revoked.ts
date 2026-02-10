interface SessionRevokedEmailInput {
  email: string;
  deviceName: string;
  sessionsUrl: string;
}

export function getSessionRevokedEmail(input: SessionRevokedEmailInput) {
  const subject = "A device was logged out due to session limit";
  const html = `
    <h2>Session limit reached</h2>
    <p>One of your older sessions was logged out because your account can be active on up to 3 devices.</p>
    <p><strong>Removed device:</strong> ${input.deviceName}</p>
    <p><a href="${input.sessionsUrl}">Review active sessions</a></p>
  `;
  const text = `Session limit reached. Removed device: ${input.deviceName}. Review sessions: ${input.sessionsUrl}`;
  return { subject, html, text, to: input.email };
}
