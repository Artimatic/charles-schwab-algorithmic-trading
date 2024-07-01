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
  recommendation: OrderType;
  mfi?: DaytradeRecommendation;
  roc?: DaytradeRecommendation;
  bband?: DaytradeRecommendation;
  vwma?: DaytradeRecommendation;
  mfiTrade?: DaytradeRecommendation;
  macd?: DaytradeRecommendation;
  demark9?: DaytradeRecommendation;
  mfiLow?: DaytradeRecommendation;
  mfiDivergence?: DaytradeRecommendation;
  mfiDivergence2?: DaytradeRecommendation;
  overboughtMomentum?: DaytradeRecommendation;
  data?: any;
  bbandBreakout?: DaytradeRecommendation;
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
  data?: any;
}

export interface StockBacktest {  
  algo: string;
  recommendation?: string;
  orderHistory: any[];
  net: number;
  total: number;
  signals?: Indicators[];
  totalTrades: number;
  invested?: number;
  returns: number;
  lastVolume?: number;
  lastPrice?: number;
  startDate?: number;
  endDate?: number;
  upperResistance?: number;
  lowerResistance?: number;
  profitableTrades?: any;
  stock: string;
  totalReturns: number;
  averageMove?: number;
}

export interface DaytradeIndicator {
  name?: string;
  time?: string;
  recommendation?: 'None' | 'Sell' | 'Buy';
  mfi: 'Bearish' | 'Bullish' | 'Neutral';
  roc: 'Bearish' | 'Bullish' | 'Neutral';
  bband: 'Bearish' | 'Bullish' | 'Neutral';
  vwma: 'Bearish' | 'Bullish' | 'Neutral';
  macd: 'Bearish' | 'Bullish' | 'Neutral';
  demark9: 'Bearish' | 'Bullish' | 'Neutral';
  bbandBreakout: 'Bearish' | 'Bullish' | 'Neutral';
  mfiTrade: 'Bearish' | 'Bullish' | 'Neutral';
  data?: { indicator: Indicators };
}