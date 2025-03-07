export enum DaytradeRecommendation {
  Bullish = 'Bullish',
  Bearish = 'Bearish',
  Neutral = 'Neutral'
}

export enum OrderType {
  Buy = 'Buy',
  Sell = 'Sell',
  None = 'None'
}

export interface Recommendation {
  name?: string,
  time?: string,
  lastVolume?: number;
  lastPrice?: number;
  totalReturns?: number;
  recommendation?: OrderType;
  mfi: DaytradeRecommendation;
  roc: DaytradeRecommendation;
  bband: DaytradeRecommendation;
  vwma: DaytradeRecommendation;
  mfiTrade: DaytradeRecommendation;
  macd: DaytradeRecommendation;
  demark9: DaytradeRecommendation;
  mfiLow?: DaytradeRecommendation;
  mfiDivergence?: DaytradeRecommendation;
  mfiDivergence2?: DaytradeRecommendation;
  overboughtMomentum?: DaytradeRecommendation;
  data?: { indicator: Indicators };
  bbandBreakout: DaytradeRecommendation;
}

export interface Indicators {
  name: string;
  vwma: number;
  mfiLeft: number;
  bband80: any[];
  mfiPrevious?: number;
  macd?: any;
  roc10?: number;
  roc10Previous?: number;
  roc70?: number;
  roc70Previous?: number;
  close?: number;
  recommendation?: Recommendation;
  action?: string;
  date?: string;
  demark9?: any;
  mfiLow?: number;
  high?: number;
  low?: number;
  mfiTrend?: boolean;
  macdPrevious?: any;
  bbandBreakout?: boolean;
  rsi?: number;
  data?: { indicator: Indicators };
}
export type RecommendationStr = 'INDETERMINANT' | 'STRONGSELL' | 'STRONGBUY' | 'BUY' | 'SELL';

export interface StockBacktest {  
  algo: string;
  recommendation: RecommendationStr;
  orderHistory: any[];
  net: number;
  total: number;
  signals?: Indicators[];
  totalTrades: number;
  invested?: number;
  returns: number;
  startDate?: number;
  endDate?: number;
  upperResistance?: number;
  lowerResistance?: number;
  profitableTrades?: any;
  stock: string;
  averageMove: number;
  backtestDate: string;
  buySignals: string[];
  impliedMovement: number;
  sellSignals: string[];
  symbol: string;
  ml: number;
}