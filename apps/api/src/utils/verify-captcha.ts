interface HCaptchaVerifyResponse {
  success?: boolean;
}

export async function verifyHCaptchaToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) {
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) {
      body.set("remoteip", remoteIp);
    }

    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as HCaptchaVerifyResponse;
    return Boolean(data.success);
  } catch {
    return false;
  }
}
