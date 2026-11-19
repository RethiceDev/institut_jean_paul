import { Suspense } from "react";
import InstitutionHeader from "@/components/InstitutionHeader";
import StatusView from "@/components/StatusView";

export default function StatusPage() {
  return (
    <main className="px-3 py-4 sm:py-6">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <InstitutionHeader />
        <Suspense fallback={<div className="rounded-xl border border-stone-200 bg-white p-5 text-sm">Chargement…</div>}>
          <StatusView />
        </Suspense>
      </div>
    </main>
  );
}
