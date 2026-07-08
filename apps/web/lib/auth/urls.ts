export function getPublicAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export function getAuthRedirectUrl(path = "/auth/callback"): string {
  return `${getPublicAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
