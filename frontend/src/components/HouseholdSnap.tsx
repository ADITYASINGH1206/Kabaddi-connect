import React, { useRef, useState } from 'react';
import type { Language, VisionAnalysisResponse } from '../types';
import { getTranslation } from '../i18n/translations';
import { resizeImageForUpload } from '../utils/image';
import { ApiClient } from '../api/client';
import { Camera, Upload, AlertCircle, Loader2, Sparkles } from 'lucide-react';

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
        // Graceful fallback per section 0 rule 3
        const fallbackAnalysis: VisionAnalysisResponse = {
          photo_quality_ok: true,
          retake_reason: null,
          items: [
            { material: 'newspaper_paper', weight_kg_low: 5.0, weight_kg_high: 8.0, confidence: 0.9 },
            { material: 'cardboard', weight_kg_low: 2.0, weight_kg_high: 4.0, confidence: 0.85 }
          ],
          hazards: [],
          fallback: true,
          fallback_message: 'Vision assistant in demo mode. You can edit or add items below.'
        };
        onAnalysisComplete({
          analysis: fallbackAnalysis,
          previewUrl: resized.previewUrl,
          imageKey,
        });
      }
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(err.message || 'Could not process image. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-80px)] px-4 py-6 max-w-lg mx-auto w-full">
      <div className="w-full text-center mt-2">
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
          {t.snapTitle}
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm px-4">
          {t.snapSubtitle}
        </p>
      </div>

      {/* Main Snap Target / Viewfinder */}
      <div className="w-full my-6 flex flex-col items-center">
        {selectedPreview ? (
          <div className="relative w-full aspect-square max-w-sm rounded-3xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10">
            <img
              src={selectedPreview}
              alt="Scrap Preview"
              className="w-full h-full object-cover"
            />
            {isLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
                <p className="text-sm font-bold text-white mb-1">
                  {loadingStep}
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  {t.analyzingHint}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square max-w-sm rounded-3xl border-2 border-dashed border-slate-700 bg-slate-800/40 hover:border-emerald-500/60 hover:bg-slate-800/70 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center group"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Camera className="w-10 h-10" />
            </div>
            <p className="text-base font-semibold text-white mb-1">
              {t.takePhoto}
            </p>
            <p className="text-xs text-slate-400 max-w-xs">
              Take a live photo or upload from gallery (Auto-resized to 1280px)
            </p>

            <div className="mt-4 flex items-center space-x-2 text-[11px] text-emerald-400/90 font-medium bg-emerald-950/40 px-3 py-1.5 rounded-full border border-emerald-800/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Instant AI Identification</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 w-full p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3 pb-2">
        <button
          disabled={isLoading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.99] flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{loadingStep || 'Processing...'}</span>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" />
              <span>{t.takePhoto}</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={onManualEntry}
          className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-semibold transition-all active:scale-[0.99] flex items-center justify-center space-x-1.5"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>No camera? Enter materials manually</span>
        </button>
      </div>
    </div>
  );
};
