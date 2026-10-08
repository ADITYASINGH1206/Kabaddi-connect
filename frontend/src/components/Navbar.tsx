import React from 'react';
import type { Language, UserRole } from '../types';
import { getTranslation } from '../i18n/translations';
import { ArrowLeft, Globe, Recycle } from 'lucide-react';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  role: UserRole;
  onResetRole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  onToggleLang,
  role,
  onResetRole,
}) => {
  const t = getTranslation(lang);

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {role && (
          <button
            onClick={onResetRole}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={t.back}
            aria-label={t.back}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={onResetRole}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Recycle className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white m-0 p-0 leading-tight">
              {t.appTitle}
            </h1>
            <p className="text-[11px] text-emerald-400 font-medium m-0 p-0 leading-tight">
              AWS Clean Tech Demo
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-emerald-500/50 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700/80 active:scale-95"
          aria-label="Switch Language"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
        </button>
      </div>
    </header>
  );
};
