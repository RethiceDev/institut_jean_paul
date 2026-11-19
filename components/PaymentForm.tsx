"use client";

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { NETWORKS, type NetworkId } from "@/lib/networks";
import { validatePayInput } from "@/lib/validation";

interface Values {
  nom: string;
  prenoms: string;
  filiere: string;
  annee: string;
  email: string;
  phone: string;
  motif: string;
  amount: string;
  network: NetworkId;
}

type PayResponse =
  | { ok: true; kind: "mobile" | "redirect"; reference: string; token: string; url?: string }
  | { ok: false; error?: string; errors?: Record<string, string> };

const MTN_NETWORK =
  NETWORKS.find((n) => n.id.toLowerCase().includes("mtn")) ?? NETWORKS[0];

const INITIAL: Values = {
  nom: "",
  prenoms: "",
  filiere: "",
  annee: "",
  email: "",
  phone: "",
  motif: "",
  amount: "",
  network: MTN_NETWORK.id,
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-gold";

function Field(props: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-xs font-semibold text-slate-700">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p id={`${props.id}-error`} role="alert" className="mt-1 text-xs text-red-700">
          {props.error}
        </p>
      ) : props.hint ? (
        <p id={`${props.id}-hint`} className="mt-1 text-xs text-slate-500">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}

export default function PaymentForm({ minAmount }: { minAmount: number }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function describedBy(name: string, hasHint = false): string | undefined {
    if (errors[name]) return `${name}-error`;
    return hasHint ? `${name}-hint` : undefined;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError("");

    const check = validatePayInput(values as Parameters<typeof validatePayInput>[0], minAmount);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as PayResponse;

      if (!data.ok) {
        if (data.errors) setErrors(data.errors);
        setFormError(data.error ?? (data.errors ? "Corrigez les champs indiqués." : "Le paiement a échoué. Réessayez."));
        return;
      }

      if (data.reference && data.token) {
        try {
          window.sessionStorage.setItem(`payer:${data.reference}`, data.token);
        } catch {
          // Stockage indisponible : le paiement reste valide, seul le récapitulatif de l'Institut sera plus court.
        }
      }

      if (data.kind === "redirect" && data.url) {
        window.location.assign(data.url);
        return;
      }
      router.push(`/paiement/statut?ref=${encodeURIComponent(data.reference)}`);
    } catch {
      setFormError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const amountNumber = Number(values.amount);
  const label =
    Number.isInteger(amountNumber) && amountNumber > 0
      ? `Payer ${new Intl.NumberFormat("fr-FR").format(amountNumber).replace(/[\u202f\u00a0]/g, " ")} FCFA avec ${MTN_NETWORK.label}`
      : `Payer avec ${MTN_NETWORK.label}`;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      {formError ? (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="nom" label="Nom" error={errors.nom}>
          <input
            id="nom"
            name="nom"
            value={values.nom}
            onChange={onChange}
            autoComplete="family-name"
            required
            aria-invalid={Boolean(errors.nom)}
            aria-describedby={describedBy("nom")}
            className={inputClass}
          />
        </Field>
        <Field id="prenoms" label="Prénoms" error={errors.prenoms}>
          <input
            id="prenoms"
            name="prenoms"
            value={values.prenoms}
            onChange={onChange}
            autoComplete="given-name"
            required
            aria-invalid={Boolean(errors.prenoms)}
            aria-describedby={describedBy("prenoms")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="filiere" label="Filière" error={errors.filiere}>
          <input
            id="filiere"
            name="filiere"
            value={values.filiere}
            onChange={onChange}
            placeholder="Ex. Philosophie, Sciences humaines…"
            required
            aria-invalid={Boolean(errors.filiere)}
            aria-describedby={describedBy("filiere")}
            className={inputClass}
          />
        </Field>
        <Field id="annee" label="Année" error={errors.annee}>
          <input
            id="annee"
            name="annee"
            value={values.annee}
            onChange={onChange}
            placeholder="Ex. 1re année, 2e année, 3e année…"
            required
            aria-invalid={Boolean(errors.annee)}
            aria-describedby={describedBy("annee")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="email"
          label="Adresse e-mail"
          error={errors.email}
          hint="Le reçu officiel sera envoyé automatiquement à cette adresse."
        >
          <input
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={onChange}
            autoComplete="email"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email", true)}
            className={inputClass}
          />
        </Field>
        <Field id="phone" label="Numéro MTN MoMo" error={errors.phone} hint="Le numéro MTN du compte qui paie.">
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={onChange}
            autoComplete="tel"
            placeholder="01 66 00 00 00"
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy("phone", true)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field id="motif" label="Motif du paiement" error={errors.motif}>
          <input
            id="motif"
            name="motif"
            value={values.motif}
            onChange={onChange}
            list="motifs"
            required
            placeholder="Frais de scolarité, droits d'inscription…"
            aria-invalid={Boolean(errors.motif)}
            aria-describedby={describedBy("motif")}
            className={inputClass}
          />
          <datalist id="motifs">
            <option value="Frais de scolarité" />
            <option value="Droits d'inscription" />
            <option value="Frais d'examen" />
            <option value="Cotisation" />
          </datalist>
        </Field>
        <Field id="amount" label="Montant (FCFA)" error={errors.amount}>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="numeric"
            min={minAmount}
            step={1}
            value={values.amount}
            onChange={onChange}
            required
            placeholder={`min. ${minAmount}`}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={describedBy("amount")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-800">Moyen de paiement</span>
        <span className="font-semibold text-amber-900">
          {MTN_NETWORK.label} {MTN_NETWORK.hint ? `(${MTN_NETWORK.hint})` : ""}
        </span>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#16304f] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Envoi de la demande de paiement…" : label}
      </button>
      <p className="text-center text-[11px] text-slate-500">
        {"Paiement sécurisé par FeexPay. Vos données bancaires ne transitent jamais par ce site."}
      </p>
    </form>
  );
}