/**
 * Visitor Identity Management
 * 
 * Generates and persists unique visitor ID in localStorage
 */

const VISITOR_ID_KEY = "helvino_visitor_id";

/**
 * Generate a unique visitor ID
 */
function generateVisitorId(): string {
  // Try crypto.randomUUID first (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `v_${crypto.randomUUID()}`;
  }

  // Fallback: timestamp + random
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `v_${timestamp}_${random}`;
}

/**
 * Get or create visitor ID
 * Persists in localStorage for consistent identity
 */
export function getVisitorId(): string {
  try {
    // Try to get existing visitor ID
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);

    if (!visitorId) {
      // Generate new visitor ID
      visitorId = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
      console.log("✅ Generated new visitor ID:", visitorId);
    }

    return visitorId;
  } catch (error) {
    // Fallback if localStorage is unavailable
    console.warn("localStorage unavailable, using session-only visitor ID");
    return generateVisitorId();
  }
}

/**
 * Clear visitor ID (logout/reset)
 */
export function clearVisitorId(): void {
  try {
    localStorage.removeItem(VISITOR_ID_KEY);
  } catch (error) {
    console.warn("Failed to clear visitor ID:", error);
  }
}
