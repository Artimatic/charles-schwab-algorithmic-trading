const currentList = [
  // --- Benchmark ETFs ---
  'SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLU', 'HYG', 'SLV', 'GLD', 'IBIT', 'SOXL', 'TLT',

  // --- Tech / Semi / AI Infrastructure ---
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD', 'AVGO', 'TSM', 'QCOM',
  'AMAT', 'LRCX', 'ADI', 'MU', 'INTC', 'MRVL', 'SMCI', 'TXN', 'KLAC', 'MCHP',
  'ORCL', 'CRM', 'NOW', 'ADBE', 'PANW', 'CRWD', 'NET', 'OKTA', 'SNOW', 'PLTR',
  'DDOG', 'ZS', 'FTNT', 'DELL', 'ANET', 'VRT', 'GLW', 'COHR',

  // --- Financials & Fintech ---
  'JPM', 'BAC', 'C', 'WFC', 'GS', 'MS', 'BLK', 'BX', 'APO', 'KKR', 'SCHW',
  'CME', 'SPGI', 'AXP', 'V', 'MA', 'PYPL', 'SQ', 'COIN', 'HOOD', 'SOFI', 'AFRM', 'COF',

  // --- Healthcare & Biotech ---
  'LLY', 'NVO', 'UNH', 'JNJ', 'PFE', 'ABBV', 'MRK', 'BMY', 'GILD', 'AMGN',
  'TMO', 'ABT', 'MDT', 'SYK', 'VRTX', 'DHR', 'ISRG', 'BSX', 'MRNA', 'REGN',

  // --- Consumer Discretionary & Retail ---
  'TSLA', 'WMT', 'COST', 'TGT', 'HD', 'LOW', 'MCD', 'SBUX', 'NKE', 'AMZN',
  'BKNG', 'SHOP', 'DASH', 'UBER', 'CAVA', 'CELH', 'LULU', 'CVNA', 'CMG',

  // --- Industrial, Aerospace & Energy Infrastructure ---
  'CAT', 'DE', 'GE', 'HON', 'ETN', 'PWR', 'RTX', 'LMT', 'NOC', 'BA', 'UNP',
  'UPS', 'FDX', 'MMM', 'EMR', 'RKLB', 'ASTS',

  // --- Energy, Utilities & Nuclear/Power ---
  'XOM', 'CVX', 'COP', 'OXY', 'SLB', 'HAL', 'DVN', 'EQT', 'CCJ', 'NEE', 'VST', 'CEG',

  // --- Consumer Staples & Communications ---
  'PG', 'KO', 'PEP', 'CL', 'COST', 'MO', 'PM', 'DIS', 'NFLX', 'TMUS', 'T', 'VZ', 'CMCSA'
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