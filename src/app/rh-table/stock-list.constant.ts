const currentList = [
  // --- Benchmark / Macro / Leveraged ETFs ---
  'SPY', 'QQQ', 'IWM', 'DIA',
  'VO',              // NEW: mid-cap (S&P 400 / Vanguard Mid-Cap) — fills the size gap
  'XLF', 'XLE', 'XLU', 'XLB',
  'XLI', 'XLV', 'XLP', 'XLY', 'XLK', 'XLC', 'XLRE',  // NEW: completes all 11 sector SPDRs
  'HYG', 'SLV', 'GLD', 'IBIT',
  'ETHA',            // NEW: Ethereum — crypto beyond BTC
  'SOXL', 'TLT',
  'SGOV',            // NEW: 0-3mo T-bills — cash proxy

  // --- Tech / Semi / AI Infrastructure ---
  'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'AVGO', 'TSM', 'QCOM',
  'AMAT', 'LRCX', 'ADI', 'MU', 'INTC', 'MRVL', 'SMCI', 'TXN', 'KLAC', 'MCHP',
  'ASML',            // NEW: the other irreplaceable semi name (lithography monopoly)
  'ORCL', 'CRM', 'NOW', 'ADBE', 'PANW', 'CRWD', 'NET', 'OKTA', 'SNOW', 'PLTR',
  'DDOG', 'ZS', 'FTNT', 'DELL', 'ANET', 'VRT', 'GLW', 'COHR',

  // --- Financials & Fintech ---
  'JPM', 'BAC', 'C', 'WFC', 'GS', 'MS', 'BLK', 'BX', 'APO', 'KKR', 'SCHW',
  'BRK.B',           // NEW: Berkshire — the biggest missing large-cap in the list
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

  // --- International single names ---
  'BABA',            // NEW: China tech — your only EM single name beyond TSM/NVO

  // --- Industrial, Aerospace & Energy Infrastructure ---
  'CAT', 'DE', 'GE', 'HON', 'ETN', 'PWR', 'RTX', 'LMT', 'NOC', 'BA', 'UNP',
  'UPS', 'FDX', 'MMM', 'EMR', 'RKLB', 'ASTS',

  // --- Energy, Utilities & Nuclear/Power ---
  'XOM', 'CVX', 'COP', 'OXY', 'SLB', 'HAL', 'DVN', 'EQT', 'CCJ', 'NEE', 'VST', 'CEG',
  'DUK', 'SO',        // NEW: your own watched utilities — were missing from the universe
  'GEV', 'TLN', 'NRG', // NEW: AI-power theme (grid/merchant power) alongside CEG/VST

  // --- Materials ---
  'LIN',             // NEW: Linde — the large-cap materials name the list lacked

  // --- Materials, Real Estate, Core Bonds, TIPS, Intl, Factors, Midstream ---
  'XLB', 'VNQ',           // Materials + U.S. REITs (SCHH dropped — near-duplicate of VNQ)
  'VNQI',                 // NEW: international REITs
  'AGG', 'TIP',           // Core aggregate bonds + inflation protection
  'SHY', 'IEF',           // NEW: short + intermediate Treasuries — fixes the duration gap
  'LQD', 'MUB', 'BNDX',   // NEW: IG corporates, munis, international bonds
  'VEA', 'IEMG',          // Developed ex-U.S. + Emerging Markets
  'VSS',                  // NEW: international small-cap
  'EWJ', 'INDA', 'MCHI',  // NEW: Japan, India, China single-country
  'SCHD', 'QUAL', 'VBR',  // Dividend/quality + small-cap value
  'MTUM', 'USMV',         // NEW: momentum + minimum-volatility factors
  'PFF',                  // NEW: preferreds — income with equity-like behavior
  'DBC', 'USO', 'CPER', 'DBA',  // NEW: broad commodities, oil, copper, agriculture
  'MLPX'                  // Midstream (MLPA dropped — same exposure, MLPX avoids the K-1)
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