export const APP_NAME = "Expense Manager App";
export const APP_TAGLINE = "Know where your money goes.";

const DEVELOPER_NAME_FALLBACK = "Ayesha Ali";
const SUPPORT_EMAIL_FALLBACK = "support@example.com";

export function resolveDeveloperName(): string {
  const raw = process.env.NEXT_PUBLIC_DEVELOPER_NAME?.trim();
  if (raw && raw.length > 0) return raw;
  return DEVELOPER_NAME_FALLBACK;
}

export function resolveSupportEmail(): string {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  if (raw && raw.length > 0) return raw;
  return SUPPORT_EMAIL_FALLBACK;
}
