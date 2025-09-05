import { Injectable } from '@angular/core';
import { BacktestService } from '@shared/services';
import * as moment from 'moment-timezone';

export interface LookBackStrategyObject {
  algo: string;
  orderHistory: LookBackOrderHistory[];
}

export interface LookBackOrderHistory {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  support: number[];
  resistance: number[];
  bband80: [number, number][];
  roc10: number;
  roc10Previous: number;
  roc70: number;
  roc70Previous: number;
  mfiLeft: number;
  vwma: number;
  sma10: number;
  sma50: number;
  macd: number[][];
  macdPrevious: number[][];
  rsi: number[][];
  demark9: Demark9;
  mfiLow: number;
  obv: number[][];
  mfiPrevious: number;
  bbandBreakout: boolean;
  flagPennant: FlagPennant;
  recommendation: Recommendation;
  signal: string;
  action: string;
}

export interface Demark9 {
  perfectSell: boolean;
  perfectBuy: boolean;
}

export interface FlagPennant {
  steepPrecedingTrend: boolean;
  flagPennantFormation: boolean;
  breakoutOccurred: boolean;
  breakoutDirection: string;
  measuredRuleTargetMet: boolean;
}

export interface Recommendation {
  recommendation: string;
  mfi: string;
  mfiLow: string;
  vwma: string;
  mfiTrade: string;
  macd: string;
  demark9: string;
  mfiDivergence: string;
  mfiDivergence2: string;
  bband: string;
  flagPennant: string;
  breakSupport: string;
  breakResistance: string;
  roc: string;
}

@Injectable({
  providedIn: 'root'
})
export class LookBackStrategyService {

  constructor(private backtestService: BacktestService) { }

  async checkOrderHistory(symbol: string, orderHistory: LookBackOrderHistory[]): Promise<string> {
    if (!orderHistory.length) {
      return 'INDETERMINANT';
    }
    const dateDiff = moment().diff(moment(orderHistory[orderHistory.length - 1].date), 'days');
    if (dateDiff > 9 && dateDiff < 15) {
          const currentDate = moment().format('YYYY-MM-DD');
          const startDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
          const backtest = await this.backtestService.getBacktestEvaluation(symbol, startDate, currentDate, 'daily-indicators').toPromise();
          const signals = backtest.signals;
          const lastSignal = signals[signals.length - 1];
          const pastSignal = signals[signals.length - dateDiff];
          if (orderHistory[orderHistory.length - 1].action === 'STRONGBUY' && lastSignal.mfiLeft > pastSignal.mfiLeft) {
            return 'STRONGBUY';
          } else if (orderHistory[orderHistory.length - 1].action === 'STRONGSELL' && lastSignal.mfiLeft < pastSignal.mfiLeft) {
            return 'STRONGSELL';
          }
    }

    return 'INDETERMINANT';
  }
}
