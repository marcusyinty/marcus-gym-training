import React, { useCallback, useRef, useState } from 'react';
import { Language, uiTranslations } from '../data/translations';
import { BodyData } from '../lib/body';
import {
  bodySummary, CHART_RANGES, ChartRange, dayNumber, inChartRange, movingAverage, niceScale, weightSeries,
} from '../lib/bodyChart';
import { formatWeight, WeightUnit } from '../lib/units';
import { formatLocalDay } from '../lib/weeks';

interface BodyChartProps {
  lang: Language;
  body: BodyData | undefined;
  weightUnit: WeightUnit;
}

// Neutral colours; entries are dots and the average is a line, so the legend never depends on colour alone
const POINT = '#a1a1aa'; // zinc-400
const AVERAGE = '#22d3ee'; // cyan-400
const GRID = '#27272a';
const LABEL = '#a1a1aa';
const HEIGHT = 176;
const PAD = { right: 10, top: 10, bottom: 24 };

// The width the chart really gets: it is drawn at that size, so its text is the same size on every phone
const useWidth = () => {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.current.observe(el);
  }, []);
  return [ref, width] as const;
};

// The Body screen's weight trend: a short neutral summary, then each entry as a dot and the 7-entry average as
// a line, for the last 30 or 90 days or everything. Weights in the app's unit. Waist and hips are in the list only.
export const BodyChart: React.FC<BodyChartProps> = ({ lang, body, weightUnit }) => {
  const t = uiTranslations[lang];
  const [range, setRange] = useState<ChartRange>('90');
  const [boxRef, width] = useWidth();
  const now = new Date();
  const year = String(now.getFullYear());
  // "5 Oct" this year, "5 Oct 2025" before
  const dayLabel = (day: string) => formatLocalDay(day, lang, day.slice(0, 4) === year);
  const withUnit = (text: string) => `${text} ${weightUnit}`;

  const series = weightSeries(body, weightUnit);
  const averages = movingAverage(series.map((p) => p.value));
  const shown = inChartRange(
    series.map((p, i) => ({ ...p, average: averages[i] })),
    range,
    now
  );
  const { latest, sinceFirst, last30 } = bodySummary(series, now);

  const chart = () => {
    const values = shown.flatMap((p) => (p.average === null ? [p.value] : [p.value, p.average]));
    const scale = niceScale(Math.min(...values), Math.max(...values));
    const tickTexts = scale.ticks.map(formatWeight);
    const left = 10 + 6.6 * Math.max(...tickTexts.map((s) => s.length));
    const [first, last] = [dayNumber(shown[0].day), dayNumber(shown[shown.length - 1].day)];
    const x = (day: string) => left + ((dayNumber(day) - first) / (last - first)) * (width - left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - scale.min) / (scale.max - scale.min)) * (HEIGHT - PAD.top - PAD.bottom);
    const averaged = shown.filter((p) => p.average !== null);
    const byValue = [...shown].sort((a, b) => a.value - b.value);
    const r = shown.length > 60 ? 2 : 3;
    return (
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={t.bodyChartAria(
          t.bodyRangeAria[range],
          shown.length,
          dayLabel(shown[0].day),
          dayLabel(shown[shown.length - 1].day),
          withUnit(byValue[0].text),
          withUnit(byValue[byValue.length - 1].text)
        )}
        data-body-chart-svg
        className="block"
      >
        {scale.ticks.map((tick, i) => (
          <g key={tick}>
            <line x1={left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
            <text x={left - 6} y={y(tick)} dy="0.35em" textAnchor="end" fontSize={11} fill={LABEL}>
              {tickTexts[i]}
            </text>
          </g>
        ))}
        <text x={left} y={HEIGHT - 6} textAnchor="start" fontSize={11} fill={LABEL}>
          {dayLabel(shown[0].day)}
        </text>
        <text x={width - PAD.right} y={HEIGHT - 6} textAnchor="end" fontSize={11} fill={LABEL}>
          {dayLabel(shown[shown.length - 1].day)}
        </text>
        <g data-body-chart-points>
          {shown.map((p) => (
            <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r={r} fill={POINT} stroke="#0d0d10" strokeWidth={1} />
          ))}
        </g>
        {averaged.length > 1 && (
          <polyline
            data-body-chart-average
            points={averaged.map((p) => `${x(p.day)},${y(p.average!)}`).join(' ')}
            fill="none"
            stroke={AVERAGE}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {averaged.length === 1 && (
          <line
            data-body-chart-average
            x1={x(averaged[0].day) - 6}
            x2={x(averaged[0].day) + 6}
            y1={y(averaged[0].average!)}
            y2={y(averaged[0].average!)}
            stroke={AVERAGE}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  };

  return (
    <section aria-labelledby="body-chart-title" data-body-chart className="rounded-xl border border-[#27272a] bg-[#0d0d10] p-3 space-y-3">
      <h4 id="body-chart-title" className="text-xs font-extrabold uppercase tracking-wider text-white">
        {t.bodyChartTitle}
      </h4>

      {latest === null ? (
        <p data-body-chart-empty className="py-2 text-xs text-zinc-400 leading-relaxed">
          {t.bodyChartEmpty}
        </p>
      ) : (
        <>
          {/* A plain, neutral summary (the same whatever range the chart shows) */}
          <div data-body-summary className="space-y-0.5 text-xs text-zinc-200 leading-relaxed">
            <p data-body-summary-latest>{t.bodyLatest(withUnit(latest.text), dayLabel(latest.day))}</p>
            {sinceFirst && <p data-body-summary-first>{t.bodySinceFirst(dayLabel(sinceFirst.from.day), withUnit(sinceFirst.change))}</p>}
            {sinceFirst && (
              <p data-body-summary-30>
                {last30 ? t.bodyLast30(withUnit(last30.change), dayLabel(last30.from.day), dayLabel(last30.to.day)) : t.bodyLast30NotEnough}
              </p>
            )}
          </div>

          {series.length === 1 ? (
            <p data-body-chart-one className="text-xs text-zinc-400 leading-relaxed">
              {t.bodyChartOne}
            </p>
          ) : (
            <>
              <div role="group" aria-label={t.bodyRangeLabel} className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-[#18181c] p-1">
                {CHART_RANGES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    data-body-range={r}
                    aria-pressed={range === r}
                    onClick={() => setRange(r)}
                    className={`min-h-11 px-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      range === r ? 'bg-emerald-500 text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {t.bodyRanges[r]}
                  </button>
                ))}
              </div>

              {/* Fixed height, so switching ranges never makes the screen jump */}
              <div ref={boxRef} className="h-[176px]">
                {shown.length < 2 ? (
                  <p data-body-chart-few className="h-full flex items-center justify-center px-4 text-center text-xs text-zinc-400 leading-relaxed">
                    {t.bodyChartFew}
                  </p>
                ) : (
                  width > 0 && chart()
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400" data-body-chart-legend>
                <span className="flex items-center gap-1.5">
                  <svg width="10" height="10" aria-hidden="true">
                    <circle cx="5" cy="5" r="3.5" fill={POINT} />
                  </svg>
                  {t.bodyLegendEntries}
                </span>
                {series.length >= 7 && (
                  <span className="flex items-center gap-1.5">
                    <svg width="18" height="10" aria-hidden="true">
                      <line x1="2" y1="5" x2="16" y2="5" stroke={AVERAGE} strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    {t.bodyLegendAverage}
                  </span>
                )}
              </div>
              {series.length < 7 && (
                <p data-body-average-later className="text-[11px] text-zinc-400 leading-relaxed">
                  {t.bodyAverageLater}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};
