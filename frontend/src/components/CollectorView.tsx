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
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Route,
  Truck,
  User,
  X,
} from 'lucide-react';

interface CollectorViewProps {
  lang: Language;
  onBack: () => void;
}

export const CollectorView: React.FC<CollectorViewProps> = ({ lang, onBack }) => {
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
      const data = await ApiClient.getCollectorRequests(colId);
      setRequests(data);
    } catch (err: any) {
      console.warn('Failed to load collector requests:', err);
      setRequestError(err.message || 'Could not fetch requests');
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
        setRequestError(err.message || 'Failed to accept listing');
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
      setCompleteModalError('All weights must be greater than 0 kg');
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
      setCompleteModalError(err.message || 'Failed to complete pickup');
    } finally {
      setCompleting(false);
    }
  };

  const selectedCollector = collectors.find((c) => c.collectorId === selectedCollectorId);

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 py-5 max-w-lg mx-auto w-full">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            {t.collectorTitle}
          </h2>
          <span className="text-xs text-slate-400 block mt-0.5">
            {selectedCollector ? `${selectedCollector.name} (${selectedCollector.areaName})` : ''}
          </span>
        </div>
        <button
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {t.back}
        </button>
      </div>

      {/* Demo Collector Selector */}
      <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 mb-4">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <User className="w-3 h-3 text-emerald-400" />
          {t.selectCollectorProfile}
        </label>
        <select
          value={selectedCollectorId}
          onChange={(e) => handleSelectCollector(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
        >
          {collectors.map((c) => (
            <option key={c.collectorId} value={c.collectorId}>
              {c.name} — {c.areaName} {c.accepts_ewaste ? '(E-Waste)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Tab Switcher */}
      <div className="w-full grid grid-cols-3 gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 mb-5">
        <button
          onClick={() => setActiveTab('requests')}
          className={`py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'requests'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.requestsTab}
        </button>
        <button
          onClick={() => setActiveTab('pickups')}
          className={`py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'pickups'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.activePickupsTab}
        </button>
        <button
          onClick={() => setActiveTab('route')}
          className={`py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'route'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.routeTab}
        </button>
      </div>

      {/* TAB 1: REQUESTS */}
      {activeTab === 'requests' && (
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">
              {requests.length} open orders available
            </span>
            <button
              onClick={() => loadRequests(selectedCollectorId)}
              disabled={loadingRequests}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingRequests ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {requestError && (
            <div className="w-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{requestError}</span>
            </div>
          )}

          {loadingRequests && requests.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">Finding high-value scrap nearby...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
              <Package className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{t.noRequests}</p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.listingId}
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-lg hover:border-slate-600 transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {req.sellerName || 'Household'}
                      </span>
                      {req.worthIt ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                          {t.worthItTag}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
                          {t.lowValueTag}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {req.address}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-extrabold text-emerald-400 block">
                      ₹{req.estimated_value_mid}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ~{req.distanceKm} km away
                    </span>
                  </div>
                </div>

                {/* Materials badges */}
                <div className="flex flex-wrap gap-1.5 my-3">
                  {req.materials.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] font-medium bg-slate-900 border border-slate-700/80 text-slate-300 px-2 py-0.5 rounded-lg capitalize"
                    >
                      {m.replace(/_/g, ' ')}
                    </span>
                  ))}
                  <span className="text-[10px] text-slate-400 py-0.5 font-semibold">
                    ({req.total_kg_range.low}–{req.total_kg_range.high} kg)
                  </span>
                </div>

                {/* Accept button */}
                <button
                  onClick={() => handleAcceptListing(req.listingId)}
                  disabled={acceptingId === req.listingId}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {acceptingId === req.listingId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t.accepting}
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {t.acceptRequest}
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE PICKUPS */}
      {activeTab === 'pickups' && (
        <div className="w-full space-y-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">
              {pickups.filter((p) => p.status === 'ACCEPTED').length} active accepted pickups
            </span>
            <button
              onClick={() => loadPickups(selectedCollectorId)}
              disabled={loadingPickups}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingPickups ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loadingPickups && pickups.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">Loading active pickups...</span>
            </div>
          ) : pickups.length === 0 ? (
            <div className="py-12 text-center bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
              <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">{t.noPickups}</p>
            </div>
          ) : (
            pickups.map((p) => (
              <div
                key={p.pickupId}
                className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {p.sellerName}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {p.address}
                    </span>
                    {p.sellerPhone && (
                      <a
                        href={`tel:${p.sellerPhone}`}
                        className="text-[11px] text-emerald-400 font-bold hover:underline flex items-center gap-1 mt-1"
                      >
                        <Phone className="w-3 h-3" />
                        {p.sellerPhone}
                      </a>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === 'COMPLETED'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {p.status === 'ACCEPTED' ? (
                  <button
                    onClick={() => handleOpenCompleteModal(p)}
                    className="w-full mt-3 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.completePickupAction}
                  </button>
                ) : (
                  <div className="mt-3 pt-2 border-t border-slate-700/50 flex justify-between text-xs">
                    <span className="text-slate-400">Payout Paid:</span>
                    <span className="font-bold text-emerald-400">₹{p.payout}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ROUTE OPTIMIZATION */}
      {activeTab === 'route' && (
        <div className="w-full space-y-4">
          {loadingRoute ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">Optimizing nearest stops & route...</span>
            </div>
          ) : routeData ? (
            <>
              {/* Route Summary KPI Card */}
              <div className="w-full bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 font-bold text-emerald-300 text-xs mb-3">
                  <Route className="w-4 h-4 text-emerald-400" />
                  <span>{t.routeOptimizationTitle}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      {t.stopsCount}
                    </span>
                    <span className="text-base font-extrabold text-white">
                      {routeData.stopsCount}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      {t.totalDistance}
                    </span>
                    <span className="text-base font-extrabold text-emerald-400">
                      {routeData.totalKm} km
                    </span>
                  </div>
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/50">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      {t.distanceSaved}
                    </span>
                    <span className="text-base font-extrabold text-amber-400">
                      {routeData.kmSaved} km
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-between items-center text-[11px] text-slate-400 px-1">
                  <span>Est. Trip Time: ~{routeData.totalMin} mins</span>
                  <span>Naive Round Trips: {routeData.naiveKm} km</span>
                </div>
              </div>

              {/* Numbered Stops List */}
              <div className="w-full space-y-2.5">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block px-1">
                  Ordered Pickup Stops
                </span>

                {routeData.stops.map((stop) => (
                  <div
                    key={stop.listingId}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-3.5 flex items-start gap-3 shadow-md"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      #{stop.stopIndex}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white truncate">
                          {stop.sellerName}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold shrink-0">
                          +{stop.distanceFromPrevKm} km
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {stop.address}
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          ETA: ~{stop.etaMin} mins
                        </span>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <Navigation className="w-3 h-3" />
                          {t.navigateButton}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
              <Route className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                Accept pickups first to generate an optimized cluster route.
              </p>
            </div>
          )}
        </div>
      )}

      {/* COMPLETE PICKUP MODAL */}
      {activePickupToComplete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                {t.completePickupAction}
              </h3>
              <button
                onClick={() => setActivePickupToComplete(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {completeSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-white">{t.payoutConfirmed}</h4>

                <div className="bg-slate-800/80 rounded-2xl p-4 text-left border border-slate-700 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">{t.payoutAmount}:</span>
                    <span className="text-xl font-extrabold text-emerald-400">
                      ₹{completeSuccess.payout}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{t.estimateAccuracy}:</span>
                    <span className="font-bold text-amber-400">
                      {completeSuccess.estimateErrorPct}% error vs AI
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActivePickupToComplete(null)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">{t.actualWeightPrompt}</p>

                {completeModalError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {completeModalError}
                  </div>
                )}

                <div className="space-y-3">
                  {activePickupToComplete.items.map((item) => (
                    <div
                      key={item.material}
                      className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/70"
                    >
                      <div className="flex justify-between text-xs font-semibold text-white mb-2 capitalize">
                        <span>{item.material.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400">
                          Est: {item.weight_kg_low}–{item.weight_kg_high} kg
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                          placeholder="e.g. 5.5"
                        />
                        <span className="text-xs text-slate-400 font-medium">kg</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSubmitComplete}
                  disabled={completing}
                  className="w-full mt-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {completing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {t.calculatePayout}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
