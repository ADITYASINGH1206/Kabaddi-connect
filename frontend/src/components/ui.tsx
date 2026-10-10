import React, { useEffect, useRef } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';

/* ---------- shared class strings ---------- */

export const btnPrimary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-ink px-5 py-3 text-base font-bold text-white transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50';
export const btnSun =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border-2 border-ink bg-sun px-5 py-3 text-base font-bold text-ink transition-colors hover:bg-[#ffd45e] disabled:cursor-not-allowed disabled:opacity-50';
export const btnGhost =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 border-ink bg-transparent px-4 py-3 text-base font-bold text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';
export const btnQuiet =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-bold text-ink underline-offset-4 hover:underline disabled:opacity-50';
export const fieldInput =
  'w-full min-h-12 rounded-md border-2 border-line bg-white px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-ink';
export const panel = 'rounded-md border-2 border-ink bg-card';

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const materialName = (m: string) => m.replace(/_/g, ' ');

/* ---------- page shell ---------- */

export const Page: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-10 pt-5 ${className}`}>
    {children}
  </div>
);

export const Notice: React.FC<{
  tone: 'error' | 'warn' | 'info';
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ tone, title, children, icon }) => {
  const tones = {
    error: 'border-brick bg-brick-soft',
    warn: 'border-ink bg-sun-soft',
    info: 'border-line bg-white',
  } as const;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-md border-l-8 p-3.5 ${tones[tone]}`}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-sm leading-snug">
        {title && <p className="text-base font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
};

/* ---------- step indicator (household flow is a real sequence) ---------- */

export const StepBar: React.FC<{ labels: string[]; current: number }> = ({ labels, current }) => (
  <ol className="mx-auto flex w-full max-w-lg items-center gap-1 px-4 pt-4" aria-label="Progress">
    {labels.map((label, i) => {
      const state = i < current ? 'done' : i === current ? 'now' : 'next';
      return (
        <li
          key={label}
          aria-current={state === 'now' ? 'step' : undefined}
          className="flex flex-1 flex-col gap-1"
        >
          <span
            className={`h-1.5 rounded-sm ${
              state === 'next' ? 'bg-line' : state === 'now' ? 'bg-sun ring-1 ring-ink' : 'bg-ink'
            }`}
          />
          <span
            className={`text-xs ${
              state === 'now' ? 'font-bold text-ink' : 'font-semibold text-muted'
            }`}
          >
            {label}
          </span>
        </li>
      );
    })}
  </ol>
);

/* ---------- bottom sheet ---------- */

export const Sheet: React.FC<{
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}> = ({ title, onClose, closeLabel, children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border-2 border-ink bg-paper p-5 outline-none sm:rounded-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* ---------- the range ruler ----------
   One memorable element: a measuring ruler. The yellow band is the AI's weight
   range; the ink needle is the household's weight (or the collector's scale reading).
   Optional invisible <input type=range> on top makes it draggable and keyboard-operable. */

export const niceMax = (high: number, value: number): number => {
  const top = Math.max(high * 1.6, value * 1.15, 6);
  if (top <= 12) return Math.ceil(top / 2) * 2;
  if (top <= 30) return Math.ceil(top / 5) * 5;
  return Math.ceil(top / 10) * 10;
};

interface RulerProps {
  max: number;
  low: number;
  high: number;
  value: number;
  onChange?: (v: number) => void;
  ariaLabel: string;
  bandLabel?: string;
  valueLabel?: string;
  step?: number;
}

export const RangeRuler: React.FC<RulerProps> = ({
  max,
  low,
  high,
  value,
  onChange,
  ariaLabel,
  bandLabel,
  valueLabel,
  step = 0.5,
}) => {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / max) * 100))}%`;
  const minorEvery = max <= 12 ? 1 : max <= 30 ? 2 : 5;
  const majorEvery = max <= 12 ? 2 : max <= 30 ? 10 : 10;
  const ticks: number[] = [];
  for (let n = 0; n <= max; n += minorEvery) ticks.push(n);
  const inBand = value >= low && value <= high;

  return (
    <div className="select-none">
      <div className="relative mx-3 h-[4.75rem]">
        {/* baseline */}
        <div className="absolute inset-x-0 bottom-6 h-0.5 bg-ink" />
        {/* AI band */}
        <div
          className="absolute bottom-6 h-7 border-2 border-b-0 border-ink bg-sun"
          style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})`, minWidth: 6 }}
          title={bandLabel}
        />
        {/* ticks hang below the baseline, labels under them */}
        {ticks.map((n) => {
          const major = n % majorEvery === 0;
          return (
            <React.Fragment key={n}>
              <div
                className="absolute -translate-x-1/2 bg-ink"
                style={{ left: pct(n), bottom: major ? 14 : 18, height: major ? 10 : 6, width: major ? 2 : 1 }}
              />
              {major && (
                <span
                  className="absolute bottom-0 -translate-x-1/2 text-xs font-semibold leading-3.5 text-muted"
                  style={{ left: pct(n) }}
                >
                  {n}
                </span>
              )}
            </React.Fragment>
          );
        })}
        {/* needle */}
        <div
          className="pointer-events-none absolute bottom-3.5 top-0 -translate-x-1/2"
          style={{ left: pct(value) }}
        >
          <div
            className={`mx-auto -mt-0.5 whitespace-nowrap rounded-sm border-2 border-ink px-1.5 text-sm font-bold leading-5 ${
              inBand ? 'bg-ink text-white' : 'bg-white text-ink'
            }`}
          >
            {valueLabel ?? value}
          </div>
          <div className="mx-auto h-full w-0.5 bg-ink" />
        </div>
        {onChange && (
          <input
            type="range"
            min={0}
            max={max}
            step={step}
            value={Math.min(value, max)}
            aria-label={ariaLabel}
            aria-valuetext={valueLabel ?? String(value)}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        )}
        {onChange && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 hidden rounded-md outline-[3px] outline-offset-0 outline-ink peer-focus-visible:block"
          />
        )}
      </div>
    </div>
  );
};

/* ---------- small shared states ---------- */

export const Spinner: React.FC<{ text: string }> = ({ text }) => (
  <div role="status" className="flex flex-col items-center gap-2 py-12 text-muted">
    <Loader2 className="h-8 w-8 animate-spin text-ink" aria-hidden />
    <span className="text-base">{text}</span>
  </div>
);

export const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-md border-2 border-dashed border-line p-6 text-center text-base text-muted">
    {text}
  </p>
);

export const RefreshRow: React.FC<{
  text: string;
  loading: boolean;
  onClick: () => void;
  refreshLabel: string;
}> = ({ text, loading, onClick, refreshLabel }) => (
  <div className="flex items-center justify-between">
    <span className="text-base font-semibold">{text}</span>
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-bold underline-offset-4 hover:underline"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
      {refreshLabel}
    </button>
  </div>
);
