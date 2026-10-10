import React, { useMemo, useState } from 'react';
import type {
  DetectedItem,
  Language,
  MaterialRate,
  VisionAnalysisResponse,
} from '../types';
import { getTranslation } from '../i18n/translations';
import {
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  btnGhost,
  btnPrimary,
  btnSun,
  fieldInput,
  inr,
  niceMax,
  Notice,
  Page,
  RangeRuler,
  Sheet,
} from './ui';

interface HouseholdReviewProps {
  lang: Language;
  analysis: VisionAnalysisResponse;
  rates: MaterialRate[];
  previewUrl?: string;
  onRetake: () => void;
  onProceed: (confirmedItems: DetectedItem[], priceRange: { low: number; high: number }) => void;
}

const MIN_KG = 0.5;
const clampKg = (v: number) => Math.max(MIN_KG, Math.round(v * 2) / 2);

export const HouseholdReview: React.FC<HouseholdReviewProps> = ({
  lang,
  analysis,
  rates,
  previewUrl,
  onRetake,
  onProceed,
}) => {
  const t = getTranslation(lang);

  // Map rates for O(1) lookup
  const ratesMap = useMemo(() => {
    const map = new Map<string, MaterialRate>();
    for (const r of rates) {
      map.set(r.material, r);
    }
    return map;
  }, [rates]);

  // Initialize items from analysis
  const [items, setItems] = useState<DetectedItem[]>(() => {
    return (analysis.items || []).map((it, idx) => {
      const avgWeight = (it.weight_kg_low + it.weight_kg_high) / 2 || 2.0;
      return {
        id: `item-${idx}-${Date.now()}`,
        material: it.material,
        weight_kg_low: it.weight_kg_low,
        weight_kg_high: it.weight_kg_high,
        weight_kg_user: Number(avgWeight.toFixed(1)),
        confidence: it.confidence,
        note: it.note,
      };
    });
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedNewMaterial, setSelectedNewMaterial] = useState<string>(
    rates[0]?.material || 'newspaper_paper'
  );
  const [newWeight, setNewWeight] = useState<number>(5.0);

  // Compute live price range based on current items
  const priceRange = useMemo(() => {
    let low = 0;
    let high = 0;

    for (const item of items) {
      const rate = ratesMap.get(item.material);
      const rLow = rate?.rate_low ?? 0;
      const rHigh = rate?.rate_high ?? 0;
      const userWeight = item.weight_kg_user;

      // Price scales with the household's own weight estimate
      low += userWeight * rLow;
      high += userWeight * rHigh;
    }

    return {
      low: Math.round(low),
      high: Math.round(high),
    };
  }, [items, ratesMap]);

  const handleUpdateWeight = (id: string, weight: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, weight_kg_user: clampKg(weight) } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddItem = () => {
    const newItem: DetectedItem = {
      id: `manual-${Date.now()}`,
      material: selectedNewMaterial,
      weight_kg_low: Number((newWeight * 0.8).toFixed(1)),
      weight_kg_high: Number((newWeight * 1.2).toFixed(1)),
      weight_kg_user: newWeight,
      confidence: 1.0,
      isManual: true,
      note: 'Added manually',
    };
    setItems((prev) => [...prev, newItem]);
    setShowAddModal(false);
  };

  // Check if any item is hazardous
  const hasHazardousItem = useMemo(() => {
    if (analysis.hazards && analysis.hazards.length > 0) return true;
    return items.some((it) => ratesMap.get(it.material)?.hazardous);
  }, [items, ratesMap, analysis.hazards]);

  const labelFor = (m: string) => {
    const r = ratesMap.get(m);
    return (lang === 'hi' ? r?.label_hi : r?.label_en) || m.replace(/_/g, ' ');
  };

  return (
    <Page className="gap-4 pb-28 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-x-10 lg:pt-8">
      <div className="flex flex-col gap-4 lg:sticky lg:top-20">
      {/* Retake alert when photo quality is poor */}
      {!analysis.photo_quality_ok && (
        <Notice tone="warn" title={t.retakePrompt} icon={<TriangleAlert className="h-5 w-5" aria-hidden />}>
          <p>{analysis.retake_reason || t.retakeFallback}</p>
          <button onClick={onRetake} className={`${btnGhost} mt-3 !min-h-11 !px-3 !py-2 text-sm`}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t.retakeAction}
          </button>
        </Notice>
      )}

      {/* Hazard banner */}
      {hasHazardousItem && (
        <Notice tone="error" title={t.hazardBannerTitle} icon={<ShieldAlert className="h-5 w-5 text-brick" aria-hidden />}>
          <p>{t.hazardBannerDesc}</p>
          {analysis.hazards && analysis.hazards.length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {analysis.hazards.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {/* The headline number: a price tag, in range form */}
      <section className="rounded-md border-2 border-ink bg-sun p-4" aria-live="polite">
        <p className="text-base font-semibold">{t.estimatedValue}</p>
        <p className="font-display text-[2.4rem] leading-tight tabular-nums">
          {inr(priceRange.low)} – {inr(priceRange.high)}
        </p>
        <p className="mt-1 text-sm">{t.indicativeNotice}</p>
      </section>

      {previewUrl && (
        <div className="flex items-center gap-3">
          <img
            src={previewUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border-2 border-ink object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">
              {analysis.photo_quality_ok ? t.photoOk : t.photoFlagged}
            </p>
            <p className="text-sm text-muted">
              {items.length} {t.itemsDetected}
            </p>
          </div>
          <button onClick={onRetake} className="flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-bold underline-offset-4 hover:underline">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t.retakeAction}
          </button>
        </div>
      )}

      </div>

      <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl">
          {t.materialsFound} ({items.length})
        </h2>
        <button onClick={() => setShowAddModal(true)} className={`${btnGhost} shrink-0 whitespace-nowrap !min-h-11 !px-3 !py-2 text-sm`}>
          <Plus className="h-4 w-4" aria-hidden />
          {t.addMaterial}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border-2 border-dashed border-ink p-6 text-center">
          <p className="mb-3 text-base">{t.emptyListWarning}</p>
          <button onClick={() => setShowAddModal(true)} className={btnSun}>
            <Plus className="h-5 w-5" aria-hidden />
            {t.addMaterial}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const rate = ratesMap.get(item.material);
            const rLow = rate?.rate_low ?? 0;
            const rHigh = rate?.rate_high ?? 0;
            const isHazard = rate?.hazardous;
            const label = labelFor(item.material);
            const max = niceMax(item.weight_kg_high, item.weight_kg_user);

            return (
              <li
                key={item.id}
                className={`rounded-md border-2 bg-card p-4 ${isHazard ? 'border-brick' : 'border-ink'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold capitalize leading-tight">{label}</h3>
                    <p className="text-sm text-muted">
                      {t.indicativeRateLabel}: ₹{rLow}–₹{rHigh} / {rate?.unit || 'kg'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {isHazard && (
                        <span className="rounded-sm bg-brick px-1.5 text-sm font-bold text-white">
                          {t.hazardBadge}
                        </span>
                      )}
                      {item.isManual && (
                        <span className="rounded-sm border border-ink px-1.5 text-sm font-semibold">
                          {t.manualBadge}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    aria-label={`${t.removeItem}: ${label}`}
                    className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-brick-soft hover:text-brick"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4">
                  <RangeRuler
                    max={max}
                    low={item.weight_kg_low}
                    high={item.weight_kg_high}
                    value={item.weight_kg_user}
                    valueLabel={`${item.weight_kg_user} ${t.kg}`}
                    ariaLabel={`${t.yourWeight}: ${label}`}
                    bandLabel={t.aiRange}
                    onChange={(v) => handleUpdateWeight(item.id, v)}
                  />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      <span className="mr-1.5 inline-block h-3 w-4 border-2 border-ink bg-sun align-middle" aria-hidden />
                      {t.aiRange}: {item.weight_kg_low}–{item.weight_kg_high} {t.kg}
                      {!item.isManual && <> · {t.confidenceShort} {Math.round(item.confidence * 100)}%</>}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => handleUpdateWeight(item.id, item.weight_kg_user - 0.5)}
                        aria-label={`${t.lessWeight}: ${label}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md border-2 border-ink hover:bg-sun-soft"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleUpdateWeight(item.id, item.weight_kg_user + 0.5)}
                        aria-label={`${t.moreWeight}: ${label}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md border-2 border-ink hover:bg-sun-soft"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper">
        <div className="mx-auto max-w-lg p-3 lg:flex lg:max-w-5xl lg:justify-end lg:px-8">
          <button
            disabled={items.length === 0}
            onClick={() => onProceed(items, priceRange)}
            className={`${btnPrimary} lg:!w-auto lg:min-w-[22rem]`}
          >
            <span>{t.proceedToPickup}</span>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      {showAddModal && (
        <Sheet title={t.manualAddTitle} closeLabel={t.cancel} onClose={() => setShowAddModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-material" className="mb-1.5 block text-base font-bold">
                {t.materialLabel}
              </label>
              <select
                id="new-material"
                value={selectedNewMaterial}
                onChange={(e) => setSelectedNewMaterial(e.target.value)}
                className={fieldInput}
              >
                {rates.map((r) => (
                  <option key={r.material} value={r.material}>
                    {lang === 'hi' ? r.label_hi : r.label_en} (₹{r.rate_low}–{r.rate_high}/kg)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-base font-bold">{t.weightLabel}</p>
              <RangeRuler
                max={niceMax(newWeight * 1.2, newWeight)}
                low={newWeight * 0.8}
                high={newWeight * 1.2}
                value={newWeight}
                valueLabel={`${newWeight} ${t.kg}`}
                ariaLabel={t.weightLabel}
                onChange={(v) => setNewWeight(clampKg(v))}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowAddModal(false)} className={`${btnGhost} flex-1`}>
                {t.cancel}
              </button>
              <button type="button" onClick={handleAddItem} className={`${btnSun} flex-1`}>
                {t.add}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Page>
  );
};
