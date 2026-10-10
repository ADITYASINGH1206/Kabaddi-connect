import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type { ImpactStats, Language } from '../types';
import { RefreshCw } from 'lucide-react';
import { btnGhost, materialName, Notice, Page, Spinner } from './ui';

interface ImpactDashboardProps {
  lang: Language;
  onBack: () => void;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({ lang }) => {
  const t = getTranslation(lang);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fetchImpact = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await ApiClient.getImpact();
      setStats(data);
    } catch (err) {
      console.error('Failed to load impact stats:', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImpact();
  }, []);

  // Material entries sorted descending by kg
  const sortedMaterials = stats?.diverted_by_material
    ? Object.entries(stats.diverted_by_material).sort((a, b) => b[1] - a[1])
    : [];
  const maxKg = sortedMaterials.length > 0 ? sortedMaterials[0][1] || 1 : 1;

  const ledger = stats
    ? [
        {
          label: t.incomeFacilitated,
          value: `₹${stats.collector_income_facilitated_inr.toLocaleString('en-IN')}`,
          note: undefined as string | undefined,
        },
        {
          label: t.co2eAvoided,
          value: `${stats.co2e_avoided_kg.toLocaleString('en-IN')} kg`,
          note: undefined as string | undefined,
        },
        {
          label: t.tripsSavedCount,
          value: `${stats.km_saved} ${t.kmSaved}`,
          note: stats.km_saved_is_demo_baseline ? t.demoBaselineTag : undefined,
        },
        {
          label: t.ewasteRedirected,
          value: String(stats.ewaste_items_redirected),
          note: t.ewasteNote,
        },
      ]
    : [];

  return (
    <Page className="gap-5 lg:pt-8">
      <div>
        <h1 className="font-display text-3xl leading-tight">{t.impactTitle}</h1>
        <p className="mt-1.5 text-base text-muted">{t.impactSubtitle}</p>
      </div>

      {loading ? (
        <Spinner text={t.impactLoading} />
      ) : failed || !stats ? (
        <Notice tone="error">
          <p>{t.impactFailed}</p>
          <button onClick={fetchImpact} className={`${btnGhost} mt-3 !min-h-11 !py-2 text-sm`}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t.retry}
          </button>
        </Notice>
      ) : (
        <>
          {/* Headline: kilos, as a weighing-scale readout */}
          <section className="rounded-md border-2 border-ink bg-ink p-5 text-white">
            <p className="text-base font-semibold text-white/80">{t.totalKgDiverted}</p>
            <p className="font-display text-6xl leading-none tabular-nums text-sun lg:text-8xl">
              {stats.total_kg_diverted.toLocaleString('en-IN')}
              <span className="ml-2 text-3xl text-white">{t.kg}</span>
            </p>
            <p className="mt-3 border-t border-white/30 pt-2 text-sm text-white/80">
              {stats.seeded_pickups_count ?? 0} {t.demoWord} + {stats.live_pickups_count ?? 0} {t.liveWord}
              {' · '}
              {t.includesDemoData}
            </p>
          </section>

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-x-12">
          {/* Ledger */}
          <section>
            <h2 className="mb-1 font-display text-2xl">{t.ledgerTitle}</h2>
            <dl className="divide-y-2 divide-line border-y-2 border-ink">
              {ledger.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <dt className="text-base font-semibold">{row.label}</dt>
                    {row.note && <dd className="text-sm text-muted">{row.note}</dd>}
                  </div>
                  <dd className="shrink-0 font-display text-2xl tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-col gap-5">
          {/* Materials */}
          {sortedMaterials.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-2xl">{t.materialBreakdownTitle}</h2>
              <ul className="flex flex-col gap-3">
                {sortedMaterials.map(([mat, kg]) => (
                  <li key={mat}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold capitalize">{materialName(mat)}</span>
                      <span className="text-base font-bold tabular-nums">
                        {kg} {t.kg}
                      </span>
                    </div>
                    <div className="h-3 border-2 border-ink bg-white">
                      <div
                        className="h-full bg-sun"
                        style={{ width: `${Math.max(3, Math.round((kg / maxKg) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Accuracy: only from live pickups */}
          <section className="rounded-md border-2 border-ink bg-white p-4">
            <h2 className="text-base font-semibold text-muted">{t.accuracyTitle}</h2>
            <p className="font-display text-4xl leading-tight tabular-nums">
              {stats.weight_estimation_mape_pct != null ? `${stats.weight_estimation_mape_pct}%` : '—'}
            </p>
            <p className="text-sm text-muted">
              {stats.weight_estimation_mape_pct != null
                ? `${t.accuracyLiveOnly} · ${stats.weight_estimation_sample_size ?? 0} ${t.accuracySample}`
                : t.accuracyNoData}
            </p>
          </section>

          </div>
          </div>

          <p className="text-sm text-muted">
            {stats.emissionSource} — {t.co2Footnote}
          </p>

          <button onClick={fetchImpact} className={`${btnGhost} w-full lg:w-auto lg:self-start`}>
            <RefreshCw className="h-5 w-5" aria-hidden />
            {t.refreshImpact}
          </button>
        </>
      )}
    </Page>
  );
};
