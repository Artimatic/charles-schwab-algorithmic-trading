import { PortfolioInfoHolding } from '../services/portfolio.service';

export interface MarketStatus {
  isOpen: boolean;
  sessionStart: string;
  sessionEnd: string;
  lastCheck: Date;
}

export interface TradingSignals {
  marketStatus: MarketStatus;
  currentHoldings: PortfolioInfoHolding[];
  lastCredentialCheck: Date;
  boughtAtClose: boolean;
  developedStrategy: boolean;
  lastProfitCheck: Date;
  hasErrors: boolean;
  errorMessage?: string;
}

export interface SignalUpdate {
  type: 'MARKET_STATUS' | 'HOLDINGS' | 'CREDENTIALS' | 'CLOSE_TRADE' | 'STRATEGY' | 'PROFIT' | 'ERROR';
  payload: any;
}