import type { Metadata } from "next";
import { TERMS } from "@/lib/legal";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms & Conditions · Cali's Task" };

export default function TermsPage() {
  return <LegalPage doc={TERMS} />;
}
