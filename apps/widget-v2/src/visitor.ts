export function getVisitorId(): string {
  let id = "";
  try {
    id = localStorage.getItem("helvion_visitor_id") || "";
  } catch {
    // localStorage may be unavailable; fall back to runtime id
  }

  if (!id) {
    try {
      id = "v_" + crypto.randomUUID();
    } catch {
      id = "v_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    }

    try {
      localStorage.setItem("helvion_visitor_id", id);
    } catch {
      // ignore
    }
  }

  return id;
}

