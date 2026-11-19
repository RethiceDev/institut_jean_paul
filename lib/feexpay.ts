import { getApiBase, getCredentials } from "./config";

export class FeexpayError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "FeexpayError";
    this.status = status;
  }
}

export type PaymentStatus = "SUCCESSFUL" | "PENDING" | "FAILED";

export interface StatusResult {
  status: PaymentStatus;
  reference: string;
  amount: number | null;
  phone: string | null;
}

interface ApiResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

function requireCredentials(): { apiKey: string; shopId: string } {
  const credentials = getCredentials();
  if (!credentials) throw new FeexpayError("Le service de paiement n'est pas encore configuré.");
  return credentials;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(data: unknown, key: string): string | null {
  const value = asRecord(data)[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readNumber(data: unknown, key: string): number | null {
  const value = asRecord(data)[key];
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function explain(res: ApiResponse, fallback: string): string {
  if (res.status === 401 || res.status === 403) {
    return "FeexPay refuse les identifiants : vérifiez FEEXPAY_API_KEY, FEEXPAY_SHOP_ID et FEEXPAY_MODE (SANDBOX avec une clé test_key_, LIVE avec une clé de production).";
  }
  const record = asRecord(res.data);
  for (const key of ["message", "error", "errors"]) {
    const value = record[key];
    if (typeof value === "string" && value !== "") return value;
    if (value && typeof value === "object") return JSON.stringify(value);
  }
  return fallback;
}

async function request(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  timeoutMs: number,
): Promise<ApiResponse> {
  const { apiKey } = requireCredentials();

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new FeexpayError(
      timedOut
        ? "FeexPay met trop de temps à répondre. Réessayez dans un instant."
        : "Impossible de joindre FeexPay. Réessayez dans un instant.",
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

export interface MobileParams {
  phone: string;
  amount: number;
  reseau: string;
  fullName: string;
  email: string;
  motif: string;
  customId: string;
}

/** Mobile Money : envoie la demande de paiement sur le téléphone du client et retourne la référence FeexPay. */
export async function initiateMobile(params: MobileParams): Promise<string> {
  const { shopId } = requireCredentials();
  // FeexPay peut attendre la validation du client avant de répondre : timeout aligné sur maxDuration (60 s).
  const res = await request(
    "/api/transactions/requesttopay/integration",
    {
      method: "POST",
      body: {
        phoneNumber: params.phone,
        amount: params.amount,
        reseau: params.reseau,
        shop: shopId,
        first_name: params.fullName,
        email: params.email,
        callback_info: params.motif,
        reference: params.customId,
        otp: "",
      },
    },
    55_000,
  );

  const reference = readString(res.data, "reference");
  if (reference) return reference;
  throw new FeexpayError(explain(res, "Le paiement a été refusé par FeexPay."), res.status);
}

export interface CardParams {
  amount: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/** Carte bancaire : retourne l'adresse de la page de paiement sécurisée et la référence. */
export async function initiateCard(params: CardParams): Promise<{ url: string; reference: string }> {
  const { shopId } = requireCredentials();
  const res = await request(
    "/api/transactions/public/requesttopay/init",
    {
      method: "POST",
      body: {
        shop: shopId,
        amount: params.amount,
        currency: "XOF",
        first_name: params.firstName,
        last_name: params.lastName,
        email: params.email,
        phoneNumber: params.phone,
        city: "Cotonou",
        zip: "00000",
        country: "BJ",
      },
    },
    30_000,
  );

  const url = readString(res.data, "payment_url");
  if (url && url.startsWith("https://")) {
    return { url, reference: readString(res.data, "reference") ?? "" };
  }
  throw new FeexpayError(explain(res, "Le paiement par carte a été refusé par FeexPay."), res.status);
}

function normalizeStatus(value: unknown): PaymentStatus {
  const s = typeof value === "string" ? value.toUpperCase() : "";
  if (s.includes("SUCCESS")) return "SUCCESSFUL";
  if (s.includes("FAIL") || s.includes("CANCEL") || s.includes("REJECT") || s.includes("EXPIRE") || s.includes("DECLIN")) {
    return "FAILED";
  }
  return "PENDING";
}

export async function getStatus(reference: string): Promise<StatusResult> {
  const res = await request(
    `/api/transactions/public/single/status/${encodeURIComponent(reference)}`,
    { method: "GET" },
    15_000,
  );

  if (res.status === 401 || res.status === 403) {
    throw new FeexpayError(explain(res, "Accès refusé par FeexPay."), res.status);
  }
  if (!res.ok || typeof res.data !== "object" || res.data === null) {
    return { status: "PENDING", reference, amount: null, phone: null };
  }

  return {
    status: normalizeStatus(asRecord(res.data).status),
    reference: readString(res.data, "reference") ?? reference,
    amount: readNumber(res.data, "amount"),
    phone: readString(res.data, "phoneNumber") ?? readString(res.data, "phone_number"),
  };
}
