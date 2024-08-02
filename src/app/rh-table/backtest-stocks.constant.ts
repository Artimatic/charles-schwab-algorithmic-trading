import { AlgoParam } from '../shared';
import * as moment from 'moment';

const start = moment().format('YYYY-MM-DD');
const end = moment().subtract(500, 'days').format('YYYY-MM-DD');

export function createParam(ticker: string): AlgoParam {
  return {
    ticker,
    start,
    end
  };
}

export const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;

  while (currentIndex > 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
};

const oldList = [
  'RKLB',
  'SPY',
  'QQQ',
  'AAPL',
  'MSFT',
  'GOOG',
  'GOOGL',
  'AMZN',
  'TSLA',
  'META',
  'JNJ',
  'UNH',
  'NVDA',
  'V',
  'XOM',
  'JPM',
  'WMT',
  'PG',
  'MA',
  'CVX',
  'HD',
  'LLY',
  'PFE',
  'BAC',
  'KO',
  'ABBV',
  'PEP',
  'MRK',
  'AVGO',
  'VZ',
  'COST',
  'TMO',
  'ORCL',
  'ADBE',
  'ACN',
  'ABT',
  'CSCO',
  'DHR',
  'DIS',
  'MCD',
  'NKE',
  'CMCSA',
  'CRM',
  'TMUS',
  'BMY',
  'INTC',
  'UPS',
  'WFC',
  'PM',
  'LIN',
  'TXN',
  'NEE',
  'QCOM',
  'AMD',
  'T',
  'RTX',
  'MS',
  'COP',
  'UNP',
  'HON',
  'AMGN',
  'IBM',
  'SCHW',
  'CVS',
  'MDT',
  'BX',
  'LOW',
  'AMT',
  'SPGI',
  'LMT',
  'CAT',
  'AXP',
  'INTU',
  'GS',
  'DE',
  'C',
  'BLK',
  'NOW',
  'PYPL',
  'EL',
  'PLD',
  'ADP',
  'SBUX',
  'ENB',
  'BA',
  'AMAT',
  'CB',
  'MO',
  'MDLZ',
  'BKNG',
  'NFLX',
  'CHTR',
  'CI',
  'MMM',
  'ADI',
  'CNI',
  'DUK',
  'ZTS',
  'GE',
  'SYK',
  'MMC',
  'GILD',
  'CME',
  'SO',
  'ISRG',
  'CCI',
  'USB',
  'NOC',
  'EOG',
  'TGT',
  'TJX',
  'BDX',
  'PGR',
  'VRTX',
  'CSX',
  'MU',
  'PNC',
  'TFC',
  'CL',
  'REGN',
  'FDX',
  'D',
  'LRCX',
  'SHW',
  'WM',
  'PXD',
  'GD',
  'ITW',
  'EQIX',
  'FIS',
  'SLB',
  'NSC',
  'EW',
  'OXY',
  'HUM',
  'AON',
  'ICE',
  'DG',
  'EPD',
  'APD',
  'PSA',
  'ETN',
  'HCA',
  'MET',
  'BSX',
  'MPC',
  'FCX',
  'MRNA',
  'MAR',
  'EMR',
  'NEM',
  'VLO',
  'KDP',
  'KLAC',
  'PANW',
  'GM',
  'MCO',
  'TRI',
  'MNST',
  'PSX',
  'F',
  'SNPS',
  'AEP',
  'ADM',
  'CNC',
  'TEAM',
  'SRE',
  'FTNT',
  'SCCO',
  'MCK',
  'DVN',
  'KHC',
  'ECL',
  'UBER',
  'STZ',
  'DOW',
  'NXPI',
  'LHX',
  'COF',
  'PAYX',
  'AIG',
  'CTVA',
  'ROP',
  'EXC',
  'KMB',
  'HSY',
  'KKR',
  'MRVL',
  'CDNS',
  'SYY',
  'GIS',
  'AZO',
  'SNOW',
  'TRV',
  'ORLY',
  'RSG',
  'IQV',
  'O',
  'KMI',
  'APH',
  'WMB',
  'TEL',
  'CRWD',
  'CTAS',
  'ADSK',
  'EA',
  'DLR',
  'WDAY',
  'KR',
  'WELL',
  'PRU',
  'SQ',
  'XEL',
  'A',
  'CMG',
  'AFL',
  'HPQ',
  'WBD',
  'DLTR',
  'DELL',
  'CTSH',
  'LULU',
  'WBA',
  'BK',
  'HLT',
  'JCI',
  'MSI',
  'ALL',
  'HES',
  'MCHP',
  'MSCI',
  'PH',
  'ILMN',
  'BAX',
  'SBAC',
  'AJG',
  'ZM',
  'LNG',
  'YUM',
  'SPG',
  'LYB',
  'HAL',
  'BKR',
  'GPN',
  'ED',
  'NUE',
  'CARR',
  'TSN',
  'DD',
  'OTIS',
  'MTB',
  'TT',
  'TDG',
  'PCAR',
  'PEG',
  'IFF',
  'ANET',
  'WEC',
  'RMD',
  'BIIB',
  'IDXX',
  'FAST',
  'VICI',
  'FWONA',
  'VEEV',
  'APO',
  'DDOG',
  'CMI',
  'PPG',
  'AMP',
  'GLW',
  'DFS',
  'ODFL',
  'ES',
  'ROST',
  'MTD',
  'PCG',
  'LSXMA',
  'AVB',
  'EQR',
  'WY',
  'AME',
  'DASH',
  'OKE',
  'TROW',
  'VRSK',
  'CPRT',
  'NDAQ',
  'LVS',
  'GFS',
  'APTV',
  'SIVB',
  'EBAY',
  'HRL',
  'RIVN',
  'ON',
  'ALB',
  'AWK',
  'KEYS',
  'AZPN',
  'FANG',
  'FITB',
  'STT',
  'RPRX',
  'IBKR',
  'GWW',
  'ROK',
  'CTRA',
  'ENPH',
  'TTD',
  'EIX',
  'CBRE',
  'DTE',
  'SIRI',
  'K',
  'DHI',
  'CSGP',
  'MKC',
  'TSCO',
  'ZBH',
  'ARE',
  'CDW',
  'MTCH',
  'EFX',
  'EXR',
  'WST',
  'LUV',
  'HIG',
  'ETR',
  'WTW',
  'AEE',
  'ULTA',
  'INVH',
  'FE',
  'BALL',
  'AVTR',
  'LH',
  'SPOT',
  'ANSS',
  'TTWO',
  'ZS',
  'NTRS',
  'CHD',
  'FTV',
  'VMC',
  'DAL',
  'VTR',
  'LEN',
  'RJF',
  'STE',
  'WAT',
  'MLM',
  'CEG',
  'PPL',
  'CF',
  'LYV',
  'MPWR',
  'SUI',
  'MAA',
  'MRO',
  'URI',
  'IT',
  'GPC',
  'CINF',
  'CTLT',
  'MOS',
  'ALGN',
  'CFG',
  'GRMN',
  'AMCR',
  'RF',
  'FOXA',
  'WRB',
  'HBAN',
  'HPE',
  'CMS',
  'IR',
  'DOV',
  'VFC',
  'VRSN',
  'CNP',
  'FOX',
  'LBRDA',
  'MKL',
  'MDB',
  'HOLX',
  'TDY',
  'YUMC',
  'EPAM',
  'PWR',
  'PFG',
  'KEY',
  'ARES',
  'FLT',
  'AGR',
  'ALNY',
  'JBHT',
  'EXPD',
  'ESS',
  'PLTR',
  'SWK',
  'PARA',
  'IP',
  'PAYC',
  'ACGL',
  'EXPE',
  'BR',
  'BBY',
  'ROL',
  'ZBRA',
  'WAB',
  'TW',
  'HEI',
  'J',
  'BG',
  'SYF',
  'INCY',
  'TWLO',
  'DGX',
  'WPC',
  'LBRDK',
  'TRU',
  'BRO',
  'COO',
  'UI',
  'CLX',
  'WDC',
  'GNRC',
  'LPLA',
  'CAG',
  'DOCU',
  'MOH',
  'SWKS',
  'TRGP',
  'ATO',
  'ACI',
  'HUBS',
  'TRMB',
  'BIO',
  'TER',
  'APA',
  'SSNC',
  'SPLK',
  'POOL',
  'DRI',
  'AKAM',
  'KMX',
  'EQT',
  'L',
  'NTAP',
  'CE',
  'BXP',
  'NET',
  'EVRG',
  'DPZ',
  'LNT',
  'WLK',
  'CPT',
  'UDR',
  'IRM',
  'STLD',
  'PKG',
  'PODD',
  'BMRN',
  'CPB',
  'IEX',
  'LKQ',
  'RKT',
  'XYL',
  'CAH',
  'FDS',
  'TECH',
  'FMC',
  'HWM',
  'LDOS',
  'SJM',
  'TXT',
  'ELS',
  'PEAK',
  'AES',
  'OVV',
  'OKTA',
  'OMC',
  'TYL',
  'ENTG',
  'VTRS',
  'CHRW',
  'AVY',
  'HST',
  'JKHY',
  'MGM',
  'NVR',
  'BEPC',
  'CSL',
  'DAR',
  'PINS',
  'PTC',
  'FWONK',
  'BEN',
  'TPL',
  'CG',
  'EMN',
  'CBOE',
  'KIM',
  'ROKU',
  'TFX',
  'BILL',
  'UAL',
  'CCK',
  'AR',
  'NDSN',
  'MAS',
  'CNA',
  'AMH',
  'HAS',
  'AFG',
  'ALLY',
  'SBNY',
  'FHN',
  'NI',
  'WRK',
  'TAP',
  'DT',
  'IPG',
  'GLPI',
  'WTRG',
  'U',
  'DINO',
  'GDDY',
  'BAH',
  'CHK',
  'CRL',
  'SNA',
  'LUMN',
  'CCL',
  'RS',
  'AAP',
  'BHVN',
  'BURL',
  'QRVO',
  'FNF',
  'EQH',
  'RPM',
  'HSIC',
  'SCI',
  'MKTX',
  'ELAN',
  'QGEN',
  'CMA',
  'REG',
  'VST',
  'MORN',
  'FCNCA',
  'GGG',
  'UTHR',
  'REXR',
  'FICO',
  'DOX',
  'RCL',
  'ETSY',
  'GME',
  'BLDR',
  'HUBB',
  'EWBC',
  'AIZ',
  'CLF',
  'FFIV',
  'LW',
  'OLPX',
  'GL',
  'NWSA',
  'NWS',
  'JNPR',
  'BSY',
  'BRKR',
  'UHAL',
  'CUBE',
  'NRG',
  'PHM',
  'WSO',
  'H',
  'SNX',
  'RHI',
  'LAMR',
  'JAZZ',
  'CZR',
  'CLVT',
  'ACM',
  'PCTY',
  'MTN',
  'NBIX',
  'AOS',
  'PLUG',
  'NLY',
  'MPW',
  'WHR',
  'ALLE',
  'LNC',
  'OGN',
  'NFE',
  'SEE',
  'DVA',
  'RGEN',
  'AGCO',
  'AAL',
  'SWN',
  'WSM',
  'BWA',
  'UGI',
  'PAG',
  'HII',
  'ZION',
  'RRC',
  'TPR',
  'WMS',
  'TTC',
  'CAR',
  'ERIE',
  'BJ',
  'WAL',
  'MHK',
  'WBS',
  'OLN',
  'JLL',
  'LSXMK',
  'LAD',
  'CBSH',
  'OC',
  'G',
  'CFR',
  'UHS',
  'RRX',
  'MAT',
  'NWL',
  'ARMK',
  'FRT',
  'JBL',
  'BBWI',
  'XRAY',
  'COLD',
  'DBX',
  'IVZ',
  'PNW',
  'LEA',
  'AGL',
  'PNR',
  'CNXC',
  'KNX',
  'PSTG',
  'RGA',
  'WOLF',
  'ZG',
  'CGNX',
  'LECO',
  'ARW',
  'GLOB',
  'SEIC',
  'DXC',
  'PPC',
  'DLB',
  'CABO',
  'WSC',
  'MANH',
  'NNN',
  'CDAY',
  'OGE',
  'CHDN',
  'MIDD',
  'NOV',
  'IAC',
  'MRVI',
  'RGLD',
  'CASY',
  'BERY',
  'FND',
  'LII',
  'MASI',
  'WEX',
  'FSLR',
  'EXAS',
  'FIVE',
  'ORI',
  'DXCM',
  'WYNN',
  'MTDR',
  'ST',
  'UNM',
  'JEF',
  'NXST',
  'CHE',
  'DECK',
  'RNR',
  'CPRI',
  'TTEK',
  'CIEN',
  'COHR',
  'PCOR',
  'QDEL',
  'GNTX',
  'EGP',
  'OHI',
  'USFD',
  'WH',
  'AXON',
  'RL',
  'CACC',
  'LSCC',
  'HUN',
  'KBR',
  'FR',
  'CACI',
  'DNB',
  'AMC',
  'PB',
  'AIRC',
  'AN',
  'ATR',
  'PFGC',
  'SF',
  'ESTC',
  'NFG',
  'STWD',
  'VOYA',
  'GPK',
  'PII',
  'HALO',
  'TREX',
  'LFUS',
  'WU',
  'NVCR',
  'BRX',
  'GWRE',
  'ACHC',
  'FIVN',
  'DKS',
  'NVST',
  'MP',
  'BPOP',
  'RH',
  'EXEL',
  'ADT',
  'DCI',
  'WCC',
  'BYD',
  'GTLS',
  'KRC',
  'SKX',
  'MUR',
  'THC',
  'ITT',
  'PLNT',
  'MGY',
  'INGR',
  'CIVI',
  'FCN',
  'MKSI',
  'HQY',
  'AYI',
  'COTY',
  'XPO',
  'SRPT',
  'SWX',
  'UWMC',
  'SHC',
  'M',
  'STAG',
  'PNFP',
  'FAF',
  'GMED',
  'FFIN',
  'WWD',
  'SWAV',
  'GXO',
  'EHC',
  'BLD',
  'OSK',
  'PLTK',
  'MUSA',
  'VLY',
  'RYN',
  'SM',
  'Z',
  'MTZ',
  'CNM',
  'INFA',
  'VNO',
  'ASH',
  'HRB',
  'AGNC',
  'AXTA',
  'RCM',
  'LSTR',
  'NVT',
  'LITE',
  'BOKF',
  'KSS',
  'SNV',
  'ITCI',
  'AZTA',
  'X',
  'VVV',
  'REYN',
  'HLI',
  'FLO',
  'PRGO',
  'SITE',
  'LYFT',
  'MDU',
  'TENB',
  'SON',
  'ADC',
  'ALK',
  'EEFT',
  'CC',
  'COKE',
  'DDS',
  'GBCI',
  'VAC',
  'OLED',
  'RNG',
  'NYT',
  'EME',
  'BC',
  'CW',
  'TOL',
  'RLI',
  'DKNG',
  'IDA',
  'TDOC',
  'SAIA',
  'SAIC',
  'SLAB',
  'THG',
  'OMCL',
  'CR',
  'TXRH',
  'W',
  'HGV',
  'ROG',
  'VMI',
  'WOOF',
  'SYNA',
  'OPCH',
  'IONS',
  'DTM',
  'HOG',
  'KNSL',
  'QLYS',
  'LNW',
  'OZK',
  'CLH',
  'SEB',
  'LPX',
  'AMG',
  'ESI',
  'UBSI',
  'APLS',
  'IRT',
  'LEG',
  'AM',
  'RUN',
  'TWKS',
  'AXS',
  'OMF',
  'BWXT',
  'SIGI',
  'NCLH',
  'MSA',
  'WTFC',
  'ALKS',
  'BXMT',
  'CHPT',
  'POST',
  'INSP',
  'TGNA',
  'EXLS',
  'IPGP',
  'SLGN',
  'IART',
  'RHP',
  'CHX',
  'COLM',
  'HP',
  'PEN',
  'MEDP',
  'TNET',
  'TXG',
  'IRDM',
  'PBF',
  'AMN',
  'BKH',
  'PRI',
  'DRVN',
  'CMC',
  'BFAM',
  'CELH',
  'CADE',
  'DOCN',
  'SMG',
  'EXP',
  'TRNO',
  'UFPI',
  'EVR',
  'CUZ',
  'HOMB',
  'LNTH',
  'POWI',
  'NSA',
  'ALTR',
  'SLM',
  'ASGN',
  'ORA',
  'UAA',
  'ONB',
  'CVNA',
  'MSM',
  'TKR',
  'EXPO',
  'HXL',
  'OGS',
  'SFBS',
  'FIZZ',
  'HE',
  'HR',
  'AVT',
  'THO',
  'AMKR',
  'MAN',
  'UMBF',
  'NYCB',
  'SSD',
  'PVH',
  'JHG',
  'PINC',
  'CRUS',
  'NJR',
  'ENSG',
  'ATKR',
  'POR',
  'NOVT',
  'WTS',
  'BL',
  'VIRT',
  'ESNT',
  'ALGM',
  'JWN',
  'PSN',
  'DEI',
  'SNDR',
  'FIBK',
  'IGT',
  'AVNT',
  'SMAR',
  'QS',
  'PYCR',
  'ICUI',
  'SRCL',
  'HWC',
  'KRG',
  'PNM',
  'TPX',
  'GH',
  'FNB',
  'CRK',
  'TFSL',
  'BCPC',
  'DOC',
  'PEGA',
  'ESGR',
  'WEN',
  'ALSN',
  'HELE',
  'PECO',
  'MTG',
  'R',
  'FLR',
  'FLS',
  'CNX',
  'CVI',
  'TDC',
  'VNT',
  'GO',
  'LAZ',
  'MMS',
  'OLLI',
  'NTLA',
  'AWI',
  'WTM',
  'UA',
  'SAM',
  'SR',
  'CERE',
  'AIT',
  'KEX',
  'RPD',
  'YETI',
  'SPSC',
  'RRR',
  'INDB',
  'AMED',
  'TNDM',
  'AMBP',
  'SMPL',
  'BECN',
  'PK',
  'SITM',
  'MSGS',
  'ABG',
  'RARE',
  'GATX',
  'AL',
  'APLE',
  'PTEN',
  'APG',
  'VRT',
  'HIW',
  'ONTO',
  'TNL',
  'JBT',
  'CBT',
  'HBI',
  'GPS',
  'WIX',
  'AGO',
  'MPLN',
  'NSP',
  'SMTC',
  'HLNE',
  'DV',
  'CWST',
  'CVBF',
  'ZWS',
  'ZD',
  'AEL',
  'BPMC',
  'ASAN',
  'BNL',
  'WHD',
  'NCNO',
  'WK',
  'EPR',
  'CBU',
  'VRNS',
  'FUL',
  'LANC',
  'CRC',
  'EBC',
  'CYTK',
  'NTRA',
  'GTES',
  'IRTC',
  'CWK',
  'BOX',
  'MCW',
  'FELE',
  'GT',
  'CPE',
  'RDN',
  'PCH',
  'BTU',
  'KOS',
  'MRCY',
  'BIPC',
  'SXT',
  'ACAD',
  'AYX',
  'MTSI',
  'SPB',
  'ENOV',
  'HAYW',
  'NTNX',
  'NSIT',
  'BRBR',
  'CNS',
  'OPEN',
  'VIR',
  'PRFT',
  'BHF',
  'ARWR',
  'SLG',
  'KRTX',
  'LIVN',
  'HASI',
  'CROX',
  'SEAS',
  'NARI',
  'IIPR',
  'APPF',
  'STAA',
  'NEU',
  'BANF',
  'FCFS',
  'SPR',
  'SBRA',
  'PZZA',
  'HAE',
  'REZI',
  'FOXF',
  'MATX',
  'EQC',
  'VIAV',
  'ALE',
  'DORM',
  'UCBI',
  'WD',
  'SHLS',
  'JAMF',
  'DIOD',
  'NVAX',
  'HRI',
  'APPN',
  'MLI',
  'UNF',
  'BE',
  'KFY',
  'ETRN',
  'OAS',
  'NWE',
  'SIG',
  'KMPR',
  'CERT',
  'MMSI',
  'ALRM',
  'BKU',
  'LXP',
  'TTEC',
  'ADNT',
  'DH',
  'CATY',
  'BOH',
  'ENV',
  'SPWR',
  'ASO',
  'SFM',
  'SFNC',
  'SEM',
  'FHB',
  'JBGS',
  'IBTX',
  'AAON',
  'SUM',
  'UPST',
  'FN',
  'AVA',
  'GOLF',
  'DBRG',
  'CRI',
  'APAM',
  'HI',
  'MC',
  'ASB',
  'STEP',
  'NNI',
  'COOP',
  'PRVA',
  'DNLI',
  'SITC',
  'BLKB',
  'ABCB',
  'VC',
  'ESAB',
  'OUT',
  'ACIW',
  'VSCO',
  'FRPT',
  'PBH',
  'FIX',
  'GEF',
  'NHI',
  'INST',
  'LESL',
  'ARCH',
  'EPRT',
  'LOPE',
  'FORM',
  'FHI',
  'PDCO',
  'ATI',
  'FOUR',
  'RUSHA',
  'LBRT',
  'PPBI',
  'SPT',
  'FL',
  'SHOO',
  'SGRY',
  'MGEE',
  'LCII',
  'CCOI',
  'GPI',
  'TRIP',
  'GHC',
  'JBLU',
  'VRNT',
  'AEIS',
  'LZ',
  'MXL',
  'CVLT',
  'TMHC',
  'AZEK',
  'KLIC',
  'CVAC',
  'ABM',
  'BCO',
  'STNE',
  'TROX',
  'CARG',
  'BRP',
  'BCC',
  'FBP',
  'AWR',
  'OTTR',
  'CNMD',
  'WSFS',
  'CWT',
  'PJT',
  'AMBA',
  'VSH',
  'LTH',
  'BEAM',
  'CRGY',
  'MAIN',
  'TCBI',
  'KW',
  'SKY',
  'MTH',
  'IBOC',
  'HRMY',
  'DY',
  'PEB',
  'CWEN',
  'ETWO',
  'KWR',
  'NGVT',
  'NEOG',
  'EVH',
  'AGTI',
  'XRX',
  'NOG',
  'AIN',
  'WERN',
  'HUBG',
  'WDFC',
  'JOE',
  'PWSC',
  'USM',
  'ENS',
  'EVTC',
  'KBH',
  'HLF',
  'PCRX',
  'PGNY',
  'UPWK',
  'FSR',
  'MCY',
  'AMRC',
  'CPA',
  'NKLA',
  'SANM',
  'GLNG',
  'VRRM',
  'IBP',
  'SONO',
  'AUB',
  'FOLD',
  'JJSF',
  'VICR',
  'NTCT',
  'SPXC',
  'OI',
  'AXNX',
  'FWRD',
  'CLBK',
  'FULT',
  'BFH',
  'TRUP',
  'SHO',
  'BOOT',
  'TR',
  'UNIT',
  'RMBS',
  'COUR',
  'PFSI',
  'CRVL',
  'PSMT',
  'NAPA',
  'SMCI',
  'IOSP',
  'HL',
  'CALM',
  'UNFI',
  'OMI',
  'SAVE',
  'VSAT',
  'WING',
  'BRC',
  'ACA',
  'HPP',
  'CHGG',
  'FRME',
  'WIRE',
  'SAFE',
  'MDC',
  'FATE',
  'BDC',
  'SCL',
  'ATSG',
  'EYE',
  'COLB',
  'AHCO',
  'BMI',
  'NUS',
  'TELL',
  'KD',
  'DK',
  'ITGR',
  'CORT',
  'CENT',
  'GSAT',
  'CALX',
  'INSM',
  'ALGT',
  'KRO',
  'PRMW',
  'FSS',
  'PD',
  'PLXS',
  'CPK',
  'ATUS',
  'HTH',
  'DNUT',
  'RVLV',
  'AEO',
  'THS',
  'ARVN',
  'LFST',
  'AX',
  'ALHC',
  'TEX',
  'GOGO',
  'HAIN',
  'STGW',
  'MLKN',
  'IPAR',
  'CNO',
  'KMT',
  'PRGS',
  'TTGT',
  'WMK',
  'KAI',
  'MAC',
  'QTWO',
  'NOVA',
  'TOWN',
  'HLIO',
  'FCPT',
  'CSTM',
  'YELP',
  'MED',
  'DAN',
  'MGPI',
  'WOR',
  'EAF',
  'ABR',
  'RLJ',
  'FA',
  'ITRI',
  'STNG',
  'PIPR',
  'SAGE',
  'GKOS',
  'CBZ',
  'SBCF',
  'WAFD',
  'MTX',
  'THRM',
  'AVAV',
  'URBN',
  'NAVI',
  'AMEH',
  'ULCC',
  'LAUR',
  'NABL',
  'PTCT',
  'MSTR',
  'SSTK',
  'SABR',
  'TRN',
  'CBRL',
  'PRK',
  'DRH',
  'CWH',
  'KTB',
  'ROIC',
  'SI',
  'LGIH',
  'WSBC',
  'WRE',
  'TAL',
  'ENR',
  'IDCC',
  'CIM',
  'SLVM',
  'MSGE',
  'FRO',
  'SIX',
  'VSTO',
  'AI',
  'BANR',
  'MGRC',
  'FTDR',
  'FFBC',
  'FBK',
  'CSGS',
  'FROG',
  'ARCB',
  'GMS',
  'SWI',
  'CNK',
  'GNW',
  'TWST',
  'HTLF',
  'BCRX',
  'ARRY',
  'IRWD',
  'SDGR',
  'SASR',
  'RLAY',
  'NPO',
  'ACLS',
  'RAMP',
  'GTN',
  'EPC',
  'DOOR',
  'MWA',
  'EXPI',
  'XHR',
  'KAR',
  'KTOS',
  'AAT',
  'TDS',
  'ODP',
  'TRMK',
  'UE',
  'NG',
  'HCC',
  'UTZ',
  'CEIX',
  'MDRX',
  'GPRE',
  'ICFI',
  'FLYW',
  'NWN',
  'TPH',
  'CVCO',
  'LKFN',
  'SYBT',
  'OPK',
  'SATS',
  'PSFE',
  'SJW',
  'IMKTA',
  'RES',
  'LILA',
  'VBTX',
  'NVEE',
  'CTRE',
  'EVCM',
  'SKIN',
  'TALO',
  'HOPE',
  'MD',
  'DEA',
  'PTVE',
  'PFS',
  'NMRK',
  'ESE',
  'SHAK',
  'PRCT',
  'ATRC',
  'B',
  'IAS',
  'EMBC',
  'STER',
  'APPS',
  'BDN',
  'PGRE',
  'CENTA',
  'EFSC',
  'KN',
  'VGR',
  'SPCE',
  'RNST',
  'CSWI',
  'PDM',
  'WWW',
  'BLMN',
  'AKR',
  'NXRT',
  'NBTB',
  'GFF',
  'WGO',
  'BGS',
  'TCBK',
  'XMTR',
  'STRA',
  'WABC',
  'GSHD',
  'SNEX',
  'NWBI',
  'AMPH',
  'RCUS',
  'BYND',
  'TWO',
  'COMM',
  'NTB',
  'CNNE',
  'FLGT',
  'FLNC',
  'CAKE',
  'BKE',
  'LRN',
  'ALLO',
  'WOW',
  'EGBN',
  'AIR',
  'CMRE',
  'SKT',
  'MTRN',
  'EVRI',
  'LOB',
  'NVRO',
  'TVTX',
  'LTC',
  'ATGE',
  'EWCZ',
  'HNI',
  'TSE',
  'HMN',
  'KRYS',
  'SUPN',
  'EBS',
  'SAH',
  'XPER',
  'PLUS',
  'CRS',
  'SBGI',
  'INT',
  'PRAA',
  'NMIH',
  'ECVT',
  'OXM',
  'ECPG',
  'MRTN',
  'MYRG',
  'RLGY',
  'SOVO',
  'PLMR',
  'MNRO',
  'CCS',
  'UVV',
  'MMI',
  'SG',
  'NBR',
  'AMK',
  'TGH',
  'MEI',
  'OSIS',
  'USNA',
  'ARI',
  'MLNK',
  'CRSR',
  'MSEX',
  'GNL',
  'LPRO',
  'MYGN',
  'CYRX',
  'IBRX',
  'ALG',
  'RXT',
  'AVDX',
  'AROC',
  'CTKB',
  'XNCR',
  'ROCK',
  'TTMI',
  'FSLY',
  'SBH',
  'ELF',
  'SAFT',
  'CFFN',
  'USPH',
  'RVMD',
  'DVAX',
  'LNN',
  'PCT',
  'CXW',
  'LGND',
  'IOVA',
  'RXRX',
  'ZNTL',
  'GVA',
  'ALEX',
  'UCTT',
  'IHRT',
  'PUMP',
  'VRTS',
  'RILY',
  'VCYT',
  'SFL',
  'RC',
  'LC',
  'KFRC',
  'JELD',
  'PI',
  'LILAK',
  'STC',
  'OFG',
  'CGC',
  'PRLB',
  'COHU',
  'GDOT',
  'HURN',
  'DDD',
  'AMCX',
  'JACK',
  'GBX',
  'LADR',
  'KALU',
  'MGNI',
  'PATK',
  'CHEF',
  'FCF',
  'BUSE',
  'VRE',
  'GDEN',
  'FIGS',
  'FBNC',
  'EVBG',
  'ADV',
  'XPEL',
  'ADUS',
  'ANDE',
  'MODV',
  'PRIM',
  'GIC',
  'HRT',
  'VMEO',
  'XPRO',
  'SBSI',
  'HCSG',
  'SCS',
  'FCEL',
  'SPNS',
  'SCHL',
  'PRA',
  'CTOS',
  'TWI',
  'KREF',
  'CSR',
  'PLAB',
  'IRBT',
  'CLNE',
  'CHCO',
  'CUBI',
  'FFWM',
  'CDNA',
  'AVNS',
  'SILK',
  'EXTR',
  'BHLB',
  'PRTA',
  'GTY',
  'FBRT',
  'NBHC',
  'DCOM',
  'PRO',
  'CNXN',
  'MDGL',
  'LYEL',
  'ZUO',
  'OCFC',
  'EPAC',
  'SHEN',
  'DIN',
  'SRCE',
  'CASH',
  'ATRI',
  'SWTX',
  'VCEL',
  'OFLX',
  'PMT',
  'ALX',
  'GDYN',
  'CMP',
  'SSP',
  'EAT',
  'FDP',
  'SPTN',
  'DNOW',
  'RGR',
  'HEES',
  'TRS',
  'ESRT',
  'AHH',
  'CTS',
  'MCRI',
  'PTLO',
  'LMND',
  'AMWL',
  'PCVX',
  'SKYW',
  'GES',
  'BANC',
  'EIG',
  'STBA',
  'HTLD',
  'BIGC',
  'BBIO',
  'AZZ',
  'LAW',
  'INFN',
  'ARIS',
  'CMPR',
  'OII',
  'ADPT',
  'ERII',
  'BV',
  'ENFN',
  'ALKT',
  'MBUU',
  'BALY',
  'INSW',
  'PARR',
  'GABC',
  'CLDX',
  'TNC',
  'ASIX',
  'MHO',
  'NHC',
  'ROAD',
  'SXI',
  'ATEN',
  'CRNC',
  'FNKO',
  'AVO',
  'MFA',
  'STEM',
  'GIII',
  'BRKL',
  'ACRS',
  'ARQT',
  'LZB',
  'CAL',
  'TMP',
  'AGM',
  'CNOB',
  'MBIN',
  'NGM',
  'INVA',
  'RYI',
  'PGTI',
  'BFS',
  'SGH',
  'DBI',
  'OEC',
  'VERU',
  'DAWN',
  'EB',
  'TSM',
  'FI',
  'PFBC',
  'ELV',
  'COR',
  'UFPT',
  'LMAT',
  'SLP',
  'GRBK',
  'HZO',
  'HIBB',
  'SCVL',
  'CRMT',
  'COIN',
  'HWKN',
  'S',
  'UPRO',
  'SHOP',
  'BIDU',
  'BABA',
  'ALV',
  'JD',
  'BUD',
  'SUN'];

