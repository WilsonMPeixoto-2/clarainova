const SESSION_FINGERPRINT_KEY = "clara-session-fingerprint";

function fallbackId(): string {
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function getSessionFingerprint(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_FINGERPRINT_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
        : fallbackId();

    sessionStorage.setItem(SESSION_FINGERPRINT_KEY, id);
    return id;
  } catch {
    // sessionStorage might be blocked (privacy mode). Use an in-memory-ish fallback.
    return fallbackId();
  }
}

