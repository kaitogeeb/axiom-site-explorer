import { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string;
}

export const TradingViewChart = memo(({ symbol }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const containerId = `tradingview-chart-${symbol.replace(/:/g, '-')}`;

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';
    widgetRef.current = null;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && containerRef.current) {
        widgetRef.current = new window.TradingView.widget({
          width: '100%',
          height: '100%',
          symbol: symbol,
          interval: '15',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: 'rgba(15, 15, 25, 0.8)',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          backgroundColor: 'rgba(15, 15, 25, 0.4)',
          gridColor: 'rgba(255, 255, 255, 0.06)',
          hide_side_toolbar: false,
          allow_symbol_change: true,
          studies: [
            'STD;SMA'
          ],
          overrides: {
            'paneProperties.background': 'rgba(15, 15, 25, 0.4)',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.06)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.06)',
            'mainSeriesProperties.candleStyle.upColor': 'hsl(195, 100%, 60%)',
            'mainSeriesProperties.candleStyle.downColor': 'hsl(270, 100%, 65%)',
            'mainSeriesProperties.candleStyle.borderUpColor': 'hsl(195, 100%, 60%)',
            'mainSeriesProperties.candleStyle.borderDownColor': 'hsl(270, 100%, 65%)',
            'mainSeriesProperties.candleStyle.wickUpColor': 'hsl(195, 100%, 60%)',
            'mainSeriesProperties.candleStyle.wickDownColor': 'hsl(270, 100%, 65%)',
          }
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (widgetRef.current && widgetRef.current.remove) {
        widgetRef.current.remove();
      }
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [symbol, containerId]);

  return (
    <div className="w-full h-full min-h-[500px] lg:min-h-[600px] glass-card rounded-2xl overflow-hidden">
      <div
        id={containerId}
        ref={containerRef}
        className="w-full h-full min-h-[500px] lg:min-h-[600px]"
      />
    </div>
  );
});

TradingViewChart.displayName = 'TradingViewChart';

// Extend Window interface for TradingView
declare global {
  interface Window {
    TradingView: any;
  }
}
