import Image from "next/image";

export default function InstitutionHeader() {
  return (
    <header className="flex items-center gap-3 rounded-xl border-b-2 border-gold bg-white px-4 py-3 shadow-sm">
      <Image
        src="/image.jpeg"
        alt="Logo de l'Institut Jean-Paul II"
        width={64}
        height={64}
        priority
        className="h-16 w-16 shrink-0 rounded-full border-2 border-gold object-cover object-top"
      />
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">République du Bénin</p>
        <h1 className="text-base font-bold text-wine sm:text-lg">Institut Jean-Paul II</h1>
        <p className="text-xs text-slate-600">de la philosophie et des sciences humaines</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold text-navy">Trésorerie du Décanat</span>
          <span className="rounded bg-yellow-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
            Exercice 2026-2027
          </span>
        </p>
      </div>
    </header>
  );
}
