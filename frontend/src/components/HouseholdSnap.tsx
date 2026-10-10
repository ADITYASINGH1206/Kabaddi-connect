import React, { useRef, useState } from 'react';
import type { Language, VisionAnalysisResponse } from '../types';
import { getTranslation } from '../i18n/translations';
import { resizeImageForUpload } from '../utils/image';
import { ApiClient } from '../api/client';
import { Camera, Loader2, PencilLine } from 'lucide-react';
import { btnGhost, btnSun, Notice, Page } from './ui';

interface HouseholdSnapProps {
  lang: Language;
  onAnalysisComplete: (result: {
    analysis: VisionAnalysisResponse;
    previewUrl: string;
    imageKey: string;
  }) => void;
  onManualEntry: () => void;
}

export const HouseholdSnap: React.FC<HouseholdSnapProps> = ({
  lang,
  onAnalysisComplete,
  onManualEntry,
}) => {
  const t = getTranslation(lang);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Step 1: Client-side resize to 1280px JPEG ~0.8
      setLoadingStep(t.uploadingPhoto);
      const resized = await resizeImageForUpload(file, 1280, 0.8);
      setSelectedPreview(resized.previewUrl);

      // Step 2: Get presigned upload URL
      let imageKey = `uploads/demo-${Date.now()}.jpg`;
      try {
        const uploadData = await ApiClient.getUploadUrl('image/jpeg');
        imageKey = uploadData.imageKey;

        // Step 3: Upload binary JPEG to S3
        await ApiClient.uploadImageToS3(uploadData.uploadUrl, resized.blob);
      } catch (uploadErr) {
        console.warn('Direct S3 upload skipped or errored, proceeding to analyze/fallback:', uploadErr);
      }

      // Step 4: Call Bedrock Converse Vision analyze
      setLoadingStep(t.analyzingScrap);
      try {
        const analysis = await ApiClient.analyzeImage(imageKey, lang);
        onAnalysisComplete({
          analysis,
          previewUrl: resized.previewUrl,
          imageKey,
        });
      } catch (analyzeErr) {
        console.warn('Vision analyze call returned error, applying graceful fallback:', analyzeErr);
        // Graceful fallback with NO fake scrap items - user can manually add or retake
        const fallbackAnalysis: VisionAnalysisResponse = {
          photo_quality_ok: false,
          retake_reason: t.fallbackRetake,
          items: [],
          hazards: [],
          fallback: true,
          fallback_message: t.fallbackRetake,
        };
        onAnalysisComplete({
          analysis: fallbackAnalysis,
          previewUrl: resized.previewUrl,
          imageKey,
        });
      }
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(t.uploadFailed);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
      // allow choosing the same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Page className="gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-14 lg:pt-10">
      <div className="lg:col-start-1">
        <h1 className="font-display text-3xl leading-tight lg:text-4xl">{t.snapTitle}</h1>
        <p className="mt-1.5 text-base text-muted">{t.snapSubtitle}</p>
      </div>

      {/* Viewfinder: corner brackets, like a camera frame */}
      <div className="relative aspect-[4/3] w-full lg:col-start-2 lg:row-span-3 lg:row-start-1 overflow-hidden rounded-md border-2 border-ink bg-white">
        {selectedPreview ? (
          <img src={selectedPreview} alt={t.previewAlt} className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center hover:bg-sun-soft"
          >
            <Camera className="h-14 w-14" aria-hidden />
            <span className="text-lg font-bold">{t.snapHint}</span>
            <span className="text-sm text-muted">{t.snapDropHint}</span>
          </button>
        )}
        {(['left-2 top-2 border-l-4 border-t-4', 'right-2 top-2 border-r-4 border-t-4', 'bottom-2 left-2 border-b-4 border-l-4', 'bottom-2 right-2 border-b-4 border-r-4'] as const).map(
          (c) => (
            <span key={c} aria-hidden className={`pointer-events-none absolute h-7 w-7 border-ink ${c}`} />
          )
        )}
        {isLoading && (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/85 p-6 text-center text-white"
          >
            <Loader2 className="h-9 w-9 animate-spin text-sun" aria-hidden />
            <p className="text-lg font-bold">{loadingStep}</p>
            <p className="text-sm text-white/80">{t.analyzingHint}</p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="lg:col-start-1">
          <Notice tone="error">{errorMessage}</Notice>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />

      <div className="mt-auto flex flex-col gap-3 lg:col-start-1 lg:mt-0">
        <button disabled={isLoading} onClick={() => fileInputRef.current?.click()} className={btnSun}>
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span>{loadingStep}</span>
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" aria-hidden />
              <span>{t.takePhoto}</span>
            </>
          )}
        </button>
        <button type="button" disabled={isLoading} onClick={onManualEntry} className={btnGhost}>
          <PencilLine className="h-5 w-5" aria-hidden />
          <span>{t.snapManual}</span>
        </button>
      </div>
    </Page>
  );
};
