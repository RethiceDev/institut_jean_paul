import { NextResponse } from "next/server";
import { getStatus } from "@/lib/feexpay";
import { notifyInstitute } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function pickReference(body: unknown, depth = 0): string | null {
  if (!body || typeof body !== "object" || depth > 2) return null;
  const record = body as Record<string, unknown>;
  for (const key of ["reference", "transaction_reference", "ref", "transactionId", "transaction_id"]) {
    const value = record[key];
    if (typeof value === "string" && /^[A-Za-z0-9_.\-]{4,120}$/.test(value)) return value;
  }
  return pickReference(record.data, depth + 1);
}

/** Pour vérifier depuis le tableau de bord FeexPay que l'adresse répond. */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true });
}

/**
 * Webhook FeexPay. Le contenu reçu n'est jamais cru sur parole : on relit le statut auprès de
 * FeexPay avant de notifier l'Institut.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const reference = pickReference(body);
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Référence absente." }, { status: 400 });
  }

  try {
    const result = await getStatus(reference);
    if (result.status === "SUCCESSFUL") {
      await notifyInstitute({
        reference: result.reference,
        amount: result.amount,
        payer: null,
        fallbackPhone: result.phone,
        paidAt: new Date(),
      });
    }
  } catch (error) {
    console.error("[api/webhook] erreur", error);
  }

  // Toujours 200 : FeexPay ne doit pas réessayer en boucle à cause d'un souci de notification.
  return NextResponse.json({ ok: true });
}
