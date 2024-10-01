const fullList = [
    'RDDT',
    'AAPL',
    'MSFT',
    'GOOG',
    'TSLA',
    'AMZN',
    'META',
    'JNJ',
    'NVDA',
    'XOM',
    'JPM',
    'WMT',
    'CVX',
    'PFE',
    'BAC',
    'PANW',
    'KO',
    'VZ',
    'ORCL',
    'ADBE',
    'CSCO',
    'ANET',
    'HOOD',
    'DIS',
    'MCD',
    'NKE',
    'BMY',
    'INTC',
    'QCOM',
    'AMD',
    'RTX',
    'SCHW',
    'C',
    'PYPL',
    'SBUX',
    'MO',
    'MMM',
    'DUK',
    'GILD',
    'TGT',
    'MU',
    'TFC',
    'FDX',
    'OXY',
    'BSX',
    'FCX',
    'NVO',
    'GM',
    'F',
    'UBER',
    'MRVL',
    'BOX',
    'NTNX',,
    'SHAK',
    'CL',
    'PEP',
    'BUD',
    'GIS',
    'COF',
    'GS',
    'MRNA',
    'VEEV',
    'COIN',
    'BA',
    'NFLX',
    'VOYA',
    'SWKS',
    'SNOW',
    'KMI',
    'WBD',
    'LULU',
    'HLT',
    'HAL',
    'CAVA',
    'CARR',
    'TSN',
    'LEN',
    'HPE',
    'PLTR',
    'EXPE',
    'BBY',
    'TTD',
    'WDC',
    'CAG',
    'SWKS',
    'HUBS',
    'TER',
    'NET',
    'STLD',
    'CPB',
    'OKTA',
    'MGM',
    'PINS',
    'UAL',
    'LLY',
    'DT',
    'U',
    'CCL',
    'CLF',
    'AAL',
    'BJ',
    'SPOT',
    'S',
    'TSM',
    'AVGO',
    'CRM',
    'ACN',
    'INTU',
    'AMAT',
    'LRCX',
    'ADI',
    'KLAC',
    'V',
    'MA',
    'SHOP',
    'MDB',
    'KMB',
    'DAL',
    'DBX',
    'TMUS',
    'TWLO',
    'MTCH',
    'Z',
    'EA',
    'SLB',
    'WD',
    'VRTS',
    'UNH',
    'ABBV',
    'TMO',
    'ISRG',
    'ELV',
    'VRTX',
    'REGN',
    'RGEN',
    'HD',
    'LOW',
    'ULTA',
    'DPZ',
    'BLD',
    'FIVE',
    'AXP',
    'CRMT',
    'COST',
    'COKE',
    'CHTR',
    'DASH',
    'NUE'];

export const CurrentStockList = fullList.map(s => {
    return { ticker: s };
});

export const LongTermBuyList = [];
export const ShortTermBuyList = [];