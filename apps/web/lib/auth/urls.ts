const PRODUCTION_APP_URL = "https://sync-ut.vercel.app";

export function getPublicAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return PRODUCTION_APP_URL;
}

export function getAuthRedirectUrl(path = "/auth/callback"): string {
  return `${getPublicAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
