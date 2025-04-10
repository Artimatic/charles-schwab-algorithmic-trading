const fullList = [
    'APO',
    'BABA',
    'GEV',
    'ET',
    'EQT',
    'CPNG',
    'TNL',
    'VST',
    'VRT',
    'RDDT',
    'AAPL',
    'MSFT',
    'GOOGL',
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
    'CYBR',
    'NVO',
    'GM',
    'UBER',
    'MRVL',
    'BOX',
    'NTNX',
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
    'CAT',
    'CAVA',
    'CARR',
    'TSN',
    'LEN',
    'SE',
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
    'APP',
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
    'ZIM',
    'Z',
    'SLB',
    'WD',
    'VRTS',
    'UPS',
    'UNH',
    'ABBV',
    'TMO',
    'ISRG',
    'ELV',
    'VRTX',
    'LMT',
    'RGEN',
    'HD',
    'LOW',
    'ULTA',
    'DPZ',
    'BLD',
    'FIVE',
    'AXP',
    'COST',
    'COKE',
    'UNP',
    'CHTR',
    'DASH',
    'NUE',
    'DELL'];

const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;

    while (currentIndex > 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
};

export const CurrentStockList = shuffle(fullList).map(s => {
    return { ticker: s };
});

export const LongTermBuyList = [];
export const ShortTermBuyList = [];