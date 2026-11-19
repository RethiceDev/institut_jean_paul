"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "pending" | "success" | "failed";

interface StatusResponse {
  ok: boolean;
  status?: "SUCCESSFUL" | "PENDING" | "FAILED";
  amount?: number | null;
  error?: string;
}

const POLL_MS = 4000;
const MAX_POLLS = 45;

function readToken(reference: string): string | null {
  try {
    return window.sessionStorage.getItem(`payer:${reference}`);
  } catch {
    return null;
  }
}

function formatAmount(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount).replace(/[\u202f\u00a0]/g, " ")} FCFA`;
}

const cardClass = "rounded-xl border border-stone-200 bg-white p-5 shadow-sm";
const linkClass =
  "mt-4 block rounded-lg bg-navy px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#16304f] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";

export default function StatusView() {
  const params = useSearchParams();
  const reference = params.get("ref") ?? "";

  const [phase, setPhase] = useState<Phase>("pending");
  const [amount, setAmount] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const finished = useRef(false);

  const check = useCallback(async (): Promise<void> => {
    if (!reference) return;
    try {
      const token = readToken(reference);
      const res = await fetch(`/api/status/${encodeURIComponent(reference)}`, {
        headers: token ? { "x-payer-token": token } : undefined,
        cache: "no-store",
      });
      const data = (await res.json()) as StatusResponse;

      if (!res.ok || !data.ok) {
        setNotice(data.error ?? "Vérification momentanément impossible, nouvelle tentative…");
        return;
      }
      setNotice("");

      if (data.status === "SUCCESSFUL") {
        finished.current = true;
        setAmount(data.amount ?? null);
        setPhase("success");
      } else if (data.status === "FAILED") {
        finished.current = true;
        setPhase("failed");
      }
    } catch {
      setNotice("Connexion perdue, nouvelle tentative…");
    }
  }, [reference]);

  useEffect(() => {
    if (!reference) return;
    let polls = 0;
    void check();
    const id = window.setInterval(() => {
      if (finished.current) {
        window.clearInterval(id);
        return;
      }
      polls += 1;
      if (polls >= MAX_POLLS) {
        window.clearInterval(id);
        setTimedOut(true);
        return;
      }
      void check();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [reference, check]);

  if (!reference) {
    return (
      <div className={cardClass} role="alert">
        <p className="text-sm text-slate-800">{"Référence de paiement manquante."}</p>
        <Link href="/" className={linkClass}>
          Retour au formulaire
        </Link>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className={cardClass} role="status" aria-live="polite">
        <h2 className="text-lg font-bold text-green-800">Paiement confirmé</h2>
        {amount !== null ? <p className="mt-1 text-sm text-slate-800">Montant : {formatAmount(amount)}</p> : null}
        <p className="mt-2 text-sm text-slate-700">
          {"Votre reçu officiel est envoyé automatiquement par FeexPay à l'adresse e-mail saisie. Pensez à vérifier vos courriers indésirables."}
        </p>
        <p className="mt-2 break-all text-xs text-slate-500">Référence : {reference}</p>
        <Link href="/" className={linkClass}>
          Nouveau paiement
        </Link>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className={cardClass} role="alert">
        <h2 className="text-lg font-bold text-red-800">Paiement non abouti</h2>
        <p className="mt-2 text-sm text-slate-700">
          {"Le paiement a été refusé ou annulé. Aucun montant n'a été débité. Vous pouvez recommencer."}
        </p>
        <p className="mt-2 break-all text-xs text-slate-500">Référence : {reference}</p>
        <Link href="/" className={linkClass}>
          Recommencer
        </Link>
      </div>
    );
  }

  return (
    <div className={cardClass} role="status" aria-live="polite">
      <h2 className="text-lg font-bold text-navy">En attente de votre validation</h2>
      <p className="mt-2 text-sm text-slate-700">
        {"Une demande de paiement vient d'être envoyée sur votre téléphone. Validez-la en saisissant votre code secret. Cette page se met à jour automatiquement."}
      </p>
      {notice ? <p className="mt-2 text-xs text-amber-700">{notice}</p> : null}
      {timedOut ? (
        <button
          type="button"
          onClick={() => {
            setTimedOut(false);
            void check();
          }}
          className="mt-4 w-full rounded-lg border border-navy px-4 py-3 text-sm font-semibold text-navy hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Vérifier maintenant
        </button>
      ) : null}
      <p className="mt-3 break-all text-xs text-slate-500">Référence : {reference}</p>
    </div>
  );
}
