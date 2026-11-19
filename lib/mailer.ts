import nodemailer from "nodemailer";
import { getAppUrl } from "./config";
import type { PayerInfo } from "./token";
import { findNetwork } from "./networks";

export interface NotificationData {
  reference: string;
  /** Montant confirmé par FeexPay (prioritaire) ou, à défaut, celui saisi par le client. */
  amount: number | null;
  payer: PayerInfo | null;
  /** Numéro renvoyé par FeexPay quand les informations du payeur ne sont pas disponibles. */
  fallbackPhone: string | null;
  paidAt: Date;
}

const g = globalThis as typeof globalThis & { __notifiedRefs?: Set<string> };
const notified = (g.__notifiedRefs ??= new Set<string>());

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function formatAmount(amount: number | null): string {
  return amount === null ? "Non communiqué" : `${new Intl.NumberFormat("fr-FR").format(amount).replace(/[\u202f\u00a0]/g, " ")} FCFA`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(date);
}

function buildMessage(data: NotificationData): { subject: string; html: string; text: string } {
  const p = data.payer;
  const amount = formatAmount(data.amount ?? p?.amount ?? null);
  const rows: Array<[string, string]> = [
    ["Nom", p?.nom ?? "Non disponible"],
    ["Prénoms", p?.prenoms ?? "Non disponible"],
    ["E-mail", p?.email ?? "Non disponible"],
    ["Téléphone", p?.phone ?? data.fallbackPhone ?? "Non disponible"],
    ["Motif", p?.motif ?? "Non disponible"],
    ["Montant", amount],
    ["Moyen de paiement", (p ? findNetwork(p.network)?.label : undefined) ?? "Non disponible"],
    ["Référence de transaction", data.reference],
    ["Date et heure", formatDate(data.paidAt)],
  ];

  const subject = oneLine(
    p ? `Nouveau paiement de ${amount} – ${p.nom} ${p.prenoms}` : `Nouveau paiement de ${amount}`,
  );

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:16px;background:#f3f1ea;font-family:Arial,Helvetica,sans-serif;color:#222;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;padding:24px 28px;">
<tr><td style="font-size:12px;color:#7a1020;font-weight:bold;">Institut Jean-Paul II – Trésorerie du Décanat</td></tr>
<tr><td style="font-size:20px;font-weight:bold;color:#1f3a5f;padding:6px 0 14px;">Nouveau paiement confirmé</td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 0;border-bottom:1px dashed #b9b5a6;font-size:12px;font-weight:bold;color:#444;width:38%;">${esc(label)}</td><td style="padding:8px 0;border-bottom:1px dashed #b9b5a6;font-size:13px;">${esc(value)}</td></tr>`,
  )
  .join("\n")}
</table></td></tr>
<tr><td style="padding-top:16px;font-size:11px;color:#888;">Notification automatique – ${esc(getAppUrl())}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [`Nouveau paiement confirmé`, "", ...rows.map(([label, value]) => `${label} : ${value}`)].join("\n");

  return { subject, html, text };
}

async function sendWithResend(
  apiKey: string,
  to: string,
  message: { subject: string; html: string; text: string },
  reference: string,
): Promise<boolean> {
  const from = process.env.MAIL_FROM?.trim() || "Institut Jean-Paul II <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Évite les doublons si plusieurs requêtes confirment le même paiement.
      "Idempotency-Key": `payment-${reference}`.slice(0, 256),
    },
    body: JSON.stringify({ from, to: [to], subject: message.subject, html: message.html, text: message.text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (res.ok) return true;
  if (res.status === 409) {
    // Même clé d'idempotence déjà utilisée : la notification est déjà partie (ou en cours d'envoi).
    return true;
  }
  console.error("[mailer] Resend a refusé l'envoi", res.status, await res.text().catch(() => ""));
  return false;
}

async function sendWithSmtp(to: string, message: { subject: string; html: string; text: string }): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10) || 587;
  if (!host) return false;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM?.trim() || user,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return true;
}

/**
 * Prévient l'Institut qu'un paiement est confirmé.
 * Ne lève jamais d'erreur : un problème d'e-mail ne doit pas casser le paiement.
 */
export async function notifyInstitute(data: NotificationData): Promise<void> {
  const to = process.env.INSTITUTE_NOTIFICATION_EMAIL?.trim();
  if (!to) {
    console.warn("[mailer] INSTITUTE_NOTIFICATION_EMAIL non défini : notification ignorée.");
    return;
  }
  if (notified.has(data.reference)) return;
  notified.add(data.reference);

  const message = buildMessage(data);
  const resendKey = process.env.RESEND_API_KEY?.trim();

  try {
    let sent: boolean;
    if (resendKey) {
      sent = await sendWithResend(resendKey, to, message, data.reference);
    } else if (process.env.SMTP_HOST?.trim()) {
      sent = await sendWithSmtp(to, message);
    } else {
      console.warn("[mailer] Ni RESEND_API_KEY ni SMTP_HOST définis : notification ignorée.");
      sent = true; // inutile de réessayer tant que rien n'est configuré
    }
    if (!sent) notified.delete(data.reference);
  } catch (error) {
    notified.delete(data.reference);
    console.error("[mailer] Échec de l'envoi de la notification", error);
  }
}