const fullList = ['RKLB',
  'SPY',
  'QQQ',
  'AAPL',
  'MSFT',
  'GOOG',
  'GOOGL',
  'AMZN',
  'TSLA',
  'META',
  'JNJ',
  'UNH',
  'NVDA',
  'V',
  'XOM',
  'JPM',
  'WMT',
  'PG',
  'MA',
  'CVX',
  'HD',
  'LLY',
  'PFE',
  'BAC',
  'KO',
  'ABBV',
  'PEP',
  'MRK',
  'AVGO',
  'VZ',
  'COST',
  'TMO',
  'ORCL',
  'ADBE',
  'ACN',
  'ABT',
  'CSCO',
  'DHR',
  'DIS',
  'MCD',
  'NKE',
  'CMCSA',
  'CRM',
  'TMUS',
  'BMY',
  'INTC',
  'UPS',
  'WFC',
  'PM',
  'LIN',
  'TXN',
  'NEE',
  'QCOM',
  'AMD',
  'T',
  'RTX',
  'MS',
  'COP',
  'UNP',
  'HON',
  'AMGN',
  'IBM',
  'SCHW',
  'CVS',
  'MDT',
  'BX',
  'LOW',
  'AMT',
  'SPGI',
  'LMT',
  'CAT',
  'AXP',
  'INTU',
  'GS',
  'DE',
  'C',
  'BLK',
  'NOW',
  'PYPL',
  'EL',
  'PLD',
  'ADP',
  'SBUX',
  'ENB',
  'BA',
  'AMAT',
  'CB',
  'MO',
  'MDLZ',
  'BKNG',
  'NFLX',
  'CHTR',
  'CI',
  'MMM',
  'ADI',
  'CNI',
  'DUK',
  'ZTS',
  'GE',
  'SYK',
  'MMC',
  'GILD',
  'CME',
  'SO',
  'ISRG',
  'CCI',
  'USB',
  'NOC',
  'EOG',
  'TGT',
  'TJX',
  'BDX',
  'PGR',
  'VRTX',
  'CSX',
  'MU',
  'PNC',
  'TFC',
  'CL',
  'REGN',
  'FDX',
  'D',
  'LRCX',
  'SHW',
  'WM',
  'PXD',
  'GD',
  'ITW',
  'EQIX',
  'FIS',
  'SLB',
  'NSC',
  'EW',
  'OXY',
  'HUM',
  'AON',
  'ICE',
  'DG',
  'EPD',
  'APD',
  'PSA',
  'ETN',
  'HCA',
  'MET',
  'BSX',
  'MPC',
  'FCX',
  'MRNA',
  'MAR',
  'EMR',
  'NEM',
  'VLO',
  'KDP',
  'KLAC',
  'PANW',
  'GM',
  'MCO',
  'TRI',
  'MNST',
  'PSX',
  'F',
  'SNPS',
  'AEP',
  'ADM',
  'CNC',
  'TEAM',
  'SRE',
  'FTNT',
  'SCCO',
  'MCK',
  'DVN',
  'KHC',
  'ECL',
  'UBER',
  'STZ',
  'DOW',
  'NXPI',
  'LHX',
  'COF',
  'PAYX',
  'AIG',
  'CTVA',
  'ROP',
  'EXC',
  'KMB',
  'HSY',
  'KKR',
  'MRVL',
  'CDNS',
  'SYY',
  'GIS',
  'AZO',
  'SNOW',
  'TRV',
  'ORLY',
  'RSG',
  'IQV',
  'O',
  'KMI',
  'APH',
  'WMB',
  'TEL',
  'CRWD',
  'CTAS',
  'ADSK',
  'EA',
  'DLR',
  'WDAY',
  'KR',
  'WELL',
  'PRU',
  'SQ',
  'XEL',
  'A',
  'CMG',
  'AFL',
  'HPQ',
  'WBD',
  'DLTR',
  'DELL',
  'CTSH',
  'LULU',
  'WBA',
  'BK',
  'HLT',
  'JCI',
  'MSI',
  'ALL',
  'HES',
  'MCHP',
  'MSCI',
  'PH',
  'ILMN',
  'BAX',
  'SBAC',
  'AJG',
  'ZM',
  'LNG',
  'YUM',
  'SPG',
  'LYB',
  'HAL',
  'BKR',
  'GPN',
  'ED',
  'NUE',
  'CARR',
  'TSN',
  'DD',
  'OTIS',
  'MTB',
  'TT',
  'TDG',
  'PCAR',
  'PEG',
  'IFF',
  'ANET',
  'WEC',
  'RMD',
  'BIIB',
  'IDXX',
  'FAST',
  'VICI',
  'FWONA',
  'VEEV',
  'APO',
  'DDOG',
  'CMI',
  'PPG',
  'AMP',
  'GLW',
  'DFS',
  'ODFL',
  'ES',
  'ROST',
  'MTD',
  'PCG',
  'LSXMA',
  'AVB',
  'EQR',
  'WY',
  'AME',
  'DASH',
  'OKE',
  'TROW',
  'VRSK',
  'CPRT',
  'NDAQ',
  'LVS',
  'GFS',
  'APTV',
  'SIVB',
  'EBAY',
  'HRL',
  'RIVN',
  'ON',
  'ALB',
  'AWK',
  'KEYS',
  'AZPN',
  'FANG',
  'FITB',
  'STT',
  'RPRX',
  'IBKR',
  'GWW',
  'ROK',
  'CTRA',
  'ENPH',
  'TTD',
  'EIX',
  'CBRE',
  'DTE',
  'SIRI',
  'K',
  'DHI',
  'CSGP',
  'MKC',
  'TSCO',
  'ZBH',
  'ARE',
  'CDW',
  'MTCH',
  'EFX',
  'EXR',
  'WST',
  'LUV',
  'HIG',
  'ETR',
  'WTW',
  'AEE',
  'ULTA',
  'INVH',
  'FE',
  'BALL',
  'AVTR',
  'LH',
  'SPOT',
  'ANSS',
  'TTWO',
  'ZS',
  'NTRS',
  'CHD',
  'FTV',
  'VMC',
  'DAL',
  'VTR',
  'LEN',
  'RJF',
  'STE',
  'WAT',
  'MLM',
  'CEG',
  'PPL',
  'CF',
  'LYV',
  'MPWR',
  'SUI',
  'MAA',
  'MRO',
  'URI',
  'IT',
  'GPC',
  'CINF',
  'CTLT',
  'MOS',
  'ALGN',
  'CFG',
  'GRMN',
  'AMCR',
  'RF',
  'FOXA',
  'WRB',
  'HBAN',
  'HPE',
  'CMS',
  'IR',
  'DOV',
  'VFC',
  'VRSN',
  'CNP',
  'FOX',
  'LBRDA',
  'MKL',
  'MDB',
  'HOLX',
  'TDY',
  'YUMC',
  'EPAM',
  'PWR',
  'PFG',
  'KEY',
  'ARES',
  'FLT',
  'AGR',
  'ALNY',
  'JBHT',
  'EXPD',
  'ESS',
  'PLTR',
  'SWK',
  'PARA',
  'IP',
  'PAYC',
  'ACGL',
  'EXPE',
  'BR',
  'BBY',
  'ROL',
  'ZBRA',
  'WAB',
  'TW',
  'HEI',
  'J',
  'BG',
  'SYF',
  'INCY',
  'TWLO',
  'DGX',
  'WPC',
  'LBRDK',
  'TRU',
  'BRO',
  'COO',
  'UI',
  'CLX',
  'WDC',
  'GNRC',
  'LPLA',
  'CAG',
  'DOCU',
  'MOH',
  'SWKS',
  'TRGP',
  'ATO',
  'ACI',
  'HUBS',
  'TRMB',
  'BIO',
  'TER',
  'APA',
  'SSNC',
  'SPLK',
  'POOL',
  'DRI',
  'AKAM',
  'KMX',
  'EQT',
  'L',
  'NTAP',
  'CE',
  'BXP',
  'NET',
  'EVRG',
  'DPZ',
  'LNT',
  'WLK',
  'CPT',
  'UDR',
  'IRM',
  'STLD',
  'PKG',
  'PODD',
  'BMRN',
  'CPB',
  'IEX',
  'LKQ',
  'RKT',
  'XYL',
  'CAH',
  'FDS',
  'TECH',
  'FMC',
  'HWM',
  'LDOS',
  'SJM',
  'TXT',
  'ELS',
  'PEAK',
  'AES',
  'OVV',
  'OKTA',
  'OMC',
  'TYL',
  'ENTG',
  'VTRS',
  'CHRW',
  'AVY',
  'HST',
  'JKHY',
  'MGM',
  'NVR',
  'BEPC',
  'CSL',
  'DAR',
  'PINS',
  'PTC',
  'FWONK',
  'BEN',
  'TPL',
  'CG',
  'EMN',
  'CBOE',
  'KIM',
  'ROKU',
  'TFX',
  'BILL',
  'UAL',
  'CCK',
  'AR',
  'NDSN',
  'MAS',
  'CNA',
  'AMH',
  'HAS',
  'AFG',
  'ALLY',
  'SBNY',
  'FHN',
  'NI',
  'WRK',
  'TAP',
  'DT',
  'IPG',
  'GLPI',
  'WTRG',
  'U',
  'DINO',
  'GDDY',
  'BAH',
  'CHK',
  'CRL',
  'SNA',
  'LUMN',
  'CCL',
  'RS',
  'AAP',
  'BHVN',
  'BURL',
  'QRVO',
  'FNF',
  'EQH',
  'RPM',
  'HSIC',
  'SCI',
  'MKTX',
  'ELAN',
  'QGEN',
  'CMA',
  'REG',
  'VST',
  'MORN',
  'FCNCA',
  'GGG',
  'UTHR',
  'REXR',
  'FICO',
  'DOX',
  'RCL',
  'ETSY',
  'GME',
  'BLDR',
  'HUBB',
  'EWBC',
  'AIZ',
  'CLF',
  'FFIV',
  'LW',
  'OLPX',
  'GL',
  'NWSA',
  'NWS',
  'JNPR',
  'BSY',
  'BRKR',
  'UHAL',
  'CUBE',
  'NRG',
  'PHM',
  'WSO',
  'H',
  'SNX',
  'RHI',
  'LAMR',
  'JAZZ',
  'CZR',
  'CLVT',
  'ACM',
  'PCTY',
  'MTN',
  'NBIX',
  'AOS',
  'PLUG',
  'NLY',
  'MPW',
  'WHR',
  'ALLE',
  'LNC',
  'OGN',
  'NFE',
  'SEE',
  'DVA',
  'RGEN',
  'AGCO',
  'AAL',
  'SWN',
  'WSM',
  'BWA',
  'UGI',
  'PAG',
  'HII',
  'ZION',
  'RRC',
  'TPR',
  'WMS',
  'TTC',
  'CAR',
  'ERIE',
  'BJ',
  'WAL',
  'MHK',
  'WBS',
  'OLN',
  'JLL',
  'LSXMK',
  'LAD',
  'CBSH',
  'OC',
  'G',
  'CFR',
  'UHS',
  'RRX',
  'MAT',
  'NWL',
  'ARMK',
  'FRT',
  'JBL',
  'BBWI',
  'XRAY',
  'COLD',
  'DBX',
  'IVZ',
  'PNW',
  'LEA',
  'AGL',
  'PNR',
  'CNXC',
  'KNX',
  'PSTG',
  'RGA',
  'WOLF',
  'ZG',
  'CGNX',
  'LECO',
  'ARW',
  'GLOB',
  'SEIC',
  'DXC',
  'PPC',
  'DLB',
  'CABO',
  'WSC',
  'MANH',
  'NNN',
  'CDAY',
  'OGE',
  'CHDN',
  'MIDD',
  'NOV',
  'IAC',
  'MRVI',
  'RGLD',
  'CASY',
  'BERY',
  'FND',
  'LII',
  'MASI',
  'WEX',
  'FSLR',
  'EXAS',
  'FIVE',
  'ORI',
  'DXCM',
  'WYNN',
  'MTDR',
  'ST',
  'UNM',
  'JEF',
  'NXST',
  'CHE',
  'DECK',
  'RNR',
  'CPRI',
  'TTEK',
  'CIEN',
  'COHR',
  'PCOR',
  'QDEL',
  'GNTX',
  'EGP',
  'OHI',
  'USFD',
  'WH',
  'AXON',
  'RL',
  'CACC',
  'LSCC',
  'HUN',
  'KBR',
  'FR',
  'CACI',
  'DNB',
  'AMC',
  'PB',
  'AIRC',
  'AN',
  'ATR',
  'PFGC',
  'SF',
  'ESTC',
  'NFG',
  'STWD',
  'VOYA',
  'GPK',
  'PII',
  'HALO',
  'TREX',
  'LFUS',
  'WU',
  'NVCR',
  'BRX',
  'GWRE',
  'ACHC',
  'FIVN',
  'DKS',
  'NVST',
  'MP',
  'BPOP',
  'RH',
  'EXEL',
  'ADT',
  'DCI',
  'WCC',
  'BYD',
  'GTLS',
  'KRC',
  'SKX',
  'MUR',
  'THC',
  'ITT',
  'PLNT',
  'MGY',
  'INGR',
  'CIVI',
  'FCN',
  'MKSI',
  'HQY',
  'AYI',
  'COTY',
  'XPO',
  'SRPT',
  'SWX',
  'UWMC',
  'SHC',
  'M',
  'STAG',
  'PNFP',
  'FAF',
  'GMED',
  'FFIN',
  'WWD',
  'SWAV',
  'GXO',
  'EHC',
  'BLD',
  'OSK',
  'PLTK',
  'MUSA',
  'VLY',
  'RYN',
  'SM',
  'Z',
  'MTZ',
  'CNM',
  'INFA',
  'VNO',
  'ASH',
  'HRB',
  'AGNC',
  'AXTA',
  'RCM',
  'LSTR',
  'NVT',
  'LITE',
  'BOKF',
  'KSS',
  'SNV',
  'ITCI',
  'AZTA',
  'X',
  'VVV',
  'REYN',
  'HLI',
  'FLO',
  'PRGO',
  'SITE',
  'LYFT',
  'MDU',
  'TENB',
  'SON',
  'ADC',
  'ALK',
  'EEFT',
  'CC',
  'COKE',
  'DDS',
  'GBCI',
  'VAC',
  'OLED',
  'RNG',
  'NYT',
  'EME',
  'BC',
  'CW',
  'TOL',
  'RLI',
  'DKNG',
  'IDA',
  'TDOC',
  'SAIA',
  'SAIC',
  'SLAB',
  'THG',
  'OMCL',
  'CR',
  'TXRH',
  'W',
  'HGV',
  'ROG',
  'VMI',
  'WOOF',
  'SYNA',
  'OPCH',
  'IONS',
  'DTM',
  'HOG',
  'KNSL',
  'QLYS',
  'LNW',
  'OZK',
  'CLH',
  'SEB',
  'LPX',
  'AMG',
  'ESI',
  'UBSI',
  'APLS',
  'IRT',
  'LEG',
  'AM',
  'RUN',
  'TWKS',
  'AXS',
  'OMF',
  'BWXT',
  'SIGI',
  'NCLH',
  'MSA',
  'WTFC',
  'ALKS',
  'BXMT',
  'CHPT',
  'POST',
  'INSP',
  'TGNA',
  'EXLS',
  'IPGP',
  'SLGN',
  'IART',
  'RHP',
  'CHX',
  'COLM',
  'HP',
  'PEN',
  'MEDP',
  'TNET',
  'TXG',
  'IRDM',
  'PBF',
  'AMN',
  'BKH',
  'PRI',
  'DRVN',
  'CMC',
  'BFAM',
  'CELH',
  'CADE',
  'DOCN',
  'SMG',
  'EXP',
  'TRNO',
  'UFPI',
  'EVR',
  'CUZ',
  'HOMB',
  'LNTH',
  'POWI',
  'NSA',
  'ALTR',
  'SLM',
  'ASGN',
  'ORA',
  'UAA',
  'ONB',
  'CVNA',
  'MSM',
  'TKR',
  'EXPO',
  'HXL',
  'OGS',
  'SFBS',
  'FIZZ',
  'HE',
  'HR',
  'AVT',
  'THO',
  'AMKR',
  'MAN',
  'UMBF',
  'NYCB',
  'SSD',
  'PVH',
  'JHG',
  'PINC',
  'CRUS',
  'NJR',
  'ENSG',
  'ATKR',
  'POR',
  'NOVT',
  'WTS',
  'BL',
  'VIRT',
  'ESNT',
  'ALGM',
  'JWN',
  'PSN',
  'DEI',
  'SNDR',
  'FIBK',
  'IGT',
  'AVNT',
  'SMAR',
  'QS',
  'PYCR',
  'ICUI',
  'SRCL',
  'HWC',
  'KRG',
  'PNM',
  'TPX',
  'GH',
  'FNB',
  'CRK',
  'TFSL',
  'BCPC',
  'DOC',
  'PEGA',
  'ESGR',
  'WEN',
  'ALSN',
  'HELE',
  'PECO',
  'MTG',
  'R',
  'FLR',
  'FLS',
  'CNX',
  'CVI',
  'TDC',
  'VNT',
  'GO',
  'LAZ',
  'MMS',
  'OLLI',
  'NTLA',
  'AWI',
  'WTM',
  'UA',
  'SAM',
  'SR',
  'CERE',
  'AIT',
  'KEX',
  'RPD',
  'YETI',
  'SPSC',
  'RRR',
  'INDB',
  'AMED',
  'TNDM',
  'AMBP',
  'SMPL',
  'BECN',
  'PK',
  'SITM',
  'MSGS',
  'ABG',
  'RARE',
  'GATX',
  'AL',
  'APLE',
  'PTEN',
  'APG',
  'VRT',
  'HIW',
  'ONTO',
  'TNL',
  'JBT',
  'CBT',
  'HBI',
  'GPS',
  'WIX',
  'AGO',
  'MPLN',
  'NSP',
  'SMTC',
  'HLNE',
  'DV',
  'CWST',
  'CVBF',
  'ZWS',
  'ZD',
  'AEL',
  'BPMC',
  'ASAN',
  'BNL',
  'WHD',
  'NCNO',
  'WK',
  'EPR',
  'CBU',
  'VRNS',
  'FUL',
  'LANC',
  'CRC',
  'EBC',
  'CYTK',
  'NTRA',
  'GTES',
  'IRTC',
  'CWK',
  'BOX',
  'MCW',
  'FELE',
  'GT',
  'CPE',
  'RDN',
  'PCH',
  'BTU',
  'KOS',
  'MRCY',
  'BIPC',
  'SXT',
  'ACAD',
  'AYX',
  'MTSI',
  'SPB',
  'ENOV',
  'HAYW',
  'NTNX',
  'NSIT',
  'BRBR',
  'CNS',
  'OPEN',
  'VIR',
  'PRFT',
  'BHF',
  'ARWR',
  'SLG',
  'KRTX',
  'LIVN',
  'HASI',
  'CROX',
  'SEAS',
  'NARI',
  'IIPR',
  'APPF',
  'STAA',
  'NEU',
  'BANF',
  'FCFS',
  'SPR',
  'SBRA',
  'PZZA',
  'HAE',
  'REZI',
  'FOXF',
  'MATX',
  'EQC',
  'VIAV',
  'ALE',
  'DORM',
  'UCBI',
  'WD',
  'SHLS',
  'JAMF',
  'DIOD',
  'NVAX',
  'HRI',
  'APPN',
  'MLI',
  'UNF',
  'BE',
  'KFY',
  'ETRN',
  'OAS',
  'NWE',
  'SIG',
  'KMPR',
  'CERT',
  'MMSI',
  'ALRM',
  'BKU',
  'LXP',
  'TTEC',
  'ADNT',
  'DH',
  'CATY',
  'BOH',
  'ENV',
  'SPWR',
  'ASO',
  'SFM',
  'SFNC',
  'SEM',
  'FHB',
  'JBGS',
  'IBTX',
  'AAON',
  'SUM',
  'UPST',
  'FN',
  'AVA',
  'GOLF',
  'DBRG',
  'CRI',
  'APAM',
  'HI',
  'MC',
  'ASB',
  'STEP',
  'NNI',
  'COOP',
  'PRVA',
  'DNLI',
  'SITC',
  'BLKB',
  'ABCB',
  'VC',
  'ESAB',
  'OUT',
  'ACIW',
  'VSCO',
  'FRPT',
  'PBH',
  'FIX',
  'GEF',
  'NHI',
  'INST',
  'LESL',
  'ARCH',
  'EPRT',
  'LOPE',
  'FORM',
  'FHI',
  'PDCO',
  'ATI',
  'FOUR',
  'RUSHA',
  'LBRT',
  'PPBI',
  'SPT',
  'FL',
  'SHOO',
  'SGRY',
  'MGEE',
  'LCII',
  'CCOI',
  'GPI',
  'TRIP',
  'GHC',
  'JBLU',
  'VRNT',
  'AEIS',
  'LZ',
  'MXL',
  'CVLT',
  'TMHC',
  'AZEK',
  'KLIC',
  'CVAC',
  'ABM',
  'BCO',
  'STNE',
  'TROX',
  'CARG',
  'BRP',
  'BCC',
  'FBP',
  'AWR',
  'OTTR',
  'CNMD',
  'WSFS',
  'CWT',
  'PJT',
  'AMBA',
  'VSH',
  'LTH',
  'BEAM',
  'CRGY',
  'MAIN',
  'TCBI',
  'KW',
  'SKY',
  'MTH',
  'IBOC',
  'HRMY',
  'DY',
  'PEB',
  'CWEN',
  'ETWO',
  'KWR',
  'NGVT',
  'NEOG',
  'EVH',
  'AGTI',
  'XRX',
  'NOG',
  'AIN',
  'WERN',
  'HUBG',
  'WDFC',
  'JOE',
  'PWSC',
  'USM',
  'ENS',
  'EVTC',
  'KBH',
  'HLF',
  'PCRX',
  'PGNY',
  'UPWK',
  'FSR',
  'MCY',
  'AMRC',
  'CPA',
  'NKLA',
  'SANM',
  'GLNG',
  'VRRM',
  'IBP',
  'SONO',
  'AUB',
  'FOLD',
  'JJSF',
  'VICR',
  'NTCT',
  'SPXC',
  'OI',
  'AXNX',
  'FWRD',
  'CLBK',
  'FULT',
  'BFH',
  'TRUP',
  'SHO',
  'BOOT',
  'TR',
  'UNIT',
  'RMBS',
  'COUR',
  'PFSI',
  'CRVL',
  'PSMT',
  'NAPA',
  'SMCI',
  'IOSP',
  'HL',
  'CALM',
  'UNFI',
  'OMI',
  'SAVE',
  'VSAT',
  'WING',
  'BRC',
  'ACA',
  'HPP',
  'CHGG',
  'FRME',
  'WIRE',
  'SAFE',
  'MDC',
  'FATE',
  'BDC',
  'SCL',
  'ATSG',
  'EYE',
  'COLB',
  'AHCO',
  'BMI',
  'NUS',
  'TELL',
  'KD',
  'DK',
  'ITGR',
  'CORT',
  'CENT',
  'GSAT',
  'CALX',
  'INSM',
  'ALGT',
  'KRO',
  'PRMW',
  'FSS',
  'PD',
  'PLXS',
  'CPK',
  'ATUS',
  'HTH',
  'DNUT',
  'RVLV',
  'AEO',
  'THS',
  'ARVN',
  'LFST',
  'AX',
  'ALHC',
  'TEX',
  'GOGO',
  'HAIN',
  'STGW',
  'MLKN',
  'IPAR',
  'CNO',
  'KMT',
  'PRGS',
  'TTGT',
  'WMK',
  'KAI',
  'MAC',
  'QTWO',
  'NOVA',
  'TOWN',
  'HLIO',
  'FCPT',
  'CSTM',
  'YELP',
  'MED',
  'DAN',
  'MGPI',
  'WOR',
  'EAF',
  'ABR',
  'RLJ',
  'FA',
  'ITRI',
  'STNG',
  'PIPR',
  'SAGE',
  'GKOS',
  'CBZ',
  'SBCF',
  'WAFD',
  'MTX',
  'THRM',
  'AVAV',
  'URBN',
  'NAVI',
  'AMEH',
  'ULCC',
  'LAUR',
  'NABL',
  'PTCT',
  'MSTR',
  'SSTK',
  'SABR',
  'TRN',
  'CBRL',
  'PRK',
  'DRH',
  'CWH',
  'KTB',
  'ROIC',
  'SI',
  'LGIH',
  'WSBC',
  'WRE',
  'TAL',
  'ENR',
  'IDCC',
  'CIM',
  'SLVM',
  'MSGE',
  'FRO',
  'SIX',
  'VSTO',
  'AI',
  'BANR',
  'MGRC',
  'FTDR',
  'FFBC',
  'FBK',
  'CSGS',
  'FROG',
  'ARCB',
  'GMS',
  'SWI',
  'CNK',
  'GNW',
  'TWST',
  'HTLF',
  'BCRX',
  'ARRY',
  'IRWD',
  'SDGR',
  'SASR',
  'RLAY',
  'NPO',
  'ACLS',
  'RAMP',
  'GTN',
  'EPC',
  'DOOR',
  'MWA',
  'EXPI',
  'XHR',
  'KAR',
  'KTOS',
  'AAT',
  'TDS',
  'ODP',
  'TRMK',
  'UE',
  'NG',
  'HCC',
  'UTZ',
  'CEIX',
  'MDRX',
  'GPRE',
  'ICFI',
  'FLYW',
  'NWN',
  'TPH',
  'CVCO',
  'LKFN',
  'SYBT',
  'OPK',
  'SATS',
  'PSFE',
  'SJW',
  'IMKTA',
  'RES',
  'LILA',
  'VBTX',
  'NVEE',
  'CTRE',
  'EVCM',
  'SKIN',
  'TALO',
  'HOPE',
  'MD',
  'DEA',
  'PTVE',
  'PFS',
  'NMRK',
  'ESE',
  'SHAK',
  'PRCT',
  'ATRC',
  'B',
  'IAS',
  'EMBC',
  'STER',
  'APPS',
  'BDN',
  'PGRE',
  'CENTA',
  'EFSC',
  'KN',
  'VGR',
  'SPCE',
  'RNST',
  'CSWI',
  'PDM',
  'WWW',
  'BLMN',
  'AKR',
  'NXRT',
  'NBTB',
  'GFF',
  'WGO',
  'BGS',
  'TCBK',
  'XMTR',
  'STRA',
  'WABC',
  'GSHD',
  'SNEX',
  'NWBI',
  'AMPH',
  'RCUS',
  'BYND',
  'TWO',
  'COMM',
  'NTB',
  'CNNE',
  'FLGT',
  'FLNC',
  'CAKE',
  'BKE',
  'LRN',
  'ALLO',
  'WOW',
  'EGBN',
  'AIR',
  'CMRE',
  'SKT',
  'MTRN',
  'EVRI',
  'LOB',
  'NVRO',
  'TVTX',
  'LTC',
  'ATGE',
  'EWCZ',
  'HNI',
  'TSE',
  'HMN',
  'KRYS',
  'SUPN',
  'EBS',
  'SAH',
  'XPER',
  'PLUS',
  'CRS',
  'SBGI',
  'INT',
  'PRAA',
  'NMIH',
  'ECVT',
  'OXM',
  'ECPG',
  'MRTN',
  'MYRG',
  'RLGY',
  'SOVO',
  'PLMR',
  'MNRO',
  'CCS',
  'UVV',
  'MMI',
  'SG',
  'NBR',
  'AMK',
  'TGH',
  'MEI',
  'OSIS',
  'USNA',
  'ARI',
  'MLNK',
  'CRSR',
  'MSEX',
  'GNL',
  'LPRO',
  'MYGN',
  'CYRX',
  'IBRX',
  'ALG',
  'RXT',
  'AVDX',
  'AROC',
  'CTKB',
  'XNCR',
  'ROCK',
  'TTMI',
  'FSLY',
  'SBH',
  'ELF',
  'SAFT',
  'CFFN',
  'USPH',
  'RVMD',
  'DVAX',
  'LNN',
  'PCT',
  'CXW',
  'LGND',
  'IOVA',
  'RXRX',
  'ZNTL',
  'GVA',
  'ALEX',
  'UCTT',
  'IHRT',
  'PUMP',
  'VRTS',
  'RILY',
  'VCYT',
  'SFL',
  'RC',
  'LC',
  'KFRC',
  'JELD',
  'PI',
  'LILAK',
  'STC',
  'OFG',
  'CGC',
  'PRLB',
  'COHU',
  'GDOT',
  'HURN',
  'DDD',
  'AMCX',
  'JACK',
  'GBX',
  'LADR',
  'KALU',
  'MGNI',
  'PATK',
  'CHEF',
  'FCF',
  'BUSE',
  'VRE',
  'GDEN',
  'FIGS',
  'FBNC',
  'EVBG',
  'ADV',
  'XPEL',
  'ADUS',
  'ANDE',
  'MODV',
  'PRIM',
  'GIC',
  'HRT',
  'VMEO',
  'XPRO',
  'SBSI',
  'HCSG',
  'SCS',
  'FCEL',
  'SPNS',
  'SCHL',
  'PRA',
  'CTOS',
  'TWI',
  'KREF',
  'CSR',
  'PLAB',
  'IRBT',
  'CLNE',
  'CHCO',
  'CUBI',
  'FFWM',
  'CDNA',
  'AVNS',
  'SILK',
  'EXTR',
  'BHLB',
  'PRTA',
  'GTY',
  'FBRT',
  'NBHC',
  'DCOM',
  'PRO',
  'CNXN',
  'MDGL',
  'LYEL',
  'ZUO',
  'OCFC',
  'EPAC',
  'SHEN',
  'DIN',
  'SRCE',
  'CASH',
  'ATRI',
  'SWTX',
  'VCEL',
  'OFLX',
  'PMT',
  'ALX',
  'GDYN',
  'CMP',
  'SSP',
  'EAT',
  'FDP',
  'SPTN',
  'DNOW',
  'RGR',
  'HEES',
  'TRS',
  'ESRT',
  'AHH',
  'CTS',
  'MCRI',
  'PTLO',
  'LMND',
  'AMWL',
  'PCVX',
  'SKYW',
  'GES',
  'BANC',
  'EIG',
  'STBA',
  'HTLD',
  'BIGC',
  'BBIO',
  'AZZ',
  'LAW',
  'INFN',
  'ARIS',
  'CMPR',
  'OII',
  'ADPT',
  'ERII',
  'BV',
  'ENFN',
  'ALKT',
  'MBUU',
  'BALY',
  'INSW',
  'PARR',
  'GABC',
  'CLDX',
  'TNC',
  'ASIX',
  'MHO',
  'NHC',
  'ROAD',
  'SXI',
  'ATEN',
  'CRNC',
  'FNKO',
  'AVO',
  'MFA',
  'STEM',
  'GIII',
  'BRKL',
  'ACRS',
  'ARQT',
  'LZB',
  'CAL',
  'TMP',
  'AGM',
  'CNOB',
  'MBIN',
  'NGM',
  'INVA',
  'RYI',
  'PGTI',
  'BFS',
  'SGH',
  'DBI',
  'OEC',
  'VERU',
  'DAWN',
  'EB',
  'TSM',
  'FI',
  'PFBC',
  'ELV',
  'COR',
  'UFPT',
  'LMAT',
  'SLP',
  'GRBK',
  'HZO',
  'HIBB',
  'SCVL',
  'CRMT',
  'COIN',
  'HWKN',
  'S',
  'UPRO',
  'SHOP',
  'BIDU',
  'BABA',
  'ALV',
  'JD',
  'BUD',
  'SUN',
  'SKWS']

