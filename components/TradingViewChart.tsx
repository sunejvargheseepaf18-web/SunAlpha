import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { StockData, CPRLevels } from '../types';

interface TradingViewChartProps {
  data: StockData['history'];
  cpr?: CPRLevels | null;
  showEMA?: boolean;
  showCPR?: boolean;
  showVolume?: boolean;
  emaData?: { time: string; value: number }[];
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  data,
  cpr,
  showEMA = true,
  showCPR = true,
  showVolume = true,
  emaData
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' }, // Slate 900
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // 2. Add Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', 
      downColor: '#ef4444', 
      borderVisible: false, 
      wickUpColor: '#10b981', 
      wickDownColor: '#ef4444' 
    });

    // Daily bars key by date string; intraday bars carry epoch seconds
    // (date strings only resolve to a day, so intraday needs the epoch).
    const timeOf = (d: (typeof data)[number]) => (d.epoch ?? d.date) as any;

    const candleData = data.map(d => ({
      time: timeOf(d),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candleSeries.setData(candleData);

    // 3. Add Volume Series (Overlay)
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: '', // Overlay mode
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      const volData = data.map(d => ({
        time: timeOf(d),
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeries.setData(volData);
    }

    // 4. Add EMA 20
    if (showEMA && emaData) {
      const emaSeries = chart.addLineSeries({
        color: '#f59e0b', // Amber 500
        lineWidth: 2,
        title: 'EMA 20'
      });
      emaSeries.setData(emaData);
    }

    // 5. Add CPR Levels (Pivot, TC, BC)
    // Lightweight charts renders series. We can use LineSeries for levels.
    // Since CPR is typically daily, we plot horizontal lines for the visible range or just duplicate the level for all dates.
    // For demo simplicity, we assume the CPR provided is valid for the *entire visible range* or the last day. 
    // Ideally CPR changes daily. Here we just project the LATEST CPR as reference lines across the chart (standard intraday view practice).
    if (showCPR && cpr) {
       const createLevel = (price: number, color: string, style: number, title: string) => {
         const line = chart.addLineSeries({
             color: color,
             lineWidth: 1,
             lineStyle: style, // 0 = Solid, 1 = Dotted, 2 = Dashed
             title: title,
             priceLineVisible: false,
             crosshairMarkerVisible: false,
         });
         // Project level across all data points
         const lineData = data.map(d => ({ time: timeOf(d), value: price }));
         line.setData(lineData);
         return line;
       };

       createLevel(cpr.pivot, '#d8b4fe', 0, 'Pivot'); // Purple
       createLevel(cpr.tc, '#818cf8', 2, 'TC');    // Indigo dashed
       createLevel(cpr.bc, '#818cf8', 2, 'BC');    // Indigo dashed
    }

    // 6. Crosshair OHLC readout (TradingView-style top-left legend).
    // Direct DOM writes on crosshair moves — no React re-render per pixel.
    const barByTime = new Map(data.map(d => [String(timeOf(d)), d]));
    const renderLegend = (d?: (typeof data)[number]) => {
      const el = legendRef.current;
      if (!el) return;
      const bar = d ?? data[data.length - 1];
      if (!bar) {
        el.textContent = '';
        return;
      }
      const change = bar.close - bar.open;
      const pct = bar.open > 0 ? (change / bar.open) * 100 : 0;
      const tone = change >= 0 ? '#10b981' : '#ef4444';
      el.innerHTML =
        `<span style="color:#94a3b8">${bar.date}</span>` +
        `  O <span style="color:${tone}">${bar.open.toFixed(2)}</span>` +
        `  H <span style="color:${tone}">${bar.high.toFixed(2)}</span>` +
        `  L <span style="color:${tone}">${bar.low.toFixed(2)}</span>` +
        `  C <span style="color:${tone}">${bar.close.toFixed(2)}</span>` +
        `  <span style="color:${tone}">${change >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>` +
        (bar.volume ? `  <span style="color:#64748b">Vol ${(bar.volume / 1000).toFixed(0)}K</span>` : '');
    };
    renderLegend();
    chart.subscribeCrosshairMove(param => {
      const time = param?.time as string | number | undefined;
      renderLegend(time !== undefined ? barByTime.get(String(time)) : undefined);
    });

    // Handle Resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, cpr, showEMA, showCPR, showVolume, emaData]);

  return (
    <div className="relative">
      <div
        ref={legendRef}
        className="absolute top-2 left-3 z-10 text-[11px] font-mono whitespace-pre pointer-events-none"
      />
      <div ref={chartContainerRef} className="w-full h-[500px]" />
    </div>
  );
};
