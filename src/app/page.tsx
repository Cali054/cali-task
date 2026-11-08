import type { Metadata } from "next";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { ProductShowcase } from "@/components/landing/product-showcase";
import { FeatureSection } from "@/components/landing/feature-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { ProductPreview } from "@/components/landing/product-preview";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Cali · Take control of your work, one sprint at a time",
  description:
    "Cali is a productivity and sprint management platform. Organize tasks, monitor sprint progress, track blockers and measure productivity.",
  openGraph: {
    title: "Cali · Sprint management, beautifully simple",
    description: "Organize your tasks, monitor sprint progress, track blockers, and turn your daily workload into measurable achievements.",
  },
};

/** Public landing page. The app itself lives under /dashboard. */
export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="glass-strong fixed left-4 top-4 z-[60] -translate-y-24 rounded-2xl px-4 py-2 text-sm font-semibold focus:translate-y-0"
      >
        Skip to content
      </a>
      <LandingNavbar />
      <main id="main" className="overflow-x-clip">
        <HeroSection />
        <ProductShowcase />
        <FeatureSection />
        <HowItWorks />
        <BenefitsSection />
        <ProductPreview />
        <FAQSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </>
  );
}
