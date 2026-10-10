import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type {
  CreateListingResponse,
  Language,
  ListingDetailsResponse,
} from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
  Truck,
  UserCheck,
} from 'lucide-react';

interface MatchedViewProps {
  lang: Language;
  initialData: CreateListingResponse;
  onReset: () => void;
}

export const MatchedView: React.FC<MatchedViewProps> = ({
  lang,
  initialData,
  onReset,
}) => {
  const t = getTranslation(lang);
  const [listing, setListing] = useState<ListingDetailsResponse | null>(null);
  const [status, setStatus] = useState<'OPEN' | 'ACCEPTED' | 'COMPLETED'>(
    initialData.status as any || 'OPEN'
  );
  const [polling, setPolling] = useState(true);

  // Poll listing details every 5 seconds until ACCEPTED / COMPLETED
  useEffect(() => {
    let intervalId: any = null;

    const fetchStatus = async () => {
      try {
        const details = await ApiClient.getListing(initialData.listingId);
        setListing(details);
        if (details.status) {
          setStatus(details.status as any);
        }
        if (details.status === 'COMPLETED') {
          setPolling(false);
        }
      } catch (err) {
        console.warn('Polling error for listing:', err);
      }
    };

    // Immediate initial fetch
    fetchStatus();

    if (polling) {
      intervalId = setInterval(fetchStatus, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [initialData.listingId, polling]);

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 max-w-lg mx-auto w-full">
      {/* Top Status Card */}
      <div
        className={`w-full rounded-2xl p-5 mb-5 border text-center transition-all ${
          status === 'ACCEPTED'
            ? 'bg-emerald-950/40 border-emerald-500/50 shadow-xl shadow-emerald-500/10'
            : status === 'COMPLETED'
            ? 'bg-blue-950/40 border-blue-500/50 shadow-xl shadow-blue-500/10'
            : 'bg-slate-800/80 border-slate-700/80 shadow-lg'
        }`}
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 mx-auto transition-transform">
          {status === 'ACCEPTED' ? (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-pulse">
              <Truck className="w-8 h-8" />
            </div>
          ) : status === 'COMPLETED' ? (
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-8 h-8 animate-spin-slow" />
            </div>
          )}
        </div>

        <span className="text-[11px] font-mono text-slate-400 block mb-1">
          {t.listingIdLabel}: {initialData.listingId}
        </span>

        <h2 className="text-xl font-bold text-white mb-1">
          {status === 'ACCEPTED'
            ? t.statusAccepted
            : status === 'COMPLETED'
            ? t.statusCompleted
            : t.statusOpen}
        </h2>

        <p className="text-xs text-slate-400">
          {status === 'OPEN' ? t.pollingNotice : t.indicativeNotice}
        </p>

        {/* Accepted Collector Details Card */}
        {status === 'ACCEPTED' && listing?.acceptedCollector && (
          <div className="mt-4 pt-4 border-t border-emerald-500/30 text-left bg-emerald-900/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                {listing.acceptedCollector.name}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                ETA: ~{listing.acceptedCollector.etaMin} mins
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-400 block">{t.collectorDistance}:</span>
                <span className="font-semibold">{listing.acceptedCollector.distanceKm} km</span>
              </div>
              <div>
                <span className="text-slate-400 block">{t.collectorPhone}:</span>
                <a
                  href={`tel:${listing.acceptedCollector.phone}`}
                  className="font-bold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  {listing.acceptedCollector.phone}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Hint Notice (if low value cluster opportunity) */}
      {initialData.batchHint && (
        <div className="w-full bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 mb-4 text-xs text-indigo-200 shadow-md">
          <div className="flex items-center gap-2 font-bold text-indigo-300 mb-1">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>{t.batchHintTitle}</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            {lang === 'hi'
              ? initialData.batchHint.message_hi
              : initialData.batchHint.message_en}
          </p>
        </div>
      )}

      {/* Drop-off points for hazardous/battery items */}
      {initialData.dropOff && initialData.dropOff.length > 0 && (
        <div className="w-full bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 mb-4 text-xs text-rose-200 shadow-md">
          <div className="flex items-center gap-2 font-bold text-rose-300 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{t.dropOffTitle}</span>
          </div>
          <p className="text-slate-300 mb-3 leading-relaxed">
            {t.dropOffNotice}
          </p>
          <div className="space-y-2">
            {initialData.dropOff.map((dp) => (
              <div
                key={dp.id}
                className="bg-slate-900/60 border border-rose-500/20 rounded-xl p-2.5 text-[11px]"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white">{dp.name}</span>
                  {!dp.verified && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                      {dp.note || 'UNVERIFIED'}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {dp.address}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Matched Collectors List */}
      <div className="w-full mb-6">
        <h3 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          {t.topMatchesTitle} ({initialData.matches?.length || 0})
        </h3>

        <div className="space-y-2.5">
          {initialData.matches && initialData.matches.length > 0 ? (
            initialData.matches.map((c, idx) => (
              <div
                key={c.collectorId}
                className="w-full bg-slate-800/70 border border-slate-700/70 rounded-2xl p-3.5 flex justify-between items-center shadow-md hover:border-slate-600 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      #{idx + 1} {c.name}
                    </span>
                    {c.accepts_ewaste && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                        E-Waste
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {c.areaName}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-extrabold text-emerald-400 block">
                    ~{c.distanceKm} km
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    ETA: ~{c.etaMin} mins
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center text-xs text-slate-400">
              No matching collectors active within range.
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onReset}
        className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {t.newRequest}
      </button>
    </div>
  );
};
