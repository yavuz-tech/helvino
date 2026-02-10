interface NewDeviceLoginEmailInput {
  email: string;
  deviceName: string;
  location: string;
  ip: string;
  time: string;
}

export function getNewDeviceLoginEmail(input: NewDeviceLoginEmailInput) {
  const subject = "New device login detected";
  const html = `
    <h2>New device login detected</h2>
    <p>We detected a login from a new device.</p>
    <ul>
      <li><strong>Device:</strong> ${input.deviceName}</li>
      <li><strong>Location:</strong> ${input.location}</li>
      <li><strong>IP:</strong> ${input.ip}</li>
      <li><strong>Time:</strong> ${input.time}</li>
    </ul>
    <p><a href="#">This was me</a> | <a href="#">Secure my account</a></p>
  `;
  const text = `New device login detected.\nDevice: ${input.deviceName}\nLocation: ${input.location}\nIP: ${input.ip}\nTime: ${input.time}`;
  return { subject, html, text, to: input.email };
}
