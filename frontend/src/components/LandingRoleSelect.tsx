import React from 'react';
import type { Language, MaterialRate, UserRole } from '../types';
import { getTranslation } from '../i18n/translations';
import { ArrowRight, BarChart3, Camera, ShieldAlert, Truck } from 'lucide-react';
import { Page } from './ui';

// Canonical priority order for common dry recyclables seen on painted Delhi kabadi rate boards
const COMMON_RECYCLABLES_ORDER = [
  'newspaper_paper',
  'cardboard',
  'books_notebooks',
  'iron_steel',
  'pet_bottles',
  'hdpe_plastic',
  'aluminium',
  'copper',
  'brass',
  'glass_bottles',
];

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
  // Exclude electronics/e-waste (laptops, computers), vehicles, and hazardous items from the daily doorstep rate board
  const board = React.useMemo(() => {
    return rates
      .filter(
        (r) =>
          !r.hazardous &&
          !r.material.startsWith('ewaste_') &&
          !r.material.includes('vehicle') &&
          !r.material.includes('tyre')
      )
      .sort((a, b) => {
        const idxA = COMMON_RECYCLABLES_ORDER.indexOf(a.material);
        const idxB = COMMON_RECYCLABLES_ORDER.indexOf(b.material);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      })
      .slice(0, 7);
  }, [rates]);


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

      {/* How it works: a real sequence, so the numbers carry meaning */}
      <section aria-labelledby="how" className="lg:col-span-2 lg:mt-6">
        <h2 id="how" className="mb-3 font-display text-2xl">
          {t.howTitle}
        </h2>
        <ol className="grid gap-3 lg:grid-cols-3 lg:gap-5">
          {[
            [t.how1Title, t.how1Body],
            [t.how2Title, t.how2Body],
            [t.how3Title, t.how3Body],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3 rounded-md border-2 border-ink bg-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun font-display text-lg">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold leading-tight">{title}</h3>
                <p className="mt-1 text-base text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex gap-3 rounded-md border-l-8 border-brick bg-brick-soft p-4 lg:col-span-2">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-brick" aria-hidden />
        <div>
          <p className="text-base font-bold">{t.safeTitle}</p>
          <p className="text-base">{t.safeBody}</p>
        </div>
      </div>

      <section aria-labelledby="aws" className="lg:col-span-2">
        <h2 id="aws" className="mb-3 font-display text-2xl">
          {t.awsTitle}
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-md border-2 border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t.awsBedrock, t.awsBedrockBody],
            [t.awsApi, t.awsApiBody],
            [t.awsDynamo, t.awsDynamoBody],
            [t.awsS3, t.awsS3Body],
          ].map(([name, what]) => (
            <div key={name} className="bg-white p-4">
              <dt className="text-base font-bold">{name}</dt>
              <dd className="text-base text-muted">{what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Page>
  );
};
