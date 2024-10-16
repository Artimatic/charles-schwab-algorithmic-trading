import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService } from '@shared/services';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';

@Injectable({
  providedIn: 'root'
})
export class PriceTargetService {
  targetDiff = 1;
  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private orderHandlingService: OrderHandlingService
  ) { }

  async hasMetPriceTarget() {
      const symbol = 'SPY';
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const portfolioPl = await this.todaysPortfolioPl();
      if (portfolioPl && (portfolioPl > (((price[symbol].lastPrice - price[symbol].closePrice) / price[symbol].closePrice) + this.targetDiff))) {
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

  async checkProfitTarget(retrievedHoldings: PortfolioInfoHolding[] = null) {
    const targetMet = await this.hasMetPriceTarget();
    if (targetMet) {
      const holdings = retrievedHoldings? retrievedHoldings : await this.cartService.findCurrentPositions();
      holdings.forEach(async(portItem: PortfolioInfoHolding) => {
        if (this.cartService.isStrangle(portItem)) {
          await this.optionsOrderBuilderService.sellStrangle(portItem);
        } else if (portItem.primaryLegs) {
          let orderType = null;
          if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
            orderType = OrderTypes.call;
          } else if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
            orderType = OrderTypes.put;
          }
          const estPrice = await this.orderHandlingService.getEstimatedPrice(portItem.primaryLegs[0].symbol);
          this.cartService.addOptionOrder(portItem.name, [portItem.primaryLegs[0]], estPrice, portItem.primaryLegs[0].quantity, orderType, 'Sell', 'Profit target met');
        } else if (portItem.shares) {
          await this.cartService.portfolioSell(portItem, 'Price target reached');
        }
      });
    }
  }
}
