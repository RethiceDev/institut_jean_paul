import { NextResponse } from "next/server";
import { FeexpayError, getStatus } from "@/lib/feexpay";
import { notifyInstitute } from "@/lib/mailer";
import { verifyPayer } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REFERENCE_RE = /^[A-Za-z0-9_.\-]{4,120}$/;

export async function GET(
  request: Request,
  { params }: { params: { reference: string } },
): Promise<NextResponse> {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) {
    return NextResponse.json({ ok: false, error: "Référence invalide." }, { status: 400 });
  }

  try {
    const result = await getStatus(reference);

    if (result.status === "SUCCESSFUL") {
      const payer = verifyPayer(request.headers.get("x-payer-token"), reference);
      await notifyInstitute({
        reference: result.reference,
        amount: result.amount ?? payer?.amount ?? null,
        payer,
        fallbackPhone: result.phone,
        paidAt: new Date(),
      });
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      amount: result.amount,
      reference: result.reference,
    });
  } catch (error) {
    if (error instanceof FeexpayError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("[api/status] erreur inattendue", error);
    return NextResponse.json({ ok: false, error: "Une erreur est survenue." }, { status: 500 });
  }
}
