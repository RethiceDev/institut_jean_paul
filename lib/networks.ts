export type NetworkId = "MTN" | "MOOV" | "CELTIIS" | "CARD";

export interface NetworkOption {
  id: NetworkId;
  label: string;
  hint: string;
  /** Valeur envoyée à FeexPay dans le champ "reseau" (null = carte bancaire). */
  reseau: string | null;
}

export const NETWORKS: readonly NetworkOption[] = [
  { id: "MTN", label: "MTN MoMo", hint: "Mobile Money", reseau: "MTN" },
  { id: "MOOV", label: "Moov Money", hint: "Mobile Money", reseau: "MOOV" },
  { id: "CELTIIS", label: "Celtiis Cash", hint: "Mobile Money", reseau: "CELTIIS_BJ" },
  { id: "CARD", label: "Carte bancaire", hint: "Visa / Mastercard", reseau: null },
];

export function findNetwork(id: string): NetworkOption | undefined {
  return NETWORKS.find((n) => n.id === id);
}
