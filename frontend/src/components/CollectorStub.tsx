import React from 'react';
import type { Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { Truck, MapPin, Route, CheckCircle2 } from 'lucide-react';

interface CollectorStubProps {
  lang: Language;
  onBack: () => void;
}

export const CollectorStub: React.FC<CollectorStubProps> = ({
  lang,
  onBack,
}) => {
  const t = getTranslation(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8 max-w-lg mx-auto w-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-6">
        <Truck className="w-8 h-8" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2">
        {lang === 'hi' ? 'कबाड़ी पोर्टल (प्रोटोटाइप)' : 'Collector Partner Portal'}
      </h2>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        {lang === 'hi'
          ? 'M0 और M1 विज़न और सामग्री मूल्य निर्धारण पर केंद्रित हैं। M2 और M3 में पिकअप मिलान और मैप रूटिंग सक्रिय होगी।'
          : 'Milestones M0 & M1 focus on AI scrap vision and fair price estimation. Pickup route calculation and live requests activate in M2 & M3.'}
      </p>

      <div className="w-full space-y-3 max-w-sm text-left mb-8">
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white block">M0 & M1 Complete</span>
            <span className="text-slate-400">Bedrock vision analysis, photo upload, live rates</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center space-x-3 text-slate-500">
          <MapPin className="w-5 h-5 text-slate-600 shrink-0" />
          <div className="text-xs">
            <span className="font-medium text-slate-400 block">Upcoming: M2 Matching</span>
            <span className="text-slate-500">Geo-scoring and matching nearest collectors</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center space-x-3 text-slate-500">
          <Route className="w-5 h-5 text-slate-600 shrink-0" />
          <div className="text-xs">
            <span className="font-medium text-slate-400 block">Upcoming: M3 Route Optimization</span>
            <span className="text-slate-500">Amazon Location Service waypoint ordering</span>
          </div>
        </div>
      </div>

      <button
        onClick={onBack}
        className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
      >
        {t.back}
      </button>
    </div>
  );
};
