import { Injectable } from '@angular/core';
import { CartService } from '@shared/services';
import { round } from 'lodash';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { PriceTargetService } from './price-target.service';

export enum RiskTolerance {
  Zero = 0.005,
  One = 0.01,
  Two = 0.025,
  Lower = 0.05,
  Low = 0.1,
  ExtremeFear = 0.15,
  Fear = 0.2,
  Neutral = 0.25,
  Greed = 0.5,
  ExtremeGreed = 0.6,
  XLGreed = 0.7,
  XXLGreed = 0.8,
  XXXLGreed = 0.9,
  XXXXLGreed = 1
}

@Injectable({
  providedIn: 'root'
})
export class AutopilotService {
  riskCounter = 0;

  riskToleranceList = [
    RiskTolerance.One,
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.ExtremeFear,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.Greed
  ];

  constructor(private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService
  ) { }

  async getMinMaxCashForOptions() {
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
    const minCash = maxCash - (cash * RiskTolerance.Zero);
    return {
      maxCash,
      minCash
    };
  }

  async addPerfectPair(currentHoldings) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const key = savedBacktest[saved].sellSignals.sort() + savedBacktest[saved].buySignals.sort() + Math.round(savedBacktest[saved].impliedMovement * 100);
        const symbol = backtestObj.stock
        if (backtestObj.ml > 0.5 && this.priceTargetService.isProfitable(backtestObj.invested, backtestObj.net)) {
          if (MlBuys[key]) {
            MlBuys[key].push(symbol);
          } else {
            MlBuys[key] = [symbol];
          }
        } else if (backtestObj.ml !== null && backtestObj.ml < 0.5 && this.priceTargetService.notProfitable(backtestObj.invested, backtestObj.net)) {
          if (MlSells[key]) {
            MlSells[key].push(symbol);
          } else {
            MlSells[key] = [symbol];
          }
        }
      }
    }

    for (const buyKey in MlBuys) {
      if (MlSells[buyKey] && MlSells[buyKey].length) {
        const cash = await this.getMinMaxCashForOptions();
        await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
          MlBuys[buyKey], MlSells[buyKey],
          cash.minCash, cash.maxCash, 'Perfect pair');
      }
    }
  }

  async addAnyPair(currentHoldings) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      const buys = backtestResults.filter(backtestData => backtestData.ml > 0.5 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY'));
      const sells = backtestResults.filter(backtestData => backtestData.ml < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL'));
      buys.sort((a, b) => a.pnl - b.pnl);
      sells.sort((a, b) => b.pnl - a.pnl);
      console.log('sorted', buys, sells);
      const cash = await this.getMinMaxCashForOptions();

      let initial = null;
      do {
        initial = await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
          [buys.pop()], [sells.pop()],
          cash.minCash, cash.maxCash, 'Any pair');
      } while (!initial)
    }
  }
}
