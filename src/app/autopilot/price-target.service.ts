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
  liquidationValue = 0;
  startingBalance: { date: string, balance: number } = null;
  lastTargetMet = null;
  portfolioVolatility = 0;
  lastCallPutRatio: { datetime: string, value: number } = null;

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
    let targetYield = 3;;
    if (tenYrYield > 1 && tenYrYield < 10) {
      targetYield = tenYrYield;
    } else if (tenYrYield < 1) {
      targetYield = tenYrYield * 100;
    }
    const target = (((targetYield + 1.618034) * 0.1) * ((this.portfolioVolatility * 0.03) + 0.01)) + 0.023;
    this.targetDiff = round((!target) ? this.targetDiff : target, 4);
    this.reportingService.addAuditLog(null, `Target set to ${this.targetDiff}`);
    this.reportingService.addAuditLog(null, `Current portfolio volatility: ${this.portfolioVolatility}`);
    this.reportingService.addAuditLog(null, `Ten Year Yield High: ${targetYield}`);
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

    const result = round(this.getDiff(todayPl.total, todayPl.total + todayPl.profitLoss), 4) || 0;

    // Save result in localStorage by date for the last 5 days
    try {
      const key = 'todaysPortfolioPlHistory';
      const today = moment().format('YYYY-MM-DD');
      let history = [];
      const existing = localStorage.getItem(key);
      if (existing) {
        history = JSON.parse(existing);
      }
      // Remove any entry for today
      history = history.filter(entry => entry.date !== today);
      history = history.slice(-2);
      // Add today's result
      history.push({ date: today, value: result });
      
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      // Ignore localStorage errors
    }

    return result;
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

    if (portfolioPl && portfolioPl > priceTarget) {
      if (portfolioPl > priceTarget * 5) {
        const portData = await this.portfolioService.getTdPortfolio().toPromise();
        try {
          this.reportingService.addAuditLog(null, `Profit loss may be inaccurate: ${portfolioPl} ${JSON.stringify(portData)}`);
        } catch (e) {
          console.error('Error saving portfolio data', e);
        } 
        return false;
      } else {
        this.reportingService.addAuditLog(null, `Profit target met.`);
        this.lastTargetMet = moment();
        this.targetDiff = round(this.targetDiff * 1.8, 4);
      }
  
      return true;
    }
    return false;
  }

  async checkProfitTarget(retrievedHoldings: PortfolioInfoHolding[] = null, target = this.targetDiff) {
    const targetMet = await this.hasMetPriceTarget(target);
    if (targetMet) {
      this.cartService.deleteBuyOrders();
      const holdings = retrievedHoldings ? retrievedHoldings : await this.cartService.findCurrentPositions();
      holdings.forEach(async (portItem: PortfolioInfoHolding) => {
        if (this.liquidationValue > 25000 || !this.reportingService.findBuyLogBySymbol(portItem.name)) {
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
    }, { call: 1, put: 1 });
  }

  async hasBuyTrend(symbol: string) {
    const currentDate = moment().format('YYYY-MM-DD');
    const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
    const backtest = await this.backtestService.getBacktestEvaluation(symbol, startDate, currentDate, 'daily-indicators').toPromise();
    const signals = backtest.signals;
    const lastSignal = signals[signals.length - 1];
    if (lastSignal.mfiPrevious < lastSignal.mfiLeft) {
      return true;
    }

    return false;
  }

  async hasSellTrend(symbol: string) {
    const currentDate = moment().format('YYYY-MM-DD');
    const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
    const backtest = await this.backtestService.getBacktestEvaluation(symbol, startDate, currentDate, 'daily-indicators').toPromise();
    const signals = backtest.signals;
    const lastSignal = signals[signals.length - 1];
    if (lastSignal.mfiPrevious > lastSignal.mfiLeft) {
      return true;
    }

    return false;
  }
  async getCallPutRatio(volatility: number) {
    if (this.lastCallPutRatio && moment().diff(moment(this.lastCallPutRatio.datetime), 'minutes') < 35) {
      return this.lastCallPutRatio.value;
    }

    let putsThreshold = volatility ? (volatility * 0.20) + 0.4 : 0.5;

    const currentDate = moment().format('YYYY-MM-DD');
    const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
    const spyBacktest = await this.backtestService.getBacktestEvaluation('SPY', startDate, currentDate, 'daily-indicators').toPromise();
    const signals = spyBacktest.signals;
    const lastSignal = signals[signals.length - 1];

    if (lastSignal.mfiPrevious > lastSignal.mfiLeft) {
      putsThreshold += 0.05;
    }
    if (lastSignal?.bband80[1][0] > lastSignal.close) {
      putsThreshold += 0.05;
    }
    if (lastSignal?.support[0] > lastSignal.close) {
      putsThreshold += 0.05;
    }
    this.lastCallPutRatio = { datetime: moment().format(), value: putsThreshold };
    return putsThreshold;
  }

  setLiquidationValue(val: number) {
    this.liquidationValue = val;
  }
}
