// GOLD STANDARD — 1:1 modus
// Faithfully reproduces the source visual. Hardcoded values are expected.
// See source-description.md for the original visual this was converted from.
// DEMONSTRATES: R001 (semantic HTML), R002 (alt text), R004 (aria-labels),
// T002 (typed props), H101 (hardcoded colors OK in 1:1 mode)

"use client";

import { useState } from "react";

// SOURCE: exact overgenomen uit bron — geen token mapping in 1:1 modus

interface PricingTierProps {
  readonly name: string;
  readonly price: number;
  readonly yearlyPrice: number;
  readonly description: string;
  readonly features: string[];
  readonly highlighted?: boolean;
}

interface PricingPageProps {
  readonly tiers: PricingTierProps[];
}

function PricingToggle({
  isYearly,
  onToggle,
}: {
  readonly isYearly: boolean;
  readonly onToggle: () => void;
}) {
  return (
    // SOURCE: toggle layout exact van bron
    <div className="flex items-center justify-center gap-4 mt-8">
      <span
        className={`text-[16px] ${!isYearly ? "font-semibold text-[#1A202C]" : "text-[#718096]"}`}
      >
        Monthly
      </span>
      <button
        onClick={onToggle}
        className="relative w-[56px] h-[28px] rounded-full bg-[#3182CE] transition-colors"
        role="switch"
        aria-checked={isYearly}
        aria-label="Toggle yearly pricing"
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[24px] h-[24px] bg-white rounded-full transition-transform ${
            isYearly ? "translate-x-[28px]" : ""
          }`}
        />
      </button>
      <span
        className={`text-[16px] ${isYearly ? "font-semibold text-[#1A202C]" : "text-[#718096]"}`}
      >
        Yearly
      </span>
      {/* SOURCE: badge exact — #F6E05E achtergrond, #744210 tekst */}
      {isYearly && (
        <span className="bg-[#F6E05E] text-[#744210] text-[12px] font-bold px-2 py-0.5 rounded-full">
          -20%
        </span>
      )}
    </div>
  );
}

function PricingTier({
  name,
  price,
  yearlyPrice,
  description,
  features,
  highlighted = false,
  isYearly,
}: PricingTierProps & { readonly isYearly: boolean }) {
  const displayPrice = isYearly ? yearlyPrice : price;

  return (
    // SOURCE: highlighted tier krijgt #EBF4FF achtergrond + ring
    <article
      className={`rounded-lg p-8 ${
        highlighted ? "bg-[#EBF4FF] ring-2 ring-[#3182CE]" : "bg-white"
      }`}
    >
      <h3 className="text-[24px] font-bold text-[#1A202C]">{name}</h3>
      <p className="mt-2 text-[16px] text-[#718096]">{description}</p>

      {/* SOURCE: prijs exact — 48px, weight 800 */}
      <p className="mt-6">
        <span className="text-[48px] font-extrabold text-[#1A202C]">
          ${displayPrice}
        </span>
        <span className="text-[16px] text-[#718096]">/month</span>
      </p>

      {/* SOURCE: feature lijst met groene checkmarks (#38A169) */}
      <ul className="mt-8 space-y-3" role="list">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-[16px] text-[#1A202C]"
          >
            <svg
              className="w-5 h-5 mt-0.5 shrink-0 text-[#38A169]"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {/* SOURCE: CTA blauw (#3182CE), highlighted variant donkerder (#2B6CB0) */}
      <button
        className={`mt-8 w-full py-3 text-[16px] font-semibold uppercase tracking-wide rounded-lg transition-colors ${
          highlighted
            ? "bg-[#2B6CB0] text-white hover:bg-[#2C5282]"
            : "bg-[#3182CE] text-white hover:bg-[#2B6CB0]"
        }`}
      >
        Get started
      </button>
    </article>
  );
}

export default function PricingPage({ tiers }: PricingPageProps) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    // SOURCE: achtergrond #F7FAFC, volledige pagina layout
    <main className="min-h-screen bg-[#F7FAFC]">
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        {/* SOURCE: heading exact — 36px, weight 800, tight tracking */}
        <h1 className="text-[36px] font-extrabold tracking-tight text-[#1A202C]">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-[18px] text-[#718096] max-w-2xl mx-auto leading-relaxed">
          Choose the plan that fits your team. No hidden fees, cancel anytime.
        </p>

        <PricingToggle
          isYearly={isYearly}
          onToggle={() => setIsYearly(!isYearly)}
        />

        {/* SOURCE: 3-kolom grid, responsive naar 1 kolom op mobiel */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <PricingTier key={tier.name} {...tier} isYearly={isYearly} />
          ))}
        </div>
      </section>
    </main>
  );
}
