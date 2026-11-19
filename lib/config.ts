export type FeexpayMode = "SANDBOX" | "LIVE";

export function getMode(): FeexpayMode {
  return process.env.FEEXPAY_MODE?.trim().toUpperCase() === "LIVE" ? "LIVE" : "SANDBOX";
}

/** Le sandbox (clés test_key_...) et la production (clés fp_...) n'ont pas la même adresse. */
export function getApiBase(): string {
  return getMode() === "LIVE" ? "https://api-v2.feexpay.me" : "https://sandbox-api.feexpay.me";
}

export function getMinAmount(): number {
  const parsed = Number.parseInt(process.env.FEEXPAY_MIN_AMOUNT ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export interface Credentials {
  apiKey: string;
  shopId: string;
}

export function getCredentials(): Credentials | null {
  const apiKey = process.env.FEEXPAY_API_KEY?.trim();
  const shopId = process.env.FEEXPAY_SHOP_ID?.trim();
  return apiKey && shopId ? { apiKey, shopId } : null;
}

export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  return raw && /^https?:\/\//.test(raw) ? raw : "http://localhost:3000";
}
