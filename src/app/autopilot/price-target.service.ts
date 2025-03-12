import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService, ReportingService } from '@shared/services';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { PortfolioWeightsService } from './portfolio-weights.service';

@Injectable({
  providedIn: 'root'
})
export class PriceTargetService {
  targetDiff = 0.023;
  portfolioPl = null;
  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private cartService: CartService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private globalSettingsService: GlobalSettingsService,
    private portfolioWeightsService: PortfolioWeightsService
  ) { }

  async setTargetDiff() {
    const holdings = await this.cartService.findCurrentPositions();
    const portfolioVolatility = await this.portfolioWeightsService.getPortfolioVolatility(holdings);
    const tenYrYield = await this.globalSettingsService.get10YearYield();
    const target = ((tenYrYield +  1.618034) * 0.01 * portfolioVolatility) + 0.008;
    this.targetDiff = (!target || target < 0.01 || target > 0.04) ? this.targetDiff : target;
    this.reportingService.addAuditLog(null, `Target set to ${this.targetDiff}`);
  }

  isProfitable(invested: number, pl: number, target = 0.05) {
    return this.getDiff(invested, invested + pl) > target;
  }

  notProfitable(invested: number, pl: number, target = 0) {
    return this.getDiff(invested, invested + pl) < target;
  }

  async todaysPortfolioPl() {
    const portData = await this.portfolioService.getTdPortfolio().toPromise();
    if (!portData) {
      return null;
    }
    const todayPl = portData.reduce((acc, curr) => {
      if (curr.instrument.assetType.toUpperCase() === 'OPTION') {
        acc.profitLoss += (curr.averageLongPrice * 100 * curr.longQuantity) - curr.marketValue;
      } else {
        acc.profitLoss += (curr.averageLongPrice * curr.longQuantity) - curr.marketValue;
      }
      acc.total += curr.marketValue;
      return acc;
    }, { profitLoss: 0, total: 0 });
    return this.getDiff(todayPl.total, todayPl.total + todayPl.profitLoss);
  }

  getDiff(cost, currentValue) {
    return (currentValue - cost) / cost;
  }

  async isDownDay() {
    const symbol = 'SPY';
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const diff = this.getDiff(price[symbol].quote.closePrice, price[symbol].quote.lastPrice);
    return diff < 0.002;
  }

  async hasMetPriceTarget(target = null) {
    if (!target) {
      target = this.targetDiff;
    }
    const symbol = 'SPY';
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const portfolioPl = await this.todaysPortfolioPl();
    if (!portfolioPl) {
      return false;
    }
    const priceTarget = this.getDiff(price[symbol].quote.closePrice, price[symbol].quote.lastPrice) + target;
    this.portfolioPl = portfolioPl;
    this.reportingService.addAuditLog(null, `Portfolio PnL: ${portfolioPl}. target: ${priceTarget}`);
    if (portfolioPl && portfolioPl > priceTarget) {
      this.reportingService.addAuditLog(null, `Profit target met.`);
      return true;
    }
    return false;
  }

  async checkProfitTarget(retrievedHoldings: PortfolioInfoHolding[] = null, target = this.targetDiff) {
    const targetMet = await this.hasMetPriceTarget(target);
    if (targetMet) {
      const holdings = retrievedHoldings ? retrievedHoldings : await this.cartService.findCurrentPositions();
      holdings.forEach(async (portItem: PortfolioInfoHolding) => {
        if (portItem.primaryLegs) {
          let orderType = null;
          if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
            orderType = OrderTypes.call;
          } else if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
            orderType = OrderTypes.put;
          }
          const estPrice = await this.orderHandlingService.getEstimatedPrice(portItem.primaryLegs[0].symbol);
          this.cartService.addSingleLegOptionOrder(portItem.name, [portItem.primaryLegs[0]], estPrice, portItem.primaryLegs[0].quantity, orderType, 'Sell', 'Profit target met', true);
        } else {
          await this.cartService.portfolioSell(portItem, `Price target reached. Portfolio profit: ${this.portfolioPl}`, true);
        }
      });
    }
    return targetMet;
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
    }, { call: 0, put: 0 });
  }

  calculateOptionChangeOfProfit(delta: number) {
    return delta;
  }
}
