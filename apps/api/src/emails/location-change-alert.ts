interface LocationChangeAlertEmailInput {
  email: string;
  previousLocation: string;
  newLocation: string;
  lockUrl: string;
}

export function getLocationChangeAlertEmail(input: LocationChangeAlertEmailInput) {
  const subject = "Login from new location";
  const html = `
    <h2>Login from new location</h2>
    <p>We noticed your account was accessed from a new country.</p>
    <ul>
      <li><strong>Previous:</strong> ${input.previousLocation}</li>
      <li><strong>New:</strong> ${input.newLocation}</li>
    </ul>
    <p><a href="#">This was me</a> | <a href="${input.lockUrl}">Lock my account</a></p>
  `;
  const text = `Login from new location.\nPrevious: ${input.previousLocation}\nNew: ${input.newLocation}\nLock account: ${input.lockUrl}`;
  return { subject, html, text, to: input.email };
}
