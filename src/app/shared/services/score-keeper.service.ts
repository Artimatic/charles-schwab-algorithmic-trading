import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';

import { Winloss } from '../models/winloss';

import { ReportingService } from './reporting.service';

export interface ScoringIndex<TValue> {
  [id: string]: TValue;
}

export interface RecentTrades {
  symbol: string;
  closeDate: string;
  pl: number;
}

interface WinLossIndex {
  [id: string]: Winloss;
}

@Injectable()
export class ScoreKeeperService {
  public profitLossHash: ScoringIndex<number> = {};
  winlossHash: WinLossIndex = {};
  costEstimates: ScoringIndex<number> = {};
  total = 0;
  lossTally: ScoringIndex<number> = {};
  percentReturns = {};
  bettingIndex = -1;
  recentTradeArr: RecentTrades[] = [];
  
  constructor(private reportingService: ReportingService) { }

  resetTotal() {
    this.total = 0;
  }

  addProfitLoss(stock: string, sum: number, isSell = true) {
    sum = Number(sum);
    this.total += sum;
    if (this.profitLossHash[stock]) {
      this.profitLossHash[stock] = Number(this.profitLossHash[stock].toFixed(2)) + sum;
    } else {
      this.profitLossHash[stock] = Number(sum.toFixed(2));
    }

    if (isSell) {
      this.addSell(stock, sum);
    }
    const log = `Sold pnl: ${this.profitLossHash[stock].toFixed(2)}`;
    this.reportingService.addAuditLog(stock, log);
  }

  updateCostEstimate(stock: string, price: number) {
    this.costEstimates[stock] = price;
  }

  addSell(stock: string, gains: number) {
    this.recentTradeArr.push({
      closeDate: moment().format('YYYY-MM-DD hh:mm'),
      symbol: stock,
      pl: gains
    });

    if (this.winlossHash[stock]) {
      if (gains > 0) {
        this.winlossHash[stock].wins++;
        this.resetLossTally(stock);
      } else {
        this.winlossHash[stock].losses++;
        this.incrementLossTally(stock);
      }
      this.winlossHash[stock].total++;
    } else {
      const wl: Winloss = {
        wins: 0,
        losses: 0,
        total: 1
      };

      if (gains > 0) {
        wl.wins++;
        this.resetLossTally(stock);
      } else {
        wl.losses++;
        this.incrementLossTally(stock);
      }

      this.winlossHash[stock] = wl;
    }
  }

  getScore(stock: string) {
    return this.winlossHash[stock];
  }

  resetScore(stock: string) {
    this.winlossHash[stock] = null;
  }

  resetLossTally(stock: string) {
    this.lossTally[stock] = 0;
  }

  incrementLossTally(stock: string) {
    if (this.lossTally[stock]) {
      this.lossTally[stock]++;
    } else {
      this.lossTally[stock] = 1;
    }
  }

  resetProfitLoss(stock: string) {
    this.profitLossHash[stock] = 0;
  }

  addReturns(stock: string, returns: number) {
    this.percentReturns[stock] = returns;
  }

  modifier(stock: string, quantity: number) {
    if (!this.lossTally[stock]) {
      return Math.ceil(0.25 * quantity);
    } else if (this.lossTally[stock] > 0) {
      return Math.ceil(0.5);
    }
    return Math.ceil(1);
  }
}
