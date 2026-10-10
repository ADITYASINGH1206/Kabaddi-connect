import { useEffect, useState } from 'react';
import { ApiClient } from './api/client';
import { CollectorView } from './components/CollectorView';
import { HouseholdReview } from './components/HouseholdReview';
import { HouseholdSnap } from './components/HouseholdSnap';
import { ImpactDashboard } from './components/ImpactDashboard';
import { LandingRoleSelect } from './components/LandingRoleSelect';
import { MatchedView } from './components/MatchedView';
import { Navbar } from './components/Navbar';
import { PickupDetails } from './components/PickupDetails';
import type {
  CreateListingResponse,
  DetectedItem,
  Language,
  MaterialRate,
  UserRole,
  VisionAnalysisResponse,
} from './types';

export function App() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('kabadi_lang') as Language) || 'en';
  });
  const [role, setRole] = useState<UserRole>(null);
  const [rates, setRates] = useState<MaterialRate[]>([]);
  const [householdStep, setHouseholdStep] = useState<
    'snap' | 'review' | 'pickup_details' | 'matched'
  >('snap');

  // Analysis result state
  const [currentAnalysis, setCurrentAnalysis] = useState<VisionAnalysisResponse | null>(null);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | undefined>(undefined);
  const [confirmedData, setConfirmedData] = useState<{
    items: DetectedItem[];
    priceRange: { low: number; high: number };
  } | null>(null);

  // Created listing response for matched view
  const [createdListing, setCreatedListing] = useState<CreateListingResponse | null>(null);

  // Fetch rates on mount
  useEffect(() => {
    ApiClient.getRates()
      .then((data) => setRates(data))
      .catch((err) => console.error('Rates fetch error:', err));
  }, []);

  const handleToggleLang = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'hi' : 'en';
      localStorage.setItem('kabadi_lang', next);
      return next;
    });
  };

  const handleResetRole = () => {
    setRole(null);
    setHouseholdStep('snap');
    setCurrentAnalysis(null);
    setCurrentPreviewUrl(undefined);
    setConfirmedData(null);
    setCreatedListing(null);
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
    setHouseholdStep('pickup_details');
  };

  const handleListingCreated = (response: CreateListingResponse) => {
    setCreatedListing(response);
    setHouseholdStep('matched');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
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
          <CollectorView lang={lang} onBack={handleResetRole} />
        )}

        {/* Impact Dashboard View */}
        {role === 'impact' && (
          <ImpactDashboard lang={lang} onBack={handleResetRole} />
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

            {householdStep === 'pickup_details' && confirmedData && (
              <PickupDetails
                lang={lang}
                items={confirmedData.items}
                priceRange={confirmedData.priceRange}
                onBack={() => setHouseholdStep('review')}
                onListingCreated={handleListingCreated}
              />
            )}

            {householdStep === 'matched' && createdListing && (
              <MatchedView
                lang={lang}
                initialData={createdListing}
                onReset={() => {
                  setHouseholdStep('snap');
                  setCurrentAnalysis(null);
                  setConfirmedData(null);
                  setCreatedListing(null);
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
