import { Injectable } from '@angular/core';
import { BacktestService, CartService, PortfolioInfoHolding, PortfolioService, ReportingService } from '@shared/services';
import { round } from 'lodash';
import * as moment from 'moment-timezone';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { PriceTargetService } from './price-target.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

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
  addedOrdersCount = 0;
  maxTradeCount = 10;
  lastSpyMl = 0;
  lastMarketHourCheck = null;
  sessionStart = null;
  sessionEnd = null;
  riskToleranceList = [
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral,
    RiskTolerance.Greed
  ];

  constructor(private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService,
    private machineDaytradingService: MachineDaytradingService,
    private strategyBuilderService: StrategyBuilderService,
    private backtestService: BacktestService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService
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
    console.log('Start addPerfectPair');
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
    console.log('MlBuys', MlBuys);
    console.log('MlSells', MlSells);

    for (const buyKey in MlBuys) {
      if (MlSells[buyKey] && MlSells[buyKey].length) {
        const cash = await this.getMinMaxCashForOptions();
        await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
          MlBuys[buyKey], MlSells[buyKey],
          cash.minCash, cash.maxCash, 'Perfect pair');
      }
    }
  }

  async addAnyPair(currentHoldings, buyList = null, sellList = null) {
    console.log('Start addAnyPair');
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }

      if (!buyList) {
        const buys = backtestResults.filter(backtestData => backtestData.ml > 0.5 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY'));
        buys.sort((a, b) => a.pnl - b.pnl);
        buyList = buys.map(b => b.stock);
        this.reportingService.addAuditLog(null, `Buys: ${buyList.join(', ')}`);
      }
      if (!sellList) {
        const sells = sellList ? sellList : backtestResults.filter(backtestData => backtestData.ml < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL'));
        sells.sort((a, b) => b.pnl - a.pnl);
        sellList = sells.map(b => b.stock);
        this.reportingService.addAuditLog(null, `Sells: ${sellList.join(', ')}`);
      }
      console.log('sorted', buyList, sellList);
      const cash = await this.getMinMaxCashForOptions();

      let initial = null;
      while (buyList.length && sellList.length && !initial) {
        initial = await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
          [buyList.pop()], [sellList.pop()],
          cash.minCash, cash.maxCash, 'Any pair', true);
      }
      return initial;
    }
    return null;
  }

  async checkIntradayStrategies() {
    const start = moment().tz('America/New_York').set({ hour: 10, minute: 15 });
    const end = moment().tz('America/New_York').set({ hour: 11, minute: 0 });
    if (moment().isAfter(moment(start)) &&
      moment().isBefore(moment(end))) {
      const isDown = await this.priceTargetService.isDownDay();
      if (isDown) {
        const spy = 'SPY';
        const callOption = await this.strategyBuilderService.getCallStrangleTrade(spy);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(callOption.call.bid, callOption.call.ask);
        this.cartService.addSingleLegOptionOrder(spy, [callOption.call],
          estimatedPrice, 1, OrderTypes.call, 'Buy',
          'Buying the dip');
      }
    }
  }

  hasReachedBuyLimit(addedOrdersCount = this.addedOrdersCount) {
    return (this.optionsOrderBuilderService.getTradingPairs().length + addedOrdersCount + this.cartService.buyOrders.length + this.cartService.otherOrders.length) > this.maxTradeCount;
  }

  getTechnicalIndicators(stock: string, startDate: string, currentDate: string) {
    return this.backtestService.getBacktestEvaluation(stock, startDate, currentDate, 'daily-indicators');
  }

  getStopLoss(low: number, high: number) {
    const profitTakingThreshold = round(((high / low) - 1) / 2, 4);
    const stopLoss = profitTakingThreshold * -1;
    return {
      profitTakingThreshold,
      stopLoss
    }
  }

  async addBuy(holding: PortfolioInfoHolding, allocation, reason) {
    if ((this.addedOrdersCount + this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
      this.addedOrdersCount++;
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicators = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicators.low, indicators.high);
        await this.cartService.portfolioBuy(holding,
          allocation || this.riskToleranceList[this.riskCounter],
          thresholds.profitTakingThreshold,
          thresholds.stopLoss, reason);
        await this.orderHandlingService.intradayStep(holding.name);
      } catch (error) {
        console.log('Error getting backtest data for ', holding.name, error);
      }
    }
  }

  async findSwingStockCallback(symbol: string, prediction: number, backtestData: any) {
    if ((prediction > 0.7 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
      const stock: PortfolioInfoHolding = {
        name: symbol,
        pl: 0,
        netLiq: 0,
        shares: 0,
        alloc: 0,
        recommendation: 'None',
        buyReasons: '',
        sellReasons: '',
        buyConfidence: 0,
        sellConfidence: 0,
        prediction: null
      };
      await this.addBuy(stock, null, 'Swing trade buy');
    }
  }

  async buyUpro(reason: string = 'Buy UPRO', allocation = null) {
    if (!allocation) {
      const backtestData = await this.strategyBuilderService.getBacktestData('SPY');
      allocation = backtestData.ml > 0 ? backtestData.ml : 0.01;
    }
    const stock: PortfolioInfoHolding = {
      name: 'UPRO',
      pl: 0,
      netLiq: 0,
      shares: 0,
      alloc: 0,
      recommendation: 'None',
      buyReasons: '',
      sellReasons: '',
      buyConfidence: 0,
      sellConfidence: 0,
      prediction: null
    };
    await this.addBuy(stock, allocation, reason);
  }

  async getNewTrades(cb = null, list = null, currentHoldings) {
    if (list) {
      this.machineDaytradingService.setCurrentStockList(list);
    } else if (!this.machineDaytradingService.getCurrentStockList()) {
      this.machineDaytradingService.setCurrentStockList(CurrentStockList);
    }
    let stock;
    const found = (name) => {
      return Boolean(currentHoldings.find((value) => value.name === name));
    };
    let counter = this.machineDaytradingService.getCurrentStockList().length;
    while (counter > 0 && !this.hasReachedBuyLimit()) {
      do {
        stock = this.machineDaytradingService.getNextStock();
      } while (found(stock))
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock);
      if (backtestResults) {
        if (cb) {
          cb(stock, backtestResults.ml, backtestResults);
        } else {
          this.findSwingStockCallback(stock, backtestResults.ml, backtestResults);
        }
      }
      counter--;
    }
  }

  setLastSpyMl(val: number) {
    this.lastSpyMl = val;
  }

  getLastSpyMl() {
    return this.lastSpyMl;
  }

  async sellOptionsHolding(holding: PortfolioInfoHolding, reason: string) {
    let orderType = null;
    if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
      orderType = OrderTypes.call;
    } else if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
      orderType = OrderTypes.put;
    }
    const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
    this.cartService.addSingleLegOptionOrder(holding.name, [holding.primaryLegs[0]], estPrice, holding.primaryLegs[0].quantity, orderType, 'Sell', reason);
  }

  sellLoser(currentHoldings: PortfolioInfoHolding[]) {
    currentHoldings.sort((a, b) => a.pl - b.pl);
    const toBeSold = currentHoldings.slice(0, 1);
    toBeSold.forEach(async (holdingInfo) => {
      if (this.cartService.isStrangle(holdingInfo)) {
        this.optionsOrderBuilderService.sellStrangle(holdingInfo);
      } else if (holdingInfo.shares) {
        await this.cartService.portfolioSell(holdingInfo, 'Selling loser');
      } else if (holdingInfo.primaryLegs) {
        await this.sellOptionsHolding(holdingInfo, 'Selling loser');
      }
    });
  }

  async checkIfTooManyHoldings(currentHoldings: any[], maxHoldings = this.maxTradeCount) {
    if (currentHoldings.length > maxHoldings) {
      this.sellLoser(currentHoldings);
    }
  }

  async balanceCallPutRatio(holdings: PortfolioInfoHolding[]) {
    const results = this.priceTargetService.getCallPutBalance(holdings);
    if (results.put + (results.put * this.getLastSpyMl()) > results.call) {
      const targetBalance = Number(results.put - results.call);
      console.log('SPY', targetBalance, `Balance call put ratio. Calls: ${results.call}, Puts: ${results.put}, Target: ${targetBalance}`);
    } else if (results.call / results.put > 2) {
      this.sellLoser(holdings);
    }
  }

  private marketHourCheck(marketHour: any) {
    return marketHour && marketHour.equity && marketHour.equity.EQ && Boolean(marketHour.equity.EQ.isOpen);
  }

  isMarketOpened() {
    if (this.lastMarketHourCheck && Math.abs(this.lastMarketHourCheck.diff(moment(), 'minutes')) < 20) {
      return of(false);
    }
    return this.portfolioService.getEquityMarketHours(moment().format('YYYY-MM-DD')).pipe(
      map((marketHour: any) => {
        const isOpen = this.marketHourCheck(marketHour);
        this.sessionStart = marketHour?.equity?.EQ?.sessionHours?.regularMarket?.[0]?.start;
        this.sessionEnd = marketHour?.equity?.EQ?.sessionHours?.regularMarket?.[0]?.end;
        if (!isOpen) {
          this.lastMarketHourCheck = moment();
        }
        console.log('sessionStart', moment(this.sessionStart).diff(moment(), 'minutes'), moment(this.sessionStart).format('HH:mm YYYY-MM-DD'));
        console.log('sessionEnd', moment(this.sessionEnd).diff(moment(), 'minutes'), moment(this.sessionEnd).format('HH:mm YYYY-MM-DD'));
        return isOpen;
      })
    );
  }
}
