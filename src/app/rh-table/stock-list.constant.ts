const currentList = [
  // --- Benchmark / Macro / Leveraged ETFs ---
  'SPY', 'QQQ', 'IWM', 'DIA',
  'XLF', 'XLE', 'XLU',
  'HYG', 'SLV', 'GLD', 'IBIT', 'SOXL', 'TLT',

  // --- Tech / Semi / AI Infrastructure ---
  'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'AVGO', 'TSM', 'QCOM',
  'AMAT', 'LRCX', 'ADI', 'MU', 'INTC', 'MRVL', 'SMCI', 'TXN', 'KLAC', 'MCHP',
  'ORCL', 'CRM', 'NOW', 'ADBE', 'PANW', 'CRWD', 'NET', 'OKTA', 'SNOW', 'PLTR',
  'DDOG', 'ZS', 'FTNT', 'DELL', 'ANET', 'VRT', 'GLW', 'COHR',

  // --- Financials & Fintech ---
  'JPM', 'BAC', 'C', 'WFC', 'GS', 'MS', 'BLK', 'BX', 'APO', 'KKR', 'SCHW',
  'CME', 'SPGI', 'AXP', 'V', 'MA', 'PYPL', 'XYZ', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'COF',

  // --- Healthcare & Biotech ---
  'LLY', 'NVO', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'BMY', 'GILD', 'AMGN',
  'TMO', 'ABT', 'MDT', 'SYK', 'VRTX', 'DHR', 'ISRG', 'BSX', 'MRNA', 'REGN',

  // --- Consumer Discretionary & Retail ---
  'TSLA', 'HD', 'LOW', 'MCD', 'SBUX', 'NKE', 'AMZN',
  'BKNG', 'SHOP', 'DASH', 'UBER', 'CAVA', 'CELH', 'LULU', 'CVNA', 'CMG',

  // --- Consumer Staples ---
  'PG', 'KO', 'PEP', 'CL', 'COST', 'MO', 'PM', 'WMT', 'TGT',

  // --- Communications ---
  'DIS', 'NFLX', 'TMUS', 'T', 'VZ', 'CMCSA',

  // --- Industrial, Aerospace & Energy Infrastructure ---
  'CAT', 'DE', 'GE', 'HON', 'ETN', 'PWR', 'RTX', 'LMT', 'NOC', 'BA', 'UNP',
  'UPS', 'FDX', 'MMM', 'EMR', 'RKLB', 'ASTS',

  // --- Energy, Utilities & Nuclear/Power ---
  'XOM', 'CVX', 'COP', 'OXY', 'SLB', 'HAL', 'DVN', 'EQT', 'CCJ', 'NEE', 'VST', 'CEG',

  // --- Missing Exposures: Materials, Real Estate, Core Bonds, TIPS, Intl, Factors, Midstream ---
  'XLB', 'VNQ', 'SCHH',           // Materials + U.S. REITs
  'AGG', 'TIP',                   // Core aggregate bonds + inflation protection
  'VEA', 'IEMG',                  // Developed ex-U.S. + Emerging Markets
  'SCHD', 'QUAL', 'VBR',          // Dividend/quality + small-cap value
  'MLPA', 'MLPX'                  // Midstream energy infrastructure
];

const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;

    while (currentIndex > 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
};

export const CurrentStockList = shuffle(currentList).map(s => {
    return { ticker: s };
});

export const LongTermBuyList = [];
export const ShortTermBuyList = [];