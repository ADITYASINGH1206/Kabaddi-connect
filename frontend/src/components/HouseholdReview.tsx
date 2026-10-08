import React, { useMemo, useState } from 'react';
import type {
  DetectedItem,
  Language,
  MaterialRate,
  VisionAnalysisResponse,
} from '../types';
import { getTranslation } from '../i18n/translations';
import {
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Info,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface HouseholdReviewProps {
  lang: Language;
  analysis: VisionAnalysisResponse;
  rates: MaterialRate[];
  previewUrl?: string;
  onRetake: () => void;
  onProceed: (confirmedItems: DetectedItem[], priceRange: { low: number; high: number }) => void;
}

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

      // Price scales with user's slider estimate
      low += userWeight * rLow;
      high += userWeight * rHigh;
    }

    return {
      low: Math.round(low),
      high: Math.round(high),
    };
  }, [items, ratesMap]);

  const handleUpdateWeight = (id: string, newWeight: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, weight_kg_user: newWeight } : it))
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] px-4 py-4 max-w-lg mx-auto w-full pb-24">
      {/* Retake Alert when photo quality is poor */}
      {!analysis.photo_quality_ok && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-300">
                {t.retakePrompt}
              </h4>
              <p className="text-xs text-amber-200/90 mt-1">
                {analysis.retake_reason ||
                  'The image was too blurry or dim for clear AI recognition.'}
              </p>
              <button
                onClick={onRetake}
                className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.retakeAction}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hazard Banner */}
      {hasHazardousItem && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 shadow-lg shadow-rose-950/30">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-rose-300">
                {t.hazardBannerTitle}
              </h4>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">
                {t.hazardBannerDesc}
              </p>
              {analysis.hazards && analysis.hazards.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-[11px] text-rose-300 space-y-0.5">
                  {analysis.hazards.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Thumbnail if available */}
      {previewUrl && (
        <div className="mb-4 flex items-center space-x-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
          <img
            src={previewUrl}
            alt="Scrap item thumbnail"
            className="w-14 h-14 rounded-xl object-cover border border-slate-700"
          />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-white block truncate">
              {analysis.photo_quality_ok ? 'Scrap Photo Verified' : 'Photo Flagged'}
            </span>
            <span className="text-[11px] text-slate-400 block truncate">
              {items.length} items detected • Click retake if inaccurate
            </span>
          </div>
          <button
            onClick={onRetake}
            className="p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 text-xs flex items-center space-x-1"
            title="Retake photo"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero: Estimated Total Price Band */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-xl mb-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{t.estimatedValue}</span>
          <span className="inline-flex items-center text-emerald-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Live Bedrock Rates
          </span>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            ₹{priceRange.low.toLocaleString('en-IN')} – ₹{priceRange.high.toLocaleString('en-IN')}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mt-2 flex items-center">
          <Info className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {t.indicativeNotice}
        </p>
      </div>

      {/* Materials List Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-white">
          {t.materialsFound} ({items.length})
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 py-1 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addMaterial}</span>
        </button>
      </div>

      {/* Material Cards */}
      {items.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-800 text-slate-400 text-xs">
          <p className="mb-3">{t.emptyListWarning}</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
          >
            {t.addMaterial}
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {items.map((item) => {
            const rate = ratesMap.get(item.material);
            const label =
              lang === 'hi'
                ? rate?.label_hi || item.material
                : rate?.label_en || item.material;
            const rLow = rate?.rate_low ?? 0;
            const rHigh = rate?.rate_high ?? 0;
            const isHazard = rate?.hazardous;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isHazard
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-slate-800/80 border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-white capitalize">
                        {label}
                      </h4>
                      {isHazard && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                          Hazardous
                        </span>
                      )}
                      {item.isManual && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-300">
                          Manual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.indicativeRateLabel}: ₹{rLow} - ₹{rHigh} / {rate?.unit || 'kg'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Weight Adjustment Slider */}
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-slate-300 font-medium">
                      {t.sliderLabel}
                    </span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      {item.weight_kg_user} kg
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.5"
                    max="50"
                    step="0.5"
                    value={item.weight_kg_user}
                    onChange={(e) =>
                      handleUpdateWeight(item.id, parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0.5 kg</span>
                    <span>Confidence: {Math.round(item.confidence * 100)}%</span>
                    <span>50 kg</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button: Proceed */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 max-w-lg mx-auto">
        <button
          disabled={items.length === 0}
          onClick={() => onProceed(items, priceRange)}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-40 cursor-pointer"
        >
          <span>{t.proceedToPickup}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Manual Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-800 border border-slate-700 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">
              {t.manualAddTitle}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Material
                </label>
                <select
                  value={selectedNewMaterial}
                  onChange={(e) => setSelectedNewMaterial(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-500 outline-none"
                >
                  {rates.map((r) => (
                    <option key={r.material} value={r.material}>
                      {lang === 'hi' ? r.label_hi : r.label_en} (₹{r.rate_low}-{r.rate_high}/kg)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Estimated Weight (kg): {newWeight} kg
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                >
                  {t.add}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
