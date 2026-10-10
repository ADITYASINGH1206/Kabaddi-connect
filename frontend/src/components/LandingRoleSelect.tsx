import React from 'react';
import type { Language, MaterialRate, UserRole } from '../types';
import { getTranslation } from '../i18n/translations';
import { ArrowRight, BarChart3, Camera, Truck } from 'lucide-react';
import { Page } from './ui';

interface LandingRoleSelectProps {
  lang: Language;
  onSelectRole: (role: UserRole) => void;
  rates?: MaterialRate[];
}

export const LandingRoleSelect: React.FC<LandingRoleSelectProps> = ({
  lang,
  onSelectRole,
  rates = [],
}) => {
  const t = getTranslation(lang);
  const board = rates.filter((r) => !r.hazardous).slice(0, 7);

  return (
    <Page className="gap-6 lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-14 lg:pt-12">
      <h1 className="font-display text-[2rem] leading-[1.15] text-balance lg:col-start-1 lg:text-5xl">{t.landingHeadline}</h1>

      {/* The rate board: the thing every kabadiwala keeps in his head, written down */}
      <section
        aria-labelledby="rate-board"
        className="board-in overflow-hidden rounded-md border-2 border-ink bg-sun lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="flex items-baseline justify-between border-b-2 border-ink px-4 py-2">
          <h2 id="rate-board" className="font-display text-xl">
            {t.rateBoardTitle}
          </h2>
          <span className="text-sm font-bold">₹ / {t.kg}</span>
        </div>
        {board.length > 0 ? (
          <ul className="divide-y-2 divide-ink/80 bg-sun-soft">
            {board.map((r) => (
              <li key={r.material} className="flex items-baseline justify-between gap-3 px-4 py-2">
                <span className="text-base font-semibold">
                  {lang === 'hi' ? r.label_hi : r.label_en}
                </span>
                <span className="shrink-0 font-display text-lg tabular-nums">
                  {r.rate_low}–{r.rate_high}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bg-sun-soft px-4 py-4 text-sm">{t.rateBoardEmpty}</p>
        )}
        <p className="border-t-2 border-ink px-4 py-2 text-sm">{t.rateBoardNote}</p>
      </section>

      <div className="flex flex-col gap-3 lg:col-start-1">
        <p className="text-base font-semibold text-muted">{t.rolePrompt}</p>

        <button
          onClick={() => onSelectRole('household')}
          className="flex min-h-[4.5rem] items-center gap-4 rounded-md border-2 border-ink bg-ink px-4 py-3 text-left text-white hover:bg-ink-2"
        >
          <Camera className="h-8 w-8 shrink-0 text-sun" aria-hidden />
          <span className="flex-1">
            <span className="block text-lg font-bold leading-tight">{t.roleHousehold}</span>
            <span className="block text-sm text-white/80">{t.roleHouseholdSub}</span>
          </span>
          <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
        </button>

        <button
          onClick={() => onSelectRole('collector')}
          className="flex min-h-[4.5rem] items-center gap-4 rounded-md border-2 border-ink bg-white px-4 py-3 text-left hover:bg-sun-soft"
        >
          <Truck className="h-8 w-8 shrink-0" aria-hidden />
          <span className="flex-1">
            <span className="block text-lg font-bold leading-tight">{t.roleCollector}</span>
            <span className="block text-sm text-muted">{t.roleCollectorSub}</span>
          </span>
          <ArrowRight className="h-6 w-6 shrink-0" aria-hidden />
        </button>

        <button
          onClick={() => onSelectRole('impact')}
          className="flex min-h-14 items-center gap-4 rounded-md border-2 border-line bg-transparent px-4 py-3 text-left hover:border-ink hover:bg-white"
        >
          <BarChart3 className="h-6 w-6 shrink-0 text-muted" aria-hidden />
          <span className="flex-1">
            <span className="block text-base font-bold leading-tight">{t.roleImpact}</span>
            <span className="block text-sm text-muted">{t.roleImpactSub}</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
        </button>
      </div>
    </Page>
  );
};
