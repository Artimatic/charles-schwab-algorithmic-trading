import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService } from '@shared/services';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';

@Injectable({
  providedIn: 'root'
})
export class PriceTargetService {
  targetDiff = 0.008;
  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private orderHandlingService: OrderHandlingService
  ) { }

  async todaysPortfolioPl() {
    const portData = await this.portfolioService.getTdPortfolio().toPromise();
    const todayPl = portData.reduce((acc, curr) => {
      acc.profitLoss += (curr.currentDayCost + curr.currentDayProfitLoss);
      acc.total += curr.marketValue;
      return acc;
    }, { profitLoss: 0, total: 0});
    return this.getDiff(todayPl.total, todayPl.total + todayPl.profitLoss);
  }

  getDiff(cost, currentValue) {
    return  (currentValue - cost) / cost;
  }

  async hasMetPriceTarget() {
      const symbol = 'SPY';
      const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
      const portfolioPl = await this.todaysPortfolioPl();
      const priceTarget = this.getDiff(price[symbol].quote.closePrice, price[symbol].quote.lastPrice) + this.targetDiff;
      console.log('Profit', portfolioPl, ', target:', priceTarget);

      if (portfolioPl && portfolioPl > priceTarget) {
        return true;
      }
      return false;
  }

  async checkProfitTarget(retrievedHoldings: PortfolioInfoHolding[] = null) {
    const targetMet = await this.hasMetPriceTarget();
    if (targetMet) {
      console.log('Profit target met.');
      const holdings = retrievedHoldings? retrievedHoldings : await this.cartService.findCurrentPositions();
      holdings.forEach(async(portItem: PortfolioInfoHolding) => {
        if (this.cartService.isStrangle(portItem)) {
          await this.optionsOrderBuilderService.sellStrangle(portItem);
        } else if (portItem.primaryLegs) {
          let orderType = null;
          if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
            orderType = OrderTypes.call;
          } else if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
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

  getCallPutBalance(retrievedHoldings: PortfolioInfoHolding[]) {
    return retrievedHoldings.reduce((previousValue, portItem: PortfolioInfoHolding) => {
      if (portItem.primaryLegs && !portItem.secondaryLegs) {
        if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
          previousValue.call += portItem.netLiq;
        } else if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
          previousValue.put += portItem.netLiq;
        }
      }
      return previousValue
    }, { call: 0, put: 0});
  }
}
