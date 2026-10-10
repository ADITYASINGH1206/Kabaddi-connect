import React from 'react';
import type { Language, UserRole } from '../types';
import { getTranslation } from '../i18n/translations';
import { ArrowLeft } from 'lucide-react';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  role: UserRole;
  onResetRole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ lang, onToggleLang, role, onResetRole }) => {
  const t = getTranslation(lang);

  return (
    <header className="sticky top-0 z-40 border-b-4 border-sun bg-ink text-white">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 items-center">
          {role && (
            <button
              onClick={onResetRole}
              aria-label={t.back}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-ink-2"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <button
            onClick={onResetRole}
            className={`min-h-11 truncate rounded-md font-display text-2xl leading-none hover:text-sun ${
              role ? 'px-1' : 'px-2'
            }`}
          >
            {t.appTitle}
          </button>
        </div>

        <button
          onClick={onToggleLang}
          aria-label={t.switchLang}
          className="min-h-11 rounded-md border-2 border-white/60 px-3.5 text-base font-bold hover:border-sun hover:text-sun"
        >
          {lang === 'en' ? 'हिन्दी' : 'English'}
        </button>
      </div>
    </header>
  );
};
