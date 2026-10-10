import React, { useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type {
  ActualItemInput,
  Collector,
  CollectorRequestItem,
  Language,
  PickupRecord,
  RouteResponse,
} from '../types';
import { Check, Loader2, MapPin, Navigation, Phone } from 'lucide-react';
import {
  btnPrimary,
  btnSun,
  Empty,
  fieldInput,
  inr,
  materialName,
  niceMax,
  Notice,
  Page,
  RangeRuler,
  RefreshRow,
  Sheet,
  Spinner,
} from './ui';

interface CollectorViewProps {
  lang: Language;
  onBack: () => void;
}

export const CollectorView: React.FC<CollectorViewProps> = ({ lang }) => {
  const t = getTranslation(lang);

  // Collectors list & active selection
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [selectedCollectorId, setSelectedCollectorId] = useState<string>(() => {
    return localStorage.getItem('kabadi_selected_collector_id') || 'col-001';
  });

  // Current tab: 'requests' | 'pickups' | 'route'
  const [activeTab, setActiveTab] = useState<'requests' | 'pickups' | 'route'>('requests');

  // Requests state
  const [requests, setRequests] = useState<CollectorRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Active pickups state
  const [pickups, setPickups] = useState<PickupRecord[]>([]);
  const [loadingPickups, setLoadingPickups] = useState(false);

  // Route state
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Complete Pickup Modal state
  const [activePickupToComplete, setActivePickupToComplete] = useState<PickupRecord | null>(null);
  const [actualWeights, setActualWeights] = useState<Record<string, number>>({});
  const [completing, setCompleting] = useState(false);
  const [completeSuccess, setCompleteSuccess] = useState<{
    payout: number;
    estimateErrorPct: number;
  } | null>(null);
  const [completeModalError, setCompleteModalError] = useState<string | null>(null);

  // Load collectors on mount
  useEffect(() => {
    ApiClient.getCollectors()
      .then((data) => {
        setCollectors(data);
        if (data.length > 0 && !data.find((c) => c.collectorId === selectedCollectorId)) {
          setSelectedCollectorId(data[0].collectorId);
        }
      })
      .catch((err) => console.error('Failed to load collectors:', err));
  }, []);

  // Update localStorage when selected collector changes
  const handleSelectCollector = (id: string) => {
    setSelectedCollectorId(id);
    localStorage.setItem('kabadi_selected_collector_id', id);
  };

  // Fetch Requests
  const loadRequests = async (colId: string) => {
    setLoadingRequests(true);
    setRequestError(null);
    try {
      const data: any = await ApiClient.getCollectorRequests(colId);
      const list = Array.isArray(data) ? data : (data?.requests || []);
      const normalized = list.map((item: any) => ({
        ...item,
        estimated_value_mid: item.estimated_value_mid ?? (item.estimatedValue ? Math.round((item.estimatedValue.low + item.estimatedValue.high) / 2) : 0),
        total_kg_range: item.total_kg_range ?? item.kgRange ?? { low: 0, high: 0 },
        seeded: item.seeded ?? false,
      }));
      setRequests(normalized);
    } catch (err: any) {
      console.warn('Failed to load collector requests:', err);
      setRequestError(t.fetchFailed);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Fetch Pickups
  const loadPickups = async (colId: string) => {
    setLoadingPickups(true);
    try {
      const data = await ApiClient.getPickups(colId);
      setPickups(data);
    } catch (err) {
      console.warn('Failed to load pickups:', err);
    } finally {
      setLoadingPickups(false);
    }
  };

  // Fetch Route
  const loadRoute = async (colId: string) => {
    setLoadingRoute(true);
    try {
      const col = collectors.find((c) => c.collectorId === colId);
      const start = col ? { lat: col.lat, lng: col.lng } : undefined;
      const data = await ApiClient.getCollectorRoute(colId, start);
      setRouteData(data);
    } catch (err) {
      console.warn('Failed to load route:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Refetch when tab or collector changes
  useEffect(() => {
    if (!selectedCollectorId) return;
    if (activeTab === 'requests') {
      loadRequests(selectedCollectorId);
    } else if (activeTab === 'pickups') {
      loadPickups(selectedCollectorId);
    } else if (activeTab === 'route') {
      loadRoute(selectedCollectorId);
    }
  }, [selectedCollectorId, activeTab]);

  // Accept a listing
  const handleAcceptListing = async (listingId: string) => {
    setAcceptingId(listingId);
    setRequestError(null);
    try {
      await ApiClient.acceptListing(listingId, selectedCollectorId);
      // Refresh requests and switch to pickups
      await loadRequests(selectedCollectorId);
      await loadPickups(selectedCollectorId);
      setActiveTab('pickups');
    } catch (err: any) {
      if (err.status === 409 || err.code === 'ALREADY_ACCEPTED') {
        setRequestError(t.alreadyAccepted);
        loadRequests(selectedCollectorId);
      } else {
        setRequestError(t.acceptFailed);
      }
    } finally {
      setAcceptingId(null);
    }
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (pickup: PickupRecord) => {
    setActivePickupToComplete(pickup);
    setCompleteSuccess(null);
    setCompleteModalError(null);

    // Prefill actual weights with midpoints from estimated items
    const initial: Record<string, number> = {};
    pickup.items.forEach((item) => {
      const mid = Number(((item.weight_kg_low + item.weight_kg_high) / 2).toFixed(1));
      initial[item.material] = mid;
    });
    setActualWeights(initial);
  };

  // Submit Completed Pickup
  const handleSubmitComplete = async () => {
    if (!activePickupToComplete) return;

    const actualItems: ActualItemInput[] = Object.entries(actualWeights).map(
      ([material, actual_kg]) => ({
        material,
        actual_kg: Number(actual_kg),
      })
    );

    // Validate
    const invalid = actualItems.some((i) => isNaN(i.actual_kg) || i.actual_kg <= 0);
    if (invalid) {
      setCompleteModalError(t.weightsError);
      return;
    }

    setCompleting(true);
    setCompleteModalError(null);

    try {
      const res = await ApiClient.completePickup(activePickupToComplete.pickupId, actualItems);
      setCompleteSuccess({
        payout: res.payout,
        estimateErrorPct: res.estimateErrorPct,
      });
      loadPickups(selectedCollectorId);
    } catch (err: any) {
      console.error('Failed to complete pickup:', err);
      setCompleteModalError(t.completeFailed);
    } finally {
      setCompleting(false);
    }
  };

  const selectedCollector = collectors.find((c) => c.collectorId === selectedCollectorId);
  const activeCount = pickups.filter((p) => p.status === 'ACCEPTED').length;

  const tabs = [
    { id: 'requests', label: t.requestsTab },
    { id: 'pickups', label: t.activePickupsTab },
    { id: 'route', label: t.routeTab },
  ] as const;

  return (
    <Page className="gap-4">
      <div>
        <h1 className="font-display text-3xl leading-tight">{t.collectorTitle}</h1>
        {selectedCollector && (
          <p className="text-base text-muted">
            {selectedCollector.name} · {selectedCollector.areaName}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="collector-select" className="mb-1.5 block text-sm font-semibold text-muted">
          {t.selectCollectorProfile}
        </label>
        <select
          id="collector-select"
          value={selectedCollectorId}
          onChange={(e) => handleSelectCollector(e.target.value)}
          className={fieldInput}
        >
          {collectors.map((c) => (
            <option key={c.collectorId} value={c.collectorId}>
              {c.name} — {c.areaName} {c.accepts_ewaste ? `(${t.ewasteBadge})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label={t.collectorTitle} className="grid grid-cols-3 border-b-2 border-ink">
        {tabs.map((tab) => {
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={on}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-0.5 min-h-12 rounded-t-md border-2 px-1 text-base font-bold leading-tight ${
                on ? 'border-ink border-b-sun bg-sun' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* REQUESTS */}
      {activeTab === 'requests' && (
        <div role="tabpanel" id="panel-requests" aria-labelledby="tab-requests" className="flex flex-col gap-3">
          <RefreshRow
            refreshLabel={t.refresh}
            text={`${requests.length} ${t.openOrders}`}
            loading={loadingRequests}
            onClick={() => loadRequests(selectedCollectorId)}
          />

          {requestError && <Notice tone="error">{requestError}</Notice>}

          {loadingRequests && requests.length === 0 ? (
            <Spinner text={t.findingScrap} />
          ) : requests.length === 0 ? (
            <Empty text={t.noRequests} />
          ) : (
            <ul className="flex flex-col gap-3">
              {requests.map((req) => (
                <li key={req.listingId} className="overflow-hidden rounded-md border-2 border-ink bg-card">
                  <div className="flex items-stretch">
                    <div
                      className={`flex w-28 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-ink px-2 py-3 text-center ${
                        req.worthIt ? 'bg-sun' : 'bg-paper'
                      }`}
                    >
                      <span className="font-display text-3xl leading-none tabular-nums">
                        {inr(req.estimated_value_mid)}
                      </span>
                      <span className="mt-1 text-sm font-semibold leading-tight">
                        {req.worthIt ? t.worthItTag : t.lowValueTag}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3">
                      <p className="flex flex-wrap items-center gap-x-2 text-base font-bold leading-tight">
                        {req.sellerName || t.household}
                        {req.seeded && (
                          <span className="rounded-sm border border-ink px-1.5 text-sm font-semibold">
                            {t.demoTag}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-start gap-1 text-sm text-muted">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{req.address}</span>
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        ~{req.distanceKm} km {t.away}
                      </p>
                    </div>
                  </div>
                  <div className="border-t-2 border-ink px-3 py-2.5">
                    <p className="text-sm">
                      <span className="capitalize">{req.materials.map(materialName).join(', ')}</span> ·{' '}
                      <span className="font-semibold">
                        {req.total_kg_range.low}–{req.total_kg_range.high} {t.kg}
                      </span>
                    </p>
                    <button
                      onClick={() => handleAcceptListing(req.listingId)}
                      disabled={acceptingId === req.listingId}
                      className={`${btnPrimary} mt-2.5`}
                    >
                      {acceptingId === req.listingId ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                          {t.accepting}
                        </>
                      ) : (
                        <>
                          <Check className="h-5 w-5" aria-hidden />
                          {t.acceptRequest}
                        </>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ACTIVE PICKUPS */}
      {activeTab === 'pickups' && (
        <div role="tabpanel" id="panel-pickups" aria-labelledby="tab-pickups" className="flex flex-col gap-3">
          <RefreshRow
            refreshLabel={t.refresh}
            text={`${activeCount} ${t.activeCount}`}
            loading={loadingPickups}
            onClick={() => loadPickups(selectedCollectorId)}
          />

          {loadingPickups && pickups.length === 0 ? (
            <Spinner text={t.loadingPickups} />
          ) : pickups.length === 0 ? (
            <Empty text={t.noPickups} />
          ) : (
            <ul className="flex flex-col gap-3">
              {pickups.map((p) => (
                <li key={p.pickupId} className="rounded-md border-2 border-ink bg-card p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold leading-tight">{p.sellerName}</p>
                      <p className="text-sm text-muted">{p.address}</p>
                      {p.sellerPhone && (
                        <a
                          href={`tel:${p.sellerPhone}`}
                          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-base font-bold underline underline-offset-4"
                        >
                          <Phone className="h-4 w-4" aria-hidden />
                          {p.sellerPhone}
                        </a>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-sm px-2 text-sm font-bold ${
                        p.status === 'COMPLETED' ? 'bg-ink text-white' : 'bg-sun'
                      }`}
                    >
                      {p.status === 'COMPLETED' ? t.statusCompletedShort : t.statusAcceptedShort}
                    </span>
                  </div>

                  {p.status === 'ACCEPTED' ? (
                    <button onClick={() => handleOpenCompleteModal(p)} className={`${btnSun} mt-3`}>
                      <Check className="h-5 w-5" aria-hidden />
                      {t.completePickupAction}
                    </button>
                  ) : (
                    <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-line pt-2">
                      <span className="text-base text-muted">{t.payoutPaid}</span>
                      <span className="font-display text-2xl text-leaf">{inr(p.payout ?? 0)}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ROUTE */}
      {activeTab === 'route' && (
        <div role="tabpanel" id="panel-route" aria-labelledby="tab-route" className="flex flex-col gap-4">
          {loadingRoute ? (
            <Spinner text={t.buildingRoute} />
          ) : routeData && routeData.stops.length > 0 ? (
            <>
              <section className="rounded-md border-2 border-ink bg-sun p-4">
                <h2 className="font-display text-xl">{t.routeOptimizationTitle}</h2>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <dt className="text-sm">{t.stopsCount}</dt>
                    <dd className="font-display text-3xl leading-tight tabular-nums">{routeData.stopsCount}</dd>
                  </div>
                  <div>
                    <dt className="text-sm">{t.totalDistance}</dt>
                    <dd className="font-display text-3xl leading-tight tabular-nums">{routeData.totalKm} km</dd>
                  </div>
                  <div>
                    <dt className="text-sm">{t.distanceSaved}</dt>
                    <dd className="font-display text-3xl leading-tight tabular-nums">{routeData.kmSaved} km</dd>
                  </div>
                </dl>
                <p className="mt-3 border-t-2 border-ink pt-2 text-sm">
                  {t.estTripTime}: ~{routeData.totalMin} min · {t.separateTripsKm}: {routeData.naiveKm} km
                </p>
              </section>

              <div>
                <h2 className="mb-3 font-display text-2xl">{t.orderedStops}</h2>
                <ol className="relative flex flex-col gap-3">
                  <span aria-hidden className="absolute bottom-6 left-[1.1rem] top-6 w-0.5 bg-ink" />
                  {routeData.stops.map((stop) => (
                    <li key={stop.listingId} className="relative flex items-start gap-3">
                      <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun font-display text-lg">
                        {stop.stopIndex}
                      </span>
                      <div className="min-w-0 flex-1 rounded-md border-2 border-line bg-white p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-base font-bold">{stop.sellerName}</p>
                          <p className="shrink-0 text-sm font-semibold">+{stop.distanceFromPrevKm} km</p>
                        </div>
                        <p className="text-sm text-muted">{stop.address}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm">
                            {t.etaShort} ~{stop.etaMin} min
                          </span>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border-2 border-ink px-3 text-sm font-bold hover:bg-sun-soft"
                          >
                            <Navigation className="h-4 w-4" aria-hidden />
                            {t.navigateButton}
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="text-sm text-muted">{t.routeNote}</p>
            </>
          ) : (
            <Empty text={t.routeEmpty} />
          )}
        </div>
      )}

      {/* COMPLETE PICKUP */}
      {activePickupToComplete && (
        <Sheet
          title={completeSuccess ? t.payoutConfirmed : t.completePickupAction}
          closeLabel={t.cancel}
          onClose={() => setActivePickupToComplete(null)}
        >
          {completeSuccess ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border-2 border-ink bg-sun p-4">
                <p className="text-base font-semibold">{t.payoutAmount}</p>
                <p className="font-display text-5xl leading-tight tabular-nums">{inr(completeSuccess.payout)}</p>
                <p className="mt-2 border-t-2 border-ink pt-2 text-base">
                  {t.estimateAccuracy}: <span className="font-bold">{completeSuccess.estimateErrorPct}%</span>{' '}
                  {t.errorVsAi}
                </p>
              </div>
              <button onClick={() => setActivePickupToComplete(null)} className={btnPrimary}>
                {t.done}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-base text-muted">{t.actualWeightPrompt}</p>
              {completeModalError && <Notice tone="error">{completeModalError}</Notice>}

              <ul className="flex flex-col gap-3">
                {activePickupToComplete.items.map((item) => {
                  const v = actualWeights[item.material] ?? 0;
                  const id = `actual-${item.material}`;
                  return (
                    <li key={item.material} className="rounded-md border-2 border-ink bg-white p-3">
                      <label htmlFor={id} className="text-lg font-bold capitalize">
                        {materialName(item.material)}
                      </label>
                      <div className="mt-3">
                        <RangeRuler
                          max={niceMax(item.weight_kg_high, v)}
                          low={item.weight_kg_low}
                          high={item.weight_kg_high}
                          value={v}
                          valueLabel={`${v} ${t.kg}`}
                          ariaLabel={`${t.scaleReading}: ${materialName(item.material)}`}
                        />
                      </div>
                      <p className="mb-2 text-sm text-muted">
                        {t.estShort}: {item.weight_kg_low}–{item.weight_kg_high} {t.kg}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          id={id}
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          min="0.1"
                          max="500"
                          value={actualWeights[item.material] ?? ''}
                          onChange={(e) =>
                            setActualWeights({
                              ...actualWeights,
                              [item.material]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className={`${fieldInput} text-lg font-bold`}
                          placeholder="5.5"
                        />
                        <span className="text-base font-semibold">{t.kg}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <button onClick={handleSubmitComplete} disabled={completing} className={btnSun}>
                {completing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    {t.calculating}
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" aria-hidden />
                    {t.calculatePayout}
                  </>
                )}
              </button>
            </div>
          )}
        </Sheet>
      )}
    </Page>
  );
};
