import React from 'react';
import type { Language, UserRole } from '../types';
import { getTranslation } from '../i18n/translations';
import { Camera, Truck, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

interface LandingRoleSelectProps {
  lang: Language;
  onSelectRole: (role: UserRole) => void;
}

export const LandingRoleSelect: React.FC<LandingRoleSelectProps> = ({
  lang,
  onSelectRole,
}) => {
  const t = getTranslation(lang);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8 max-w-lg mx-auto w-full">
      {/* Hero Badge */}
      <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-6 animate-pulse">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Amazon Bedrock Multimodal Vision</span>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl mb-3">
          {t.appTitle}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          {t.tagline}
        </p>
      </div>

      <div className="w-full space-y-4">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 text-center mb-2">
          {t.rolePrompt}
        </p>

        {/* Role 1: Household / Seller */}
        <button
          onClick={() => onSelectRole('household')}
          className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/80 hover:border-emerald-500/60 shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 active:scale-[0.99] group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
              <Camera className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              Start <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
            {t.roleHousehold}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t.roleHouseholdSub}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5 shrink-0" />
            <span>AI instant price range &bull; Transparent cash on pickup</span>
          </div>
        </button>

        {/* Role 2: Collector */}
        <button
          onClick={() => onSelectRole('collector')}
          className="w-full text-left p-5 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/80 hover:border-teal-500/60 shadow-xl hover:shadow-teal-500/10 transition-all duration-200 active:scale-[0.99] group cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 group-hover:scale-105 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center text-xs font-semibold text-teal-400 group-hover:translate-x-0.5 transition-transform">
              Login Demo <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </span>
          </div>

          <h3 className="text-lg font-bold text-white mb-1 group-hover:text-teal-400 transition-colors">
            {t.roleCollector}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t.roleCollectorSub}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400 mr-1.5 shrink-0" />
            <span>Geo-clustered pickups &bull; Waypoint route optimizer</span>
          </div>
        </button>

        {/* Role 3: Public Impact Dashboard */}
        <button
          onClick={() => onSelectRole('impact')}
          className="w-full text-left p-4 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-800/20 border border-slate-700/60 hover:border-sky-500/60 shadow-lg hover:shadow-sky-500/10 transition-all duration-200 active:scale-[0.99] group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                  {t.roleImpact}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {t.roleImpactSub}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
          </div>
        </button>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500 px-4">
        {t.indicativeNotice}
      </div>
    </div>
  );
};
