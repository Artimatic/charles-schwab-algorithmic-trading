import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioService } from '@shared/services';

@Injectable({
  providedIn: 'root'
})
export class PriceTargetService {
  targetDiff = 0.3;
  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private cartService: CartService
  ) { }

  async hasMetPriceTarget() {
      const symbol = 'SPY';
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const portfolioPl = await this.todaysPortfolioPl();
      if (portfolioPl > (((price[symbol].lastPrice - price[symbol].closePrice) / price[symbol].closePrice) + 0.3)) {
        return true;
      }
      return false;
  }

  async todaysPortfolioPl() {
    const portData = await this.portfolioService.getTdPortfolio().toPromise();
    const todayPl = portData.reduce((acc, curr) => {
      acc.profitLoss += curr.currentDayProfitLoss;
      acc.total += curr.marketValue;
      return acc;
    }, { profitLoss: 0, total: 0});
    return ((todayPl.total + todayPl.profitLoss) - todayPl.total) / todayPl.total;
  }

  async checkProfitTarget() {
    const targetMet = await this.hasMetPriceTarget();
    if (targetMet) {
      await this.cartService.findCurrentPositions();
    }
  }
}
