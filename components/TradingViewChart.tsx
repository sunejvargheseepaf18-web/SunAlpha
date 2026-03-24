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

    const candleData = data.map(d => ({
      time: d.date,
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
        time: d.date,
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
         const lineData = data.map(d => ({ time: d.date, value: price }));
         line.setData(lineData);
         return line;
       };

       createLevel(cpr.pivot, '#d8b4fe', 0, 'Pivot'); // Purple
       createLevel(cpr.tc, '#818cf8', 2, 'TC');    // Indigo dashed
       createLevel(cpr.bc, '#818cf8', 2, 'BC');    // Indigo dashed
    }

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

  return <div ref={chartContainerRef} className="w-full h-[500px]" />;
};
