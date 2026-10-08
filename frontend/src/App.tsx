import { useEffect, useState } from 'react';
import { ApiClient } from './api/client';
import { CollectorStub } from './components/CollectorStub';
import { HouseholdReview } from './components/HouseholdReview';
import { HouseholdSnap } from './components/HouseholdSnap';
import { LandingRoleSelect } from './components/LandingRoleSelect';
import { Navbar } from './components/Navbar';
import { getTranslation } from './i18n/translations';
import type {
  DetectedItem,
  Language,
  MaterialRate,
  UserRole,
  VisionAnalysisResponse,
} from './types';
import { CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';

export function App() {
  const [lang, setLang] = useState<Language>('en');
  const [role, setRole] = useState<UserRole>(null);
  const [rates, setRates] = useState<MaterialRate[]>([]);
  const [householdStep, setHouseholdStep] = useState<'snap' | 'review' | 'proceed_confirmed'>('snap');

  // Analysis result state
  const [currentAnalysis, setCurrentAnalysis] = useState<VisionAnalysisResponse | null>(null);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | undefined>(undefined);
  const [confirmedData, setConfirmedData] = useState<{
    items: DetectedItem[];
    priceRange: { low: number; high: number };
  } | null>(null);

  // Fetch rates on mount
  useEffect(() => {
    ApiClient.getRates()
      .then((data) => setRates(data))
      .catch((err) => console.error('Rates fetch error:', err));
  }, []);

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'hi' : 'en'));
  };

  const handleResetRole = () => {
    setRole(null);
    setHouseholdStep('snap');
    setCurrentAnalysis(null);
    setCurrentPreviewUrl(undefined);
    setConfirmedData(null);
  };

  const handleAnalysisComplete = (result: {
    analysis: VisionAnalysisResponse;
    previewUrl: string;
    imageKey: string;
  }) => {
    setCurrentAnalysis(result.analysis);
    setCurrentPreviewUrl(result.previewUrl);
    setHouseholdStep('review');
  };

  const handleManualEntry = () => {
    const fallbackAnalysis: VisionAnalysisResponse = {
      photo_quality_ok: true,
      retake_reason: null,
      items: [
        { material: 'newspaper_paper', weight_kg_low: 5.0, weight_kg_high: 8.0, confidence: 1.0 },
      ],
      hazards: [],
      fallback: true,
      fallback_message: 'Manual entry mode.',
    };
    setCurrentAnalysis(fallbackAnalysis);
    setCurrentPreviewUrl(undefined);
    setHouseholdStep('review');
  };

  const handleProceedToPickup = (
    items: DetectedItem[],
    priceRange: { low: number; high: number }
  ) => {
    setConfirmedData({ items, priceRange });
    setHouseholdStep('proceed_confirmed');
  };

  const t = getTranslation(lang);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navbar
        lang={lang}
        onToggleLang={handleToggleLang}
        role={role}
        onResetRole={handleResetRole}
      />

      <main className="flex-1 flex flex-col">
        {/* Landing Screen: Role Selector */}
        {!role && (
          <LandingRoleSelect
            lang={lang}
            onSelectRole={(selectedRole) => setRole(selectedRole)}
          />
        )}

        {/* Collector View */}
        {role === 'collector' && (
          <CollectorStub lang={lang} onBack={handleResetRole} />
        )}

        {/* Household View */}
        {role === 'household' && (
          <>
            {householdStep === 'snap' && (
              <HouseholdSnap
                lang={lang}
                onAnalysisComplete={handleAnalysisComplete}
                onManualEntry={handleManualEntry}
              />
            )}

            {householdStep === 'review' && currentAnalysis && (
              <HouseholdReview
                lang={lang}
                analysis={currentAnalysis}
                rates={rates}
                previewUrl={currentPreviewUrl}
                onRetake={() => setHouseholdStep('snap')}
                onProceed={handleProceedToPickup}
              />
            )}

            {householdStep === 'proceed_confirmed' && confirmedData && (
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8 max-w-lg mx-auto w-full text-center">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>M1 Vision & Valuation Complete</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  {lang === 'hi' ? 'कबाड़ का विवरण दर्ज हुआ' : 'Estimate Confirmed'}
                </h2>
                <p className="text-sm text-slate-400 mb-6 max-w-sm">
                  {lang === 'hi'
                    ? `कुल अनुमानित मूल्य: ₹${confirmedData.priceRange.low} – ₹${confirmedData.priceRange.high} (${confirmedData.items.length} सामग्रियां)`
                    : `Estimated Payout: ₹${confirmedData.priceRange.low} – ₹${confirmedData.priceRange.high} across ${confirmedData.items.length} materials.`}
                </p>

                <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-left mb-6 max-h-60 overflow-y-auto">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">
                    Summary of items
                  </p>
                  <div className="space-y-2">
                    {confirmedData.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-xs py-1 border-b border-slate-700/40 last:border-0"
                      >
                        <span className="font-semibold text-white capitalize">
                          {item.material.replace(/_/g, ' ')}
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {item.weight_kg_user} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 text-xs text-slate-400 mb-6">
                  {lang === 'hi'
                    ? 'M2 में यह जानकारी पास के कबाड़ी भाइयों को पिकअप अनुरोध के रूप में भेजी जाएगी।'
                    : 'Ready for M2: Next milestone will geocode your address and match the top 3 collectors.'}
                </div>

                <button
                  onClick={() => setHouseholdStep('review')}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.back} to Review</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
