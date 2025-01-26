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
import { GlobalSettingsService } from '../settings/global-settings.service';

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
  maxTradeCount = 8;
  lastSpyMl = 0;
  volatility = 0;
  lastMarketHourCheck = null;
  sessionStart = null;
  sessionEnd = null;
  riskToleranceList = [
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral
  ];
  isOpened = false;
  maxHoldings = 100;

  constructor(private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService,
    private machineDaytradingService: MachineDaytradingService,
    private strategyBuilderService: StrategyBuilderService,
    private backtestService: BacktestService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService,
    private globalSettingsService: GlobalSettingsService
  ) {
    const globalStartStop = this.globalSettingsService.getStartStopTime();
    this.sessionStart = globalStartStop.startDateTime;
    this.sessionEnd = globalStartStop.endDateTime;
  }

  async getMinMaxCashForOptions() {
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
    const minCash = maxCash - (cash * RiskTolerance.Zero);
    return {
      maxCash,
      minCash
    };
  }

  async addPairsFromHashMap(MlBuys, MlSells, currentHoldings, reason) {
    for (const buyKey in MlBuys) {
      if (MlSells[buyKey] && MlSells[buyKey].length) {
        const cash = await this.getMinMaxCashForOptions();
        await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
          MlBuys[buyKey], MlSells[buyKey],
          cash.minCash, cash.maxCash, reason);
      }
    }
  }

  async addVolatilityPairs(currentHoldings) {
    console.log('Start addVolatilityPairs');
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const key = Math.round(savedBacktest[saved].impliedMovement * 100);
        const symbol = backtestObj.stock
        if (backtestObj.ml > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongbuy') {
          if (MlBuys[key]) {
            MlBuys[key].push(symbol);
          } else {
            MlBuys[key] = [symbol];
          }
        } else if (backtestObj.sellMl !== null && backtestObj.sellMl > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongsell') {
          if (MlSells[key]) {
            MlSells[key].push(symbol);
          } else {
            MlSells[key] = [symbol];
          }
        }
      }
    }
    await this.addPairsFromHashMap(MlBuys, MlSells, currentHoldings, 'Volatility pairs');
  }

  async addPerfectPair(currentHoldings) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const sellSignalStr = savedBacktest[saved]?.sellSignals?.sort()?.join();
        const buySignalStr = savedBacktest[saved]?.buySignals?.sort()?.join();
        const key = (sellSignalStr || '') + '-' + (buySignalStr || '') + Math.round(savedBacktest[saved].impliedMovement * 100);
        const symbol = backtestObj.stock
        if (backtestObj.ml > 0.5 && this.priceTargetService.isProfitable(backtestObj.invested, backtestObj.net) && backtestObj.recommendation.toLowerCase() === 'strongbuy') {
          if (MlBuys[key]) {
            MlBuys[key].push(symbol);
          } else {
            MlBuys[key] = [symbol];
          }
        } else if (backtestObj?.sellMl > 0.5 && this.priceTargetService.notProfitable(backtestObj.invested, backtestObj.net) && backtestObj.recommendation.toLowerCase() === 'strongsell') {
          if (MlSells[key]) {
            MlSells[key].push(symbol);
          } else {
            MlSells[key] = [symbol];
          }
        }
      }
    }
    await this.addPairsFromHashMap(MlBuys, MlSells, currentHoldings, 'Perfect pair');
  }

  async addMLPairs(currentHoldings, useSellSignal = true) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const signals = useSellSignal ? backtestObj.sellSignals : backtestObj.buySignals;
        if (signals && signals.length) {
          const key = signals?.sort()?.join();
          const symbol = backtestObj.stock;
          if (key) {
            if (backtestObj.ml > 0.6 && backtestObj.recommendation === 'STRONGBUY') {
              if (MlBuys[key]) {
                MlBuys[key].push(symbol);
              } else {
                MlBuys[key] = [symbol];
              }
            } else if (backtestObj?.sellMl > 0.6 && backtestObj.recommendation === 'STRONGSELL') {
              if (MlSells[key]) {
                MlSells[key].push(symbol);
              } else {
                MlSells[key] = [symbol];
              }
            }
          }
        }
      }
    }
    await this.addPairsFromHashMap(MlBuys, MlSells, currentHoldings, 'ML pairs');
  }

  async addAnyPair(currentHoldings, buyList = null, sellList = null) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }

      if (!buyList) {
        const buys = backtestResults.filter(backtestData => backtestData?.ml > 0.5 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY'));
        buys?.sort((a, b) => a.pnl - b.pnl);
        buyList = buys.map(b => b.stock);
        this.reportingService.addAuditLog(null, `Buys: ${buyList.join(', ')}`);
      }
      if (!sellList) {
        const sells = sellList ? sellList : backtestResults.filter(backtestData => backtestData?.sellMl > 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL'));
        sells?.sort((a, b) => b.pnl - a.pnl);
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
    if (!holding.name) {
      throw Error('Ticker is missing')
    }
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

    createHoldingObj(name: string) {
      return {
        name,
        symbol: name,
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

  async findAnyPair(currentHoldings, minCashAllocation: number, maxCashAllocation: number) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let buys = [];
    let sells = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        buys.push(backtestObj);
        sells.push(backtestObj);
      }
      let minMl = 1;
      while (minMl > 0.1 && buys.length) {
        buys = buys?.filter(backtestData => backtestData?.ml && backtestData.ml > minMl && backtestData.recommendation === 'STRONGBUY');
        buys?.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        sells = sells?.filter(backtestData => backtestData?.sellMl && backtestData.sellMl > minMl && backtestData.recommendation === 'STRONGSELL');
        sells?.sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        minMl -= 0.05;
      }
      if (buys.length && sells.length) {
        await this.optionsOrderBuilderService.balanceTrades(currentHoldings, [buys.pop()], [sells.pop()], minCashAllocation, maxCashAllocation, 'Find any pair');
      }
    }
  }

  async findTopBuy(count = 1) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      let minMl = 1;
      while (minMl > 0.1 && backtestResults.length) {
        backtestResults = backtestResults?.filter(backtestData => backtestData?.ml && backtestData.ml > minMl && backtestData.recommendation === 'STRONGBUY');
        backtestResults?.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        minMl -= 0.05;
      }
      if (backtestResults.length) {
        let counter = 0;
        while (counter < count && backtestResults.length) {
          counter++;
          const candidate = backtestResults.pop();
          if (!candidate.stock) {
            console.log('candidate', candidate);
            throw Error('Invalid stock');
          }
          await this.addBuy(this.createHoldingObj(candidate.stock), null, 'Buy top stock');
        }
      }
    }
  }

  async buyOnRecommendation() {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      backtestResults = backtestResults?.filter(backtestData => backtestData.recommendation === 'STRONGBUY');
      backtestResults?.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));

      if (backtestResults.length) {
        const candidate = backtestResults.pop();
        if (!candidate.stock) {
          console.log('candidate', candidate);
          throw Error('Invalid stock');
        }
        await this.addBuy(this.createHoldingObj(candidate.stock), null, 'Buy on recommendation');
      }
    }
  }

  async findTopNotSell() {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let backtestResults = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      let minMl = 0;
      while (minMl < 0.5 && backtestResults.length) {
        backtestResults = backtestResults?.filter(backtestData => backtestData.sellMl !== undefined && backtestData.sellMl > minMl);
        backtestResults?.sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        minMl += 0.05;
      }
      if (backtestResults.length) {
        const candidate = backtestResults.pop();
        if (!candidate.stock) {
          console.log('candidate', candidate);
          throw Error('Invalid stock');
        }
        await this.addBuy(this.createHoldingObj(candidate.stock), null, 'Buy top not sell stock');
      }
    }
  }

  async buyUpro(reason: string = 'Buy UPRO', allocation = null) {
    if (!allocation) {
      const backtestData = await this.strategyBuilderService.getBacktestData('SPY');
      allocation = backtestData.ml > 0 ? backtestData.ml : 0.01;
    }

    await this.addBuy(this.createHoldingObj('UPRO'), allocation, reason);
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
          await cb(stock, backtestResults.ml, backtestResults);
        } else {
          await this.findSwingStockCallback(stock, backtestResults.ml, backtestResults);
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

  setVolatilityMl(val: number) {
    this.volatility = val;
  }

  getVolatilityMl() {
    return this.volatility;
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

  sellLoser(currentHoldings: PortfolioInfoHolding[], reason = 'Selling loser') {
    currentHoldings.sort((a, b) => a.pl - b.pl);
    const toBeSold = currentHoldings.slice(0, 1);
    toBeSold.forEach(async (holdingInfo) => {
      if (this.cartService.isStrangle(holdingInfo)) {
        this.optionsOrderBuilderService.sellStrangle(holdingInfo);
      } else if (holdingInfo.shares) {
        await this.cartService.portfolioSell(holdingInfo, reason);
      } else if (holdingInfo.primaryLegs) {
        await this.sellOptionsHolding(holdingInfo, 'Selling loser');
      }
    });
  }

  async checkIfTooManyHoldings(currentHoldings: any[], maxHoldings = this.maxHoldings) {
    if (currentHoldings.length > maxHoldings) {
      this.sellLoser(currentHoldings, 'Too many holdings');
    }
  }

  async balanceCallPutRatio(holdings: PortfolioInfoHolding[]) {
    const results = this.priceTargetService.getCallPutBalance(holdings);
    this.reportingService.addAuditLog(null, `Calls: ${results.call}, Puts: ${results.put}, ratio: ${results.call / results.put}`);
    if (results.put > 0 && results.call === 0) {
      if (results.put + (results.put * this.getLastSpyMl() * (this.riskToleranceList[this.riskCounter] * 3) * (1 - this.volatility)) > results.call) {
        const targetBalance = Number(results.put - results.call);
        console.log('SPY', targetBalance, `Balance call put ratio. Calls: ${results.call}, Puts: ${results.put}, Target: ${targetBalance}`);
        this.optionsOrderBuilderService.addOptionByBalance('SPY', targetBalance, 'Balance call put ratio', true);
      } else if (results.call / results.put > (1 + this.getLastSpyMl() + this.riskToleranceList[this.riskCounter])) {
        this.sellLoser(holdings, 'Balancing call put ratio');
        console.log('Sell loser', results.call / results.put, `Balance call put ratio. Calls: ${results.call}, Puts: ${results.put}, Target: ${(1 + this.getLastSpyMl() + this.riskToleranceList[this.riskCounter])}`);
      }
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
        if (marketHour.accountId) {
          return this.isOpened;
        }
        this.isOpened = this.marketHourCheck(marketHour);
        if (marketHour?.equity?.EQ?.sessionHours?.regularMarket[0]) {
          this.sessionStart = moment(marketHour?.equity?.EQ?.sessionHours?.regularMarket[0]?.start).tz('America/New_York').toDate();
          this.sessionEnd = moment(marketHour?.equity?.EQ?.sessionHours?.regularMarket[0]?.end).tz('America/New_York').toDate();
        } else if (!this.isOpened && !this.sessionStart && !this.sessionEnd) {
          const globalStartStop = this.globalSettingsService.getStartStopTime(1);
          this.sessionStart = globalStartStop.startDateTime;
          this.sessionEnd = globalStartStop.endDateTime;
        }

        if (!this.isOpened) {
          this.lastMarketHourCheck = moment();
        }

        return this.isOpened;
      })
    );
  }
}
