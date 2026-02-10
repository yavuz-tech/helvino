interface LoginNotificationEmailInput {
  email: string;
  deviceName: string;
  location: string;
  ip: string;
  time: string;
  lockUrl: string;
}

export function getLoginNotificationEmail(input: LoginNotificationEmailInput) {
  const subject = "New login to your account";
  const html = `
    <h2>New login to your account</h2>
    <p>Your account was just accessed.</p>
    <ul>
      <li><strong>Time:</strong> ${input.time}</li>
      <li><strong>Location:</strong> ${input.location}</li>
      <li><strong>Device:</strong> ${input.deviceName}</li>
      <li><strong>IP:</strong> ${input.ip}</li>
    </ul>
    <p><a href="${input.lockUrl}">Wasn't you? Lock account</a></p>
  `;
  const text = `New login to your account.\nTime: ${input.time}\nLocation: ${input.location}\nDevice: ${input.deviceName}\nIP: ${input.ip}\nLock: ${input.lockUrl}`;
  return { subject, html, text, to: input.email };
}