const top300 = ['S',
  'AAPL',
  'MSFT',
  'NVDA',
  'TSM',
  'AVGO',
  'ADBE',
  'CRM',
  'ACN',
  'INTU',
  'AMAT',
  'LRCX',
  'ADI',
  'KLAC',
  'SNPS',
  'CDNS',
  'ANET',
  'APH',
  'MCHP',
  'FTNT',
  'ON',
  'IT',
  'MPWR',
  'KEYS',
  'TDY',
  'ENPH',
  'EPAM',
  'TER',
  'JBL',
  'QRVO',
  'OLED',
  'AMKR',
  'ONTO',
  'SPSC',
  'FN',
  'MKSI',
  'LFUS',
  'ARW',
  'NSIT',
  'CRUS',
  'AEIS',
  'DIOD',
  'PRGS',
  'PRFT',
  'PLUS',
  'V',
  'MA',
  'SPGI',
  'BLK',
  'FI',
  'ICE',
  'MCO',
  'MSCI',
  'AMP',
  'NDAQ',
  'DFS',
  'ACGL',
  'RJF',
  'BRO',
  'FDS',
  'MKTX',
  'IBKR',
  'KNSL',
  'PRI',
  'WAL',
  'SF',
  'EVR',
  'FFIN',
  'WD',
  'ABCB',
  'SFBS',
  'BANF',
  'AX',
  'SNEX',
  'VRTS',
  'UNH',
  'ABBV',
  'TMO',
  'ISRG',
  'ELV',
  'VRTX',
  'REGN',
  'HCA',
  'DXCM',
  'EW',
  'CNC',
  'MTD',
  'WST',
  'RMD',
  'MOH',
  'LH',
  'HOLX',
  'PODD',
  'TECH',
  'CRL',
  'RGEN',
  'ENSG',
  'QDEL',
  'UFPT',
  'LMAT',
  'CPRT',
  'ODFL',
  'GWW',
  'URI',
  'PWR',
  'BR',
  'ROL',
  'BLDR',
  'AXON',
  'EXPD',
  'LII',
  'PAYC',
  'SAIA',
  'EME',
  'TTC',
  'PCTY',
  'TREX',
  'TTEK',
  'SSD',
  'GNRC',
  'UFPI',
  'FIX',
  'FCN',
  'LSTR',
  'AAON',
  'EXLS',
  'ASGN',
  'FELE',
  'EXPO',
  'NSP',
  'ALG',
  'MYRG',
  'PGTI',
  'NVEE',
  'MRTN',
  'FWRD',
  'AMZN',
  'HD',
  'TSLA',
  'LOW',
  'ORLY',
  'LULU',
  'DHI',
  'AZO',
  'ULTA',
  'TSCO',
  'PHM',
  'DECK',
  'DPZ',
  'WSM',
  'LKQ',
  'KMX',
  'DKS',
  'BLD',
  'FIVE',
  'ETSY',
  'LAD',
  'TPX',
  'TXRH',
  'MUSA',
  'AN',
  'MTH',
  'THO',
  'TMHC',
  'RH',
  'IBP',
  'ABG',
  'GPI',
  'MDC',
  'MHO',
  'LGIH',
  'CCS',
  'CVCO',
  'FOXF',
  'BOOT',
  'PATK',
  'XPEL',
  'HIBB',
  'SCVL',
  'CRMT',
  'COST',
  'TGT',
  'DG',
  'COKE',
  'IPAR',
  'CENT',
  'CENTA',
  'MGPI',
  'GOOGL',
  'META',
  'CHTR',
  'TTGT',
  'SHW',
  'NUE',
  'STLD',
  'ALB',
  'RS',
  'BERY',
  'EXP',
  'LPX',
  'WOR',
  'HWKN',
  'PXD',
  'MTDR',
  'NRG',
  'AMT',
  'CSGP',
  'EXR',
  'CBRE',
  'SBAC',
  'IRBT',
  'QQQ',
  'SPY',
  'F',
  'GOOG',
  'SHOP',
  'MDB',
  'KMB',
  'GILD',
  'SIX',
  'DAL',
  'DBX',
  'FCX',
  'TMUS',
  'TWLO',
  'DIS',
  'ROKU',
  'MTCH',
  'Z',
  'EA',
  'T',
  'BIDU',
  'BABA',
  'WEN',
  'ALV',
  'JD',
  'W',
  'BOX',
  'GM',
  'DKNG',
  'SHAK',
  'INTC',
  'AMD',
  'CL',
  'WMT',
  'PEP',
  'TSN',
  'BUD',
  'GIS',
  'JPM',
  'C',
  'COF',
  'GS',
  'SUN',
  'HIG',
  'BK',
  'BMY',
  'MRNA',
  'VEEV',
  'KBH',
  'COIN',
  'BA'];

