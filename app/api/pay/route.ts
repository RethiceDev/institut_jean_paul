import { NextResponse } from "next/server";
import { getCredentials, getMinAmount } from "@/lib/config";
import { FeexpayError, initiateCard, initiateMobile } from "@/lib/feexpay";
import { findNetwork } from "@/lib/networks";
import { signPayer, type PayerInfo } from "@/lib/token";
import { validatePayInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Mobile Money : FeexPay peut attendre la validation du client sur son téléphone.
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const parsed = validatePayInput(raw, getMinAmount());
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  if (!getCredentials()) {
    return NextResponse.json(
      { ok: false, error: "Le service de paiement n'est pas encore configuré." },
      { status: 503 },
    );
  }

  const input = parsed.data;
  const option = findNetwork(input.network);
  if (!option) {
    return NextResponse.json({ ok: false, errors: { network: "Moyen de paiement inconnu." } }, { status: 400 });
  }

  const payer: PayerInfo = { ...input, createdAt: new Date().toISOString() };

  try {
    if (option.reseau === null) {
      const card = await initiateCard({
        amount: input.amount,
        firstName: input.prenoms,
        lastName: input.nom,
        email: input.email,
        phone: input.phone,
      });
      return NextResponse.json({
        ok: true,
        kind: "redirect",
        url: card.url,
        reference: card.reference,
        token: card.reference ? signPayer(payer, card.reference) : "",
      });
    }

    const reference = await initiateMobile({
      phone: input.phone,
      amount: input.amount,
      reseau: option.reseau,
      fullName: `${input.prenoms} ${input.nom}`,
      email: input.email,
      motif: input.motif,
      customId: crypto.randomUUID(),
    });

    return NextResponse.json({
      ok: true,
      kind: "mobile",
      reference,
      token: signPayer(payer, reference),
    });
  } catch (error) {
    if (error instanceof FeexpayError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("[api/pay] erreur inattendue", error);
    return NextResponse.json({ ok: false, error: "Une erreur est survenue. Réessayez." }, { status: 500 });
  }
}
