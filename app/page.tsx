import InstitutionHeader from "@/components/InstitutionHeader";
import PaymentForm from "@/components/PaymentForm";
import { getMinAmount } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="px-3 py-4 sm:py-6">
      <div className="mx-auto w-full max-w-xl space-y-3">
        <InstitutionHeader />
        <PaymentForm minAmount={getMinAmount()} />
      </div>
    </main>
  );
}