const top100 = [
  'QQQ',
  'SPY',
  'F',
  'MSFT',
  'AAPL',
  'GOOG',
  'SHOP',
  'TSLA',
  'CRM',
  'MDB',
  'KMB',
  'GILD',
  'SIX',
  'DAL',
  'DBX',
  'NUE',
  'STLD',
  'FCX',
  'TMUS',
  'TWLO',
  'DIS',
  'ROKU',
  'MTCH',
  'META',
  'CHTR',
  'Z',
  'EA',
  'T',
  'NFLX',
  'BIDU',
  'BABA',
  'HD',
  'LOW',
  'WEN',
  'LULU',
  'ALV',
  'JD',
  'W',
  'BOX',
  'GM',
  'SHAK',
  'INTC',
  'AMD',
  'NVDA',
  'CL',
  'KMB',
  'COST',
  'WMT',
  'TGT',
  'KO',
  'PEP',
  'TSN',
  'BUD',
  'GIS',
  'JPM',
  'C',
  'COF',
  'GS',
  'SUN',
  'V',
  'HIG',
  'VOYA',
  'BK',
  'BMY',
  'MRNA',
  'VEEV',
  'KBH',
  'AVGO',
  'COIN',
  'BMY',
  'MRNA',
  'WMT',
  'SHAK',
  'EA',
  'SHOP',
  'TSLA',
  'AMZN',
  'LOW',
  'HD',
  'UNH',
  'VRTX',
  'V',
  'MA',
  'S',
  'CRM',
  'INTU',
  'AMAT',
  'KLAC',
  'LRCX',
  'TER',
  'SKWS'];

export const stockList = shuffle(top300);

export const primaryList = shuffle(top100);

export const bearList = [
  'SH',
  'SQQQ',
  'TBF',
  'QID',
  'RWM',
  'SARK',
  'FAZ',
  'SOXS',
  'SPXS'
];

const Stocks: AlgoParam[] = shuffle(top300).map(b => createParam(b));

export const PrimaryList: AlgoParam[] = [];

for (const p of primaryList) {
  PrimaryList.push(createParam(p));
}

export const BearList: AlgoParam[] = [];

for (const b of bearList) {
  BearList.push(createParam(b));
}

export const AlwaysBuy = ['VTI'].map(b => createParam(b));

export const PersonalBearishPicks = ['TWLO',
  'MDB',
  'CVNA',
  'WING'].map(b => createParam(b));


export const DaytradeList = [
  'AAPL',
  'GOOG',
  'NVDA',
  'AMD',
  'INTC',
  'HUBS',
  'MSFT'].map(b => createParam(b));
  
export const OldList = oldList.map(b => createParam(b));
export const FullList = shuffle(fullList).map(b => createParam(b));

export default Stocks;
