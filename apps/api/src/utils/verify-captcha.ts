interface TurnstileVerifyResponse {
  success?: boolean;
}

export function isCaptchaConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Captcha not configured — skip verification (allow request through)
    return true;
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) {
      body.set("remoteip", remoteIp);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    return Boolean(data.success);
  } catch {
    return false;
  }
}
