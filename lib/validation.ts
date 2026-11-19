import { findNetwork, type NetworkId } from "./networks";

export interface PayInput {
  nom: string;
  prenoms: string;
  filiere: string;
  annee: string;
  email: string;
  phone: string;
  motif: string;
  amount: number;
  network: NetworkId;
}

export type ValidationResult =
  | { ok: true; data: PayInput }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^22901\d{8}$/;
const MAX_AMOUNT = 5_000_000;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max + 1) : "";
}

/** "01 66 00 00 00", "+229 01 66 00 00 00" ou "0166000000" => "2290166000000". */
export function normalizePhone(value: unknown): string {
  let digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits !== "" && !digits.startsWith("229")) digits = `229${digits}`;
  return digits;
}

export function validatePayInput(raw: unknown, minAmount: number): ValidationResult {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const nom = clean(src.nom, 100);
  const prenoms = clean(src.prenoms, 150);
  const filiere = clean(src.filiere, 150);
  const annee = clean(src.annee, 80);
  const email = clean(src.email, 150).toLowerCase();
  const motif = clean(src.motif, 200);
  const phone = normalizePhone(src.phone);
  const network = typeof src.network === "string" ? findNetwork(src.network) : undefined;

  const amountRaw = typeof src.amount === "number" ? src.amount : Number(String(src.amount ?? "").replace(/\s/g, ""));

  if (nom === "") errors.nom = "Le nom est obligatoire.";
  else if (nom.length > 100) errors.nom = "Le nom est trop long.";

  if (prenoms === "") errors.prenoms = "Les prénoms sont obligatoires.";
  else if (prenoms.length > 150) errors.prenoms = "Les prénoms sont trop longs.";

  if (filiere === "") errors.filiere = "La filière est obligatoire.";
  else if (filiere.length > 150) errors.filiere = "La filière est trop longue.";

  if (annee === "") errors.annee = "L'année est obligatoire.";
  else if (annee.length > 80) errors.annee = "L'année est trop longue.";

  if (email === "") errors.email = "L'adresse e-mail est obligatoire.";
  else if (!EMAIL_RE.test(email)) errors.email = "Adresse e-mail invalide.";

  if (phone === "") errors.phone = "Le numéro de téléphone est obligatoire.";
  else if (!PHONE_RE.test(phone)) errors.phone = "Numéro béninois invalide (ex : 01 66 00 00 00).";

  if (motif.length < 2) errors.motif = "Le motif du paiement est obligatoire.";
  else if (motif.length > 200) errors.motif = "Le motif est trop long.";

  if (!Number.isInteger(amountRaw) || amountRaw <= 0) errors.amount = "Saisissez un montant en FCFA (nombre entier).";
  else if (amountRaw < minAmount) errors.amount = `Le montant minimum est de ${minAmount} FCFA.`;
  else if (amountRaw > MAX_AMOUNT) errors.amount = `Le montant maximum est de ${MAX_AMOUNT} FCFA.`;

  if (!network) errors.network = "Choisissez un moyen de paiement.";

  if (Object.keys(errors).length > 0 || !network) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: { nom, prenoms, filiere, annee, email, phone, motif, amount: amountRaw, network: network.id },
  };
}