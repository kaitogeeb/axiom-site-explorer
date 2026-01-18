// Map Solana token symbols to TradingView trading pairs
export const TOKEN_TO_TRADINGVIEW_SYMBOL: Record<string, string> = {
  // Major tokens
  'SOL': 'BINANCE:SOLUSDT',
  'USDC': 'BINANCE:USDCUSDT',
  'USDT': 'BINANCE:USDTUSD',

  // Wrapped tokens
  'BTC': 'BINANCE:BTCUSDT',
  'WBTC': 'BINANCE:BTCUSDT',
  'ETH': 'BINANCE:ETHUSDT',
  'WETH': 'BINANCE:ETHUSDT',

  // Popular Solana tokens
  'BONK': 'BINANCE:BONKUSDT',
  'JUP': 'BYBIT:JUPUSDT',
  'ORCA': 'MEXC:ORCAUSDT',
  'RAY': 'BINANCE:RAYUSDT',
  'WIF': 'BYBIT:WIFUSDT',
  'JTO': 'BINANCE:JTOUSDT',
  'PYTH': 'BINANCE:PYTHUSDT',
  'MNGO': 'MEXC:MNGOUSDT',

  // Stablecoins
  'USDS': 'BINANCE:USDCUSDT',
  'DAI': 'BINANCE:DAIUSDT',
  'BUSD': 'BINANCE:BUSDUSDT',

  // DeFi tokens
  'SRM': 'BINANCE:SRMUSDT',
  'FIDA': 'MEXC:FIDAUSDT',
  'COPE': 'MEXC:COPEUSDT',
  'STEP': 'MEXC:STEPUSDT',
};

// Map token symbol to TradingView pair, with fallback to SOL
export const mapTokenToTradingView = (symbol: string): string => {
  const normalized = symbol.toUpperCase();
  return TOKEN_TO_TRADINGVIEW_SYMBOL[normalized] || 'BINANCE:SOLUSDT';
};

// Get display name for the chart
export const getChartDisplayName = (symbol: string): string => {
  return mapTokenToTradingView(symbol).split(':')[1] || 'SOLUSDT';
};
