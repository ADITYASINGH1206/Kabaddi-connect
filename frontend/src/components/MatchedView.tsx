import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type {
  CreateListingResponse,
  Language,
  ListingDetailsResponse,
} from '../types';
import { CheckCircle2, Clock, Layers, MapPin, Phone, RefreshCw, ShieldAlert, Truck } from 'lucide-react';
import { btnGhost, Notice, Page } from './ui';

interface MatchedViewProps {
  lang: Language;
  initialData: CreateListingResponse;
  onReset: () => void;
}

export const MatchedView: React.FC<MatchedViewProps> = ({ lang, initialData, onReset }) => {
  const t = getTranslation(lang);
  const [listing, setListing] = useState<ListingDetailsResponse | null>(null);
  const [status, setStatus] = useState<'OPEN' | 'ACCEPTED' | 'COMPLETED'>(
    (initialData.status as any) || 'OPEN'
  );
  const [polling, setPolling] = useState(true);

  // Poll listing details every 5 seconds until COMPLETED
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

  const tone =
    status === 'ACCEPTED'
      ? 'border-leaf bg-leaf-soft'
      : status === 'COMPLETED'
      ? 'border-ink bg-white'
      : 'border-ink bg-sun-soft';

  const accepted = status === 'ACCEPTED' ? listing?.acceptedCollector : undefined;

  return (
    <Page className="gap-5">
      {/* Status */}
      <section className={`rounded-md border-2 p-5 ${tone}`} aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="mt-1 shrink-0">
            {status === 'ACCEPTED' ? (
              <Truck className="h-9 w-9 text-leaf" aria-hidden />
            ) : status === 'COMPLETED' ? (
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            ) : (
              <Clock className="h-9 w-9" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight">
              {status === 'ACCEPTED'
                ? t.statusAccepted
                : status === 'COMPLETED'
                ? t.statusCompleted
                : t.statusOpen}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {status === 'OPEN' ? t.pollingNotice : t.indicativeNotice}
            </p>
            <p className="mt-2 break-all text-sm text-muted">
              {t.listingIdLabel}: <span className="font-semibold text-ink">{initialData.listingId}</span>
            </p>
          </div>
        </div>

        {accepted && (
          <div className="mt-4 border-t-2 border-leaf pt-4">
            <p className="text-sm font-semibold text-leaf">{t.acceptedBanner}</p>
            <p className="font-display text-2xl leading-tight">{accepted.name}</p>
            <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-muted">{t.collectorEta}</dt>
                <dd className="text-lg font-bold">
                  ~{accepted.etaMin} {t.minutes}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t.collectorDistance}</dt>
                <dd className="text-lg font-bold">{accepted.distanceKm} km</dd>
              </div>
              <div className="flex items-end">
                <a
                  href={`tel:${accepted.phone}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border-2 border-ink bg-ink px-3 text-sm font-bold text-white"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {t.callCollector}
                </a>
              </div>
            </dl>
          </div>
        )}
      </section>

      {/* Batch hint */}
      {initialData.batchHint && (
        <Notice tone="info" title={t.batchHintTitle} icon={<Layers className="h-5 w-5" aria-hidden />}>
          <p>
            {lang === 'hi' ? initialData.batchHint.message_hi : initialData.batchHint.message_en}
          </p>
        </Notice>
      )}

      {/* Drop-off points for hazardous items */}
      {initialData.dropOff && initialData.dropOff.length > 0 && (
        <Notice tone="error" title={t.dropOffTitle} icon={<ShieldAlert className="h-5 w-5 text-brick" aria-hidden />}>
          <p>{t.dropOffNotice}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {initialData.dropOff.map((dp) => (
              <li key={dp.id} className="rounded-md border-2 border-ink bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold">{dp.name}</span>
                  {!dp.verified && (
                    <span className="rounded-sm bg-sun px-1.5 text-sm font-bold">
                      {dp.note || t.unverified}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-start gap-1 text-sm text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {dp.address}
                </p>
              </li>
            ))}
          </ul>
        </Notice>
      )}

      {/* Matched collectors */}
      <section>
        <h2 className="mb-2 font-display text-2xl">
          {t.topMatchesTitle} ({initialData.matches?.length || 0})
        </h2>
        {initialData.matches && initialData.matches.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {initialData.matches.map((c, idx) => (
              <li
                key={c.collectorId}
                className="flex items-center justify-between gap-3 rounded-md border-2 border-line bg-white p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight">
                    {idx + 1}. {c.name}
                    {c.accepts_ewaste && (
                      <span className="ml-2 rounded-sm bg-leaf-soft px-1.5 text-sm font-semibold text-leaf">
                        {t.ewasteBadge}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">{c.areaName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums">~{c.distanceKm} km</p>
                  <p className="text-sm text-muted">
                    ~{c.etaMin} {t.minutes}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border-2 border-dashed border-line p-4 text-center text-base text-muted">
            {t.noMatches}
          </p>
        )}
      </section>

      <button onClick={onReset} className={`${btnGhost} w-full`}>
        <RefreshCw className="h-5 w-5" aria-hidden />
        {t.newRequest}
      </button>
    </Page>
  );
};
