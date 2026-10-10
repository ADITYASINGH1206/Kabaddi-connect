import React, { useState } from 'react';
import { ApiClient } from '../api/client';
import { getTranslation } from '../i18n/translations';
import type { CreateListingResponse, DetectedItem, Language } from '../types';
import {
  Calendar,
  Clock,
  Compass,
  Loader2,
  MapPin,
  Phone,
  Send,
  User,
} from 'lucide-react';

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
  const [slot, setSlot] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [preferredDate, setPreferredDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
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
          setAddress(
            lang === 'hi'
              ? 'वर्तमान जीपीएस स्थान (उत्तर-पश्चिम दिल्ली)'
              : 'Current GPS Location (NW Delhi)'
          );
        }
      },
      (err) => {
        setDetectingLoc(false);
        console.warn('Geolocation failed:', err);
        alert(
          lang === 'hi'
            ? 'लोकेशन नहीं मिली। कृपया सूची से अपना इलाका चुनें।'
            : 'Could not access GPS. Please select a nearby area below.'
        );
      },
      { timeout: 8000 }
    );
  };

  const handleAreaSelect = (area: (typeof NW_DELHI_AREAS)[0]) => {
    setCoords({ lat: area.lat, lng: area.lng });
    setAddress(area.name + ', New Delhi');
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
      setErrorMsg(err.message || 'Failed to submit pickup request. Please retry.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start px-4 py-6 max-w-lg mx-auto w-full">
      <div className="w-full text-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {t.pickupDetailsTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          {t.pickupDetailsSubtitle}
        </p>
      </div>

      {/* Summary card */}
      <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 mb-5 flex justify-between items-center shadow-lg">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            {t.estimatedValue}
          </span>
          <span className="text-xl font-extrabold text-emerald-400">
            ₹{priceRange.low} – ₹{priceRange.high}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-400 block font-medium">
            {items.length} {t.materialsFound}
          </span>
          <span className="text-xs text-slate-300 font-bold">
            ~{items.reduce((acc, curr) => acc + (curr.weight_kg_user || 0), 0)} kg
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="w-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3 mb-4">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* Name and Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {t.yourName}
            </label>
            <input
              type="text"
              required
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {t.yourPhone}
            </label>
            <input
              type="tel"
              required
              value={sellerPhone}
              onChange={(e) => setSellerPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {t.addressLabel}
            </label>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={detectingLoc}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {detectingLoc ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t.detectingLocation}
                </>
              ) : (
                <>
                  <Compass className="w-3 h-3" />
                  {t.useMyLocation}
                </>
              )}
            </button>
          </div>
          <textarea
            required
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.addressPlaceholder}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />

          {/* Fallback Neighborhood Chips */}
          <div className="mt-2">
            <span className="text-[10px] text-slate-400 font-semibold block mb-1.5">
              {t.selectAreaFallback}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NW_DELHI_AREAS.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => handleAreaSelect(a)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-300 transition-colors"
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date and Time slot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {t.preferredDate}
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {t.pickupSlot}
            </label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="morning">{t.slotMorning}</option>
              <option value="afternoon">{t.slotAfternoon}</option>
              <option value="evening">{t.slotEvening}</option>
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {t.back}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-2 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.submittingListing}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {t.submitListing}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
