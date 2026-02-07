/**
 * Step-up helper — Step 11.22
 *
 * Detects STEP_UP_REQUIRED from API responses and provides
 * a wrapper for making sensitive API calls that auto-handles step-up.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function isStepUpRequired(data: Record<string, unknown>): boolean {
  return data?.code === "STEP_UP_REQUIRED";
}

/**
 * Perform admin step-up challenge (sends code to /internal/auth/mfa/challenge)
 */
export async function adminStepUpChallenge(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/internal/auth/mfa/challenge`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Perform portal step-up challenge (sends code to /portal/auth/mfa/challenge)
 */
export async function portalStepUpChallenge(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/portal/auth/mfa/challenge`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
