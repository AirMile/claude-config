// GOLD STANDARD — Inspiratie modus
// Zelfde bron als PricingPage-1to1.tsx, maar gemapped naar project THEME.md tokens.
// Geen hardcoded kleuren of spacing — alleen standaard Tailwind classes + theme extensies.
// See source-description.md for the original visual this was converted from.
// DEMONSTRATES: R001 (semantic HTML), R002 (alt text), R004 (aria-labels),
// T002 (typed props), H101 (theme tokens), R103 (standard spacing)

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// TOKEN MAPPING (bron → project theme):
// #2D3748 → bg-surface-dark     (header/footer achtergrond)
// #F7FAFC → bg-surface           (pagina achtergrond)
// #EBF4FF → bg-primary/5         (highlighted tier)
// #3182CE → bg-primary           (CTA, accenten)
// #2B6CB0 → bg-primary-dark      (hover states)
// #1A202C → text-foreground       (primaire tekst)
// #718096 → text-muted-foreground (secundaire tekst)
// #38A169 → text-success          (checkmarks)
// #F6E05E → bg-warning            (badge achtergrond)
// #744210 → text-warning-dark     (badge tekst)

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
    // TOKEN: spacing via standaard Tailwind scale, niet arbitrary values
    <div className="flex items-center justify-center gap-4 mt-8">
      <span
        className={cn(
          "text-base",
          !isYearly ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        Monthly
      </span>
      <button
        onClick={onToggle}
        className="relative w-14 h-7 rounded-full bg-primary transition-colors"
        role="switch"
        aria-checked={isYearly}
        aria-label="Toggle yearly pricing"
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform",
            isYearly && "translate-x-7",
          )}
        />
      </button>
      <span
        className={cn(
          "text-base",
          isYearly ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        Yearly
      </span>
      {/* TOKEN: bg-warning + text-warning-dark (was #F6E05E / #744210) */}
      {isYearly && (
        <span className="bg-warning text-warning-dark text-xs font-bold px-2 py-0.5 rounded-full">
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
    // TOKEN: bg-primary/5 ipv hardcoded #EBF4FF, ring-primary ipv ring-[#3182CE]
    <article
      className={cn(
        "rounded-lg p-8",
        highlighted ? "bg-primary/5 ring-2 ring-primary" : "bg-card",
      )}
    >
      <h3 className="text-2xl font-bold text-foreground">{name}</h3>
      <p className="mt-2 text-base text-muted-foreground">{description}</p>

      {/* TOKEN: text-5xl ipv text-[48px] — standaard Tailwind scale */}
      <p className="mt-6">
        <span className="text-5xl font-extrabold text-foreground">
          ${displayPrice}
        </span>
        <span className="text-base text-muted-foreground">/month</span>
      </p>

      {/* TOKEN: text-success (was #38A169) */}
      <ul className="mt-8 space-y-3" role="list">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-base text-foreground"
          >
            <svg
              className="w-5 h-5 mt-0.5 shrink-0 text-success"
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

      {/* TOKEN: bg-primary / bg-primary-dark — hover via theme token */}
      <button
        className={cn(
          "mt-8 w-full py-3 text-base font-semibold uppercase tracking-wide rounded-lg text-white transition-colors",
          highlighted
            ? "bg-primary-dark hover:bg-primary-dark/90"
            : "bg-primary hover:bg-primary-dark",
        )}
      >
        Get started
      </button>
    </article>
  );
}

export default function PricingPage({ tiers }: PricingPageProps) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    // TOKEN: bg-surface (was #F7FAFC)
    <main className="min-h-screen bg-surface">
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        {/* TOKEN: standaard Tailwind text-4xl ipv text-[36px] */}
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Choose the plan that fits your team. No hidden fees, cancel anytime.
        </p>

        <PricingToggle
          isYearly={isYearly}
          onToggle={() => setIsYearly(!isYearly)}
        />

        {/* Zelfde layout structuur als bron, maar met theme tokens */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <PricingTier key={tier.name} {...tier} isYearly={isYearly} />
          ))}
        </div>
      </section>
    </main>
  );
}
