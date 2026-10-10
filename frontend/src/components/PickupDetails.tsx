import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type { CreateListingResponse, DetectedItem, Language } from '../types';
import { Compass, Loader2, Send } from 'lucide-react';
import { btnGhost, btnSun, fieldInput, inr, Notice, Page } from './ui';

interface PickupDetailsProps {
  lang: Language;
  items: DetectedItem[];
  priceRange: { low: number; high: number };
  onBack: () => void;
  onListingCreated: (response: CreateListingResponse) => void;
}

const NW_DELHI_AREAS = [
  { name: 'Rohini Sector 3', lat: 28.7160, lng: 77.1215 },
  { name: 'Rohini Sector 7', lat: 28.7080, lng: 77.1180 },
  { name: 'DTU / Shahbad Daulatpur', lat: 28.7501, lng: 77.1177 },
  { name: 'Bawana Industrial Area', lat: 28.7920, lng: 77.0530 },
  { name: 'Shalimar Bagh', lat: 28.7180, lng: 77.1620 },
  { name: 'Model Town', lat: 28.7020, lng: 77.1930 },
  { name: 'Pitampura', lat: 28.6990, lng: 77.1380 },
  { name: 'Narela', lat: 28.8520, lng: 77.0920 },
];

export const PickupDetails: React.FC<PickupDetailsProps> = ({
  lang,
  items,
  priceRange,
  onBack,
  onListingCreated,
}) => {
  const t = getTranslation(lang);

  const [sellerName, setSellerName] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.7160,
    lng: 77.1215,
  });
  const [detectingLoc, setDetectingLoc] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [preferredDate, setPreferredDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUseLocation = () => {
    setGeoMsg(null);
    if (!navigator.geolocation) {
      setGeoMsg(t.geoUnsupported);
      return;
    }
    setDetectingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingLoc(false);
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        });
        if (!address) {
          setAddress(t.gpsAddress);
        }
      },
      (err) => {
        setDetectingLoc(false);
        console.warn('Geolocation failed:', err);
        setGeoMsg(t.geoFailed);
      },
      { timeout: 8000 }
    );
  };

  const handleAreaSelect = (area: (typeof NW_DELHI_AREAS)[0]) => {
    setCoords({ lat: area.lat, lng: area.lng });
    setAddress(area.name + ', New Delhi');
    setGeoMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerName.trim() || !sellerPhone.trim() || !address.trim()) {
      setErrorMsg(t.validationErrorMsg);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim(),
        address: address.trim(),
        lat: coords.lat,
        lng: coords.lng,
        pickupWindow: {
          preferredDate,
          slot,
        },
        items: items.map((i) => ({
          material: i.material,
          weight_kg_low: i.weight_kg_low,
          weight_kg_high: i.weight_kg_high,
          weight_kg_user: i.weight_kg_user,
        })),
      };

      const res = await ApiClient.createListing(payload);
      onListingCreated(res);
    } catch (err: any) {
      console.error('Failed to create listing:', err);
      setErrorMsg(err?.message || t.errorFailedSubmit);
      setSubmitting(false);
    }
  };

  const totalKg = items.reduce((acc, curr) => acc + (curr.weight_kg_user || 0), 0);
  const slots = [
    { id: 'morning', label: t.slotMorning },
    { id: 'afternoon', label: t.slotAfternoon },
    { id: 'evening', label: t.slotEvening },
  ] as const;

  return (
    <Page className="gap-5">
      <div>
        <h1 className="font-display text-3xl leading-tight">{t.pickupDetailsTitle}</h1>
        <p className="mt-1.5 text-base text-muted">{t.pickupDetailsSubtitle}</p>
      </div>

      {/* Receipt-style summary */}
      <section className="rounded-md border-2 border-ink bg-sun p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold">{t.yourScrap}</span>
          <span className="text-sm font-semibold">
            {items.length} · {Number(totalKg.toFixed(1))} {t.kg}
          </span>
        </div>
        <p className="font-display text-3xl tabular-nums">
          {inr(priceRange.low)} – {inr(priceRange.high)}
        </p>
      </section>

      {errorMsg && <Notice tone="error">{errorMsg}</Notice>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="seller-name" className="mb-1.5 block text-base font-bold">
            {t.yourName}
          </label>
          <input
            id="seller-name"
            type="text"
            required
            autoComplete="name"
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            placeholder={t.namePlaceholder}
            className={fieldInput}
          />
        </div>

        <div>
          <label htmlFor="seller-phone" className="mb-1.5 block text-base font-bold">
            {t.yourPhone}
          </label>
          <input
            id="seller-phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            value={sellerPhone}
            onChange={(e) => setSellerPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={fieldInput}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="seller-address" className="text-base font-bold">
              {t.addressLabel}
            </label>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={detectingLoc}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-bold underline-offset-4 hover:underline disabled:opacity-60"
            >
              {detectingLoc ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Compass className="h-4 w-4" aria-hidden />
              )}
              {detectingLoc ? t.detectingLocation : t.useMyLocation}
            </button>
          </div>
          <textarea
            id="seller-address"
            required
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.addressPlaceholder}
            className={`${fieldInput} resize-none`}
          />
          {geoMsg && (
            <div className="mt-2">
              <Notice tone="warn">{geoMsg}</Notice>
            </div>
          )}

          <fieldset className="mt-3">
            <legend className="mb-1.5 text-sm font-semibold text-muted">{t.selectAreaFallback}</legend>
            <div className="flex flex-wrap gap-2">
              {NW_DELHI_AREAS.map((a) => {
                const on = address.startsWith(a.name);
                return (
                  <button
                    key={a.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => handleAreaSelect(a)}
                    className={`min-h-11 rounded-md border-2 px-3 text-sm font-semibold ${
                      on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'
                    }`}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div>
          <label htmlFor="pickup-date" className="mb-1.5 block text-base font-bold">
            {t.preferredDate}
          </label>
          <input
            id="pickup-date"
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className={fieldInput}
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-base font-bold">{t.pickupSlot}</legend>
          <div className="grid gap-2">
            {slots.map((s) => (
              <label
                key={s.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border-2 px-3 py-2 text-base font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                  slot === s.id ? 'border-ink bg-sun' : 'border-line bg-white hover:border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="slot"
                  value={s.id}
                  checked={slot === s.id}
                  onChange={() => setSlot(s.id)}
                  className="h-5 w-5 accent-ink"
                />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onBack} className={btnGhost}>
            {t.back}
          </button>
          <button type="submit" disabled={submitting} className={`${btnSun} flex-1`}>
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                {t.submittingListing}
              </>
            ) : (
              <>
                <Send className="h-5 w-5" aria-hidden />
                {t.submitListing}
              </>
            )}
          </button>
        </div>
      </form>
    </Page>
  );
};
