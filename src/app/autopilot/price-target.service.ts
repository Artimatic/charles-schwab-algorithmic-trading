import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService, ReportingService } from '@shared/services';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { PortfolioWeightsService } from './portfolio-weights.service';
import * as moment from 'moment-timezone';
import { round } from 'lodash-es';

@Injectable({
  providedIn: 'root'
})
export class PriceTargetService {
  targetDiff = 0.023;
  portfolioPl = null;
  startingBalance: { date: string, balance: number } = null;
  lastTargetMet = null;
  portfolioVolatility = 0;

  constructor(private backtestService: BacktestService,
    private portfolioService: PortfolioService,
    private cartService: CartService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private globalSettingsService: GlobalSettingsService,
    private portfolioWeightsService: PortfolioWeightsService
  ) { }

  getPortfolioVolatility() {
    return this.portfolioVolatility;
  }

  async setTargetDiff() {
    const holdings = await this.cartService.findCurrentPositions();
    let portfolioVolatility = await this.portfolioWeightsService.getPortfolioVolatility(holdings);
    this.portfolioVolatility = round(portfolioVolatility, 2);
    const tenYrYield = await this.globalSettingsService.get10YearYield();
    const target = ((tenYrYield + 1.618034) * 0.01 * this.portfolioVolatility) + 0.01;
    this.targetDiff = round((!target || target < 0.01 || target > 0.04) ? this.targetDiff : target, 4);
    this.reportingService.addAuditLog(null, `Target set to ${this.targetDiff}`);
    this.reportingService.addAuditLog(null, `Current portfolio volatility: ${this.portfolioVolatility}`);
  }

  isProfitable(invested: number, pl: number, target = 0.05) {
    return this.getDiff(invested, invested + pl) > target;
  }

  notProfitable(invested: number, pl: number, target = 0) {
    return this.getDiff(invested, invested + pl) < target;
  }

  private skipPnL(current) {
    if (current.currentDayCost > 0) {
      return true;
    }
    
    return false;
  }

  async todaysPortfolioPl() {
    const portData = await this.portfolioService.getTdPortfolio().toPromise();
    if (!portData) {
      return null;
    }
    const todayPl = portData.reduce((acc, curr) => {
      if (this.skipPnL(curr)) {
        return acc;
      }
      acc.profitLoss += curr.currentDayProfitLoss;
      acc.total += curr.marketValue;
      return acc;
    }, { profitLoss: 0, total: 0 });
    console.log('todayPl', todayPl);

    return round(this.getDiff(todayPl.total, todayPl.total + todayPl.profitLoss), 4);
  }

  getDiff(cost, currentValue) {
    return (currentValue - cost) / cost;
  }

  async isDownDay() {
    const symbol = 'SPY';
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const diff = this.getDiff(price[symbol].quote.closePrice, price[symbol].quote.lastPrice);
    return diff < 0;
  }

  async hasMetPriceTarget(target = null) {
    if (!target) {
      target = this.targetDiff;
    }

    if (this.lastTargetMet && moment().diff(this.lastTargetMet, 'hours') > 10) {
      return false;
    }
    const symbol = 'SPY';
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
    const portfolioPl = await this.todaysPortfolioPl();
    if (!portfolioPl) {
      return false;
    }
    const priceTarget = this.getDiff(price[symbol].quote.closePrice, price[symbol].quote.lastPrice) + target;
    this.portfolioPl = round(portfolioPl, 4);
    this.reportingService.addAuditLog(null, `Portfolio PnL: ${portfolioPl}. target: ${priceTarget}`);

    const balance = await this.portfolioService.getTdBalance().toPromise();
    const targetUtilization = new Date().getDate() * 0.005;
    const actualUtilization = (1 - (balance.cashBalance / balance.liquidationValue));
    if (actualUtilization < targetUtilization) {
      this.reportingService.addAuditLog(null, `Utilization requirements not met. Target ${targetUtilization}, Actual ${actualUtilization}`);
      return false;
    }

    if (portfolioPl && portfolioPl > priceTarget) {
      this.reportingService.addAuditLog(null, `Profit target met.`);
      this.lastTargetMet = moment();
      this.targetDiff = round(this.targetDiff * 1.25, 4);
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
