import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type { ImpactStats, Language } from '../types';
import {
  BarChart3,
  DollarSign,
  Fuel,
  Info,
  Leaf,
  Loader2,
  RefreshCw,
  Scale,
  Smartphone,
} from 'lucide-react';

interface ImpactDashboardProps {
  lang: Language;
  onBack: () => void;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({ lang, onBack }) => {
  const t = getTranslation(lang);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchImpact = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.getImpact();
      setStats(data);
    } catch (err) {
      console.error('Failed to load impact stats:', err);
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

  const maxKg = sortedMaterials.length > 0 ? sortedMaterials[0][1] : 1;

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-400" />
            {t.impactTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.impactSubtitle}</p>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {t.back}
        </button>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
          <span className="text-xs">Aggregating real-time impact metrics...</span>
        </div>
      ) : stats ? (
        <div className="w-full space-y-4">
          {/* Headline 4-Grid Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1. Kg Diverted */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t.totalKgDiverted}
                </span>
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-2xl font-black text-white">
                  {stats.total_kg_diverted.toLocaleString()}
                </span>
                <span className="text-xs text-emerald-400 font-bold ml-1">kg</span>
              </div>
            </div>

            {/* 2. Income Facilitated */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t.incomeFacilitated}
                </span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-2xl font-black text-amber-400">
                  ₹{stats.collector_income_facilitated_inr.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 3. CO2e Avoided */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t.co2eAvoided}
                </span>
                <Leaf className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <span className="text-2xl font-black text-teal-300">
                  {stats.co2e_avoided_kg.toLocaleString()}
                </span>
                <span className="text-xs text-teal-400 font-bold ml-1">kg CO₂e</span>
              </div>
            </div>

            {/* 4. Km / Trips Saved */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {t.tripsSavedCount}
                </span>
                <Fuel className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <span className="text-2xl font-black text-sky-300">
                  {stats.km_saved}
                </span>
                <span className="text-xs text-sky-400 font-bold ml-1">km saved</span>
                {stats.km_saved_is_demo_baseline && (
                  <span className="block text-[10px] text-slate-500 mt-0.5">{t.demoBaselineTag}</span>
                )}
              </div>
            </div>
          </div>

          {/* Model Accuracy & Redirected E-Waste Card */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                {t.modelAccuracyTitle}
              </span>
              <span className="text-lg font-extrabold text-white mt-1 block">
                {stats.weight_estimation_mape_pct != null
                  ? `${stats.weight_estimation_mape_pct}%`
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-400">
                {stats.weight_estimation_mape_pct != null
                  ? `${t.accuracyLiveOnly} (${stats.weight_estimation_sample_size ?? 0})`
                  : t.accuracyNoData}
              </span>
            </div>

            <div className="border-l border-slate-700/70 pl-4">
              <span className="text-[11px] text-slate-400 block font-semibold uppercase tracking-wider">
                E-Waste Redirected
              </span>
              <span className="text-lg font-extrabold text-emerald-400 mt-1 block flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                {stats.ewaste_items_redirected} items
              </span>
              <span className="text-[10px] text-slate-400">Kept out of landfills</span>
            </div>
          </div>

          {/* Plain SVG Bar Chart of Materials Diverted */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg">
            <h3 className="text-xs uppercase font-bold tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              {t.materialBreakdownTitle}
            </h3>

            <div className="space-y-3">
              {sortedMaterials.map(([mat, kg]) => {
                const pct = Math.max(8, Math.round((kg / maxKg) * 100));
                return (
                  <div key={mat} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white capitalize">
                        {mat.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-emerald-400">{kg} kg</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footnote / Demo Baseline Label */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{t.includesDemoData}</span>
            </div>
            <p className="leading-relaxed">
              {stats.emissionSource} — {t.co2Footnote}
            </p>
          </div>

          <button
            onClick={fetchImpact}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Impact Metrics
          </button>
        </div>
      ) : null}
    </div>
  );
};
