import { createHmac, timingSafeEqual } from "crypto";
import { getCredentials } from "./config";
import type { NetworkId } from "./networks";

export interface PayerInfo {
  nom: string;
  prenoms: string;
  email: string;
  phone: string;
  motif: string;
  amount: number;
  network: NetworkId;
  createdAt: string;
}

interface TokenPayload extends PayerInfo {
  reference: string;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * Jeton signé (HMAC) qui contient les informations du payeur et la référence FeexPay.
 * Le navigateur le garde et le renvoie à /api/status pour que l'Institut reçoive un
 * récapitulatif complet, sans base de données. Il ne peut pas être falsifié.
 */
export function signPayer(info: PayerInfo, reference: string): string {
  const credentials = getCredentials();
  if (!credentials) throw new Error("Identifiants FeexPay manquants.");
  const payload: TokenPayload = { ...info, reference };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, credentials.apiKey)}`;
}

export function verifyPayer(token: string | null | undefined, reference: string): PayerInfo | null {
  const credentials = getCredentials();
  if (!token || !credentials) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, credentials.apiKey));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (payload.reference !== reference) return null;
    const { reference: _ignored, ...info } = payload;
    void _ignored;
    return info;
  } catch {
    return null;
  }
}
