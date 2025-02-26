import { Component, Injectable, OnDestroy, OnInit } from '@angular/core';
import { AiPicksService, AuthenticationService, BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService } from '@shared/services';
import { divide, round } from 'lodash';
import * as moment from 'moment-timezone';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { PriceTargetService } from './price-target.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { map, takeUntil } from 'rxjs/operators';
import { of, Subject, Subscription } from 'rxjs';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { Options } from '@shared/models/options';
import { Trade } from '@shared/models/trade';
import { OrderingService } from '@shared/ordering.service';
import { AiPicksPredictionData } from '@shared/services/ai-picks.service';
import * as moment from 'moment';
import { MenuItem, MessageService } from 'primeng/api';
import { DynamicDialogRef, DialogService } from 'primeng/dynamicdialog';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { BacktestAggregatorService } from '../backtest-table/backtest-aggregator.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { PortfolioMgmtService } from '../portfolio-mgmt/portfolio-mgmt.service';
import { PricingService } from '../pricing/pricing.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { ProfitLossRecord } from './autopilot.component';
import { FindDaytradeService } from './find-daytrade.service';

export enum SwingtradeAlgorithms {
  demark9 = 'demark9',
  macd = 'macd',
  mfi = 'mfi',
  mfiDivergence = 'mfiDivergence',
  mfiDivergence2 = 'mfiDivergence2',
  mfiLow = 'mfiLow',
  mfiTrade = 'mfiTrade',
  roc = 'roc',
  vwma = 'vwma',
  bband = 'bband'
}

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

export enum Strategy {
  Default = 'Default',
  DaytradeShort = 'DaytradeShort',
  Daytrade = 'Daytrade',
  Swingtrade = 'Swingtrade',
  InverseSwingtrade = 'InverseSwingtrade',
  Short = 'Short',
  TrimHoldings = 'TrimHoldings',
  DaytradeFullList = 'DaytradeFullList',
  StateMachine = 'StateMachine',
  SingleStockPick = 'SingleStockPick',
  MLSpy = 'MLSpy',
  OptionsStrangle = 'OptionsStrangle',
  TradingPairs = 'TradingPairs',
  BuyCalls = 'BuyCalls',
  BuyPuts = 'BuyPuts',
  BuySnP = 'Buy S&P500',
  BuyWinners = 'Buy Winners',
  BuyML = 'Buy by ML signal',
  MLPairs = 'ML trade pairs',
  VolatilityPairs = 'Implied Movement trade pairs',
  SellMfiTrade = 'Buy by mfi trade sell signal',
  BuyMfiTrade = 'Buy by mfi trade buy signal',
  SellMfiDiv = 'Buy by mfi divergence sell signal',
  BuyMfiDiv = 'Buy by mfi divergence buy signal',
  BuyMfi = 'Buy by mfi buy signal',
  BuyMacd = 'Buy by macd buy signal',
  SellMfi = 'Buy by mfi sell signal',
  BuyBband = 'Buy by bband buy signal',
  SellBband = 'Buy by bband sell signal',
  InverseDispersion = 'Inverse dispersion trade',
  PerfectPair = 'Perfect Pair',
  AnyPair = 'Any Pair',
  BuyDemark = 'Buy demark',
  None = 'None'
}

@Injectable({
  providedIn: 'root'
})
export class AutopilotService {
  riskCounter = 0;
  addedOrdersCount = 0;
  maxTradeCount = 10;
  lastSpyMl = 0;
  volatility = 0;
  lastMarketHourCheck = null;
  sessionStart = null;
  sessionEnd = null;
  riskToleranceList = [
    RiskTolerance.One,
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral
  ];
  isOpened = false;
  maxHoldings = 100;
  lastBuyList = [];
  lastOptionsCheckCheck = null;
  currentHoldings: PortfolioInfoHolding[] = [];
  strategyList = [
    Strategy.Default,
    Strategy.InverseDispersion,
    Strategy.BuyMfiTrade,
    Strategy.BuyMfiDiv,
    Strategy.BuyMfi,
    Strategy.TrimHoldings,
    Strategy.PerfectPair,
    Strategy.BuyCalls,
    Strategy.BuyMacd,
    Strategy.BuyBband,
    Strategy.TrimHoldings,
    Strategy.Short,
    Strategy.SellMfi,
    Strategy.BuyML,
    Strategy.SellBband,
    Strategy.BuySnP,
    Strategy.MLPairs,
    Strategy.TrimHoldings,
    Strategy.TradingPairs,
    Strategy.BuyDemark,
    Strategy.VolatilityPairs,
    Strategy.BuyWinners,
    Strategy.TrimHoldings
    //Strategy.None
  ];

  strategyCounter = 0;

  intradayProcessCounter = 0;

  constructor(private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService,
    private machineDaytradingService: MachineDaytradingService,
    private strategyBuilderService: StrategyBuilderService,
    private backtestService: BacktestService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService,
    private globalSettingsService: GlobalSettingsService,
    private authenticationService: AuthenticationService,
    private daytradeService: DaytradeService,
    private daytradeStrategiesService: DaytradeStrategiesService,
    private machineLearningService: MachineLearningService
  ) {
    const globalStartStop = this.globalSettingsService.getStartStopTime();
    this.sessionStart = globalStartStop.startDateTime;
    this.sessionEnd = globalStartStop.endDateTime;
  }

  async getMinMaxCashForOptions(modifier = 1) {
    const cash = await this.cartService.getAvailableFunds(false);
    const minConstant = modifier ? (cash * RiskTolerance.Zero * modifier)  : 1000;
    const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
    const minCash = maxCash - minConstant;
    return {
      maxCash,
      minCash
    };
  }

  async addPairsFromHashMap(MlBuys, MlSells, reason) {
    for (const buyKey in MlBuys) {
      if (MlSells[buyKey]?.length && MlSells[buyKey]?.length) {
        this.strategyBuilderService.createStrategy(`${reason} Pair trade`, reason, MlSells[buyKey], MlSells[buyKey], reason);
      }
    }
  }

  async addVolatilityPairs() {
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
    await this.addPairsFromHashMap(MlBuys, MlSells, 'Volatility pairs');
  }

  async bearPair(currentHoldings) {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = ['SPY'];
    const MlSells = [];
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const symbol = backtestObj.stock
        if (backtestObj?.sellMl > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongsell') {
          MlSells.push(symbol);
        }
      }
    }
    const cash = await this.getMinMaxCashForOptions();
    while (MlSells.length) {
      await this.optionsOrderBuilderService.balanceTrades(currentHoldings,
        MlBuys, [MlSells.pop()],
        cash.minCash, cash.maxCash, 'Bear pair');
    }
  }

  async addPerfectPair() {
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
    await this.addPairsFromHashMap(MlBuys, MlSells, 'Perfect pair');
  }

  async addMLPairs(useSellSignal = true) {
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
            if (backtestObj.ml > 0.5 && backtestObj.recommendation === 'STRONGBUY') {
              if (MlBuys[key]) {
                MlBuys[key].push(symbol);
              } else {
                MlBuys[key] = [symbol];
              }
            } else if (backtestObj?.sellMl > 0.5 && backtestObj.recommendation === 'STRONGSELL') {
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
    await this.addPairsFromHashMap(MlBuys, MlSells, 'ML pairs');
  }

  async checkIntradayStrategies() {
    const start = moment().tz('America/New_York').set({ hour: 10, minute: 15 });
    const end = moment().tz('America/New_York').set({ hour: 11, minute: 0 });
    if (moment().isAfter(moment(start)) &&
      moment().isBefore(moment(end))) {
      const isDown = await this.priceTargetService.isDownDay();
      if (isDown) {
        this.reportingService.addAuditLog(null, 'Down day, buy the dip');
        const spy = 'SPY';
        const callOption = await this.strategyBuilderService.getCallStrangleTrade(spy);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(callOption.call.bid, callOption.call.ask);
        this.cartService.addSingleLegOptionOrder(spy, [callOption.call],
          estimatedPrice, 1, OrderTypes.call, 'Buy',
          'Buying the dip');
      }
    }
  }

  hasReachedBuyLimit(addedOrdersCount = this.addedOrdersCount, limit = this.maxTradeCount) {
    return (this.optionsOrderBuilderService.getTradingPairs().length + addedOrdersCount + this.cartService.buyOrders.length + this.cartService.otherOrders.length) > limit;
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
      const backtestData = await this.strategyBuilderService.getBacktestData(holding.name);

      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicator = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicator.low, indicator.high);
        await this.cartService.portfolioBuy(holding,
          allocation || ((1 - backtestData.impliedMovement) / 10),
          thresholds.profitTakingThreshold,
          thresholds.stopLoss, reason);
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

  getBuyList(filter = (data) => data.recommendation === 'STRONGBUY'): string[] {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let backtestResults = [];
    let newList = [];

    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      let minMl = 1;
      while (minMl > 0 && !newList.length) {
        newList = backtestResults?.filter(backtestData => filter(backtestData) && backtestData?.ml && backtestData.ml > minMl);
        minMl -= 0.1;
      }
    }
    newList?.sort((a, b) => b?.ml - a?.ml);
    console.log('new list', newList);
    return newList.map(s => s.stock);
  }

  getSellList(filter = (data) => data.recommendation === 'STRONGSELL'): string[] {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    let backtestResults = [];
    let newList = [];

    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      let minMl = 1;
      while (minMl > 0 && !newList.length) {
        newList = backtestResults?.filter(backtestData => filter(backtestData) && backtestData?.sellMl && backtestData.sellMl > minMl);
        minMl -= 0.1;
      }
    }
    newList?.sort((a, b) => b?.sellMl - a?.sellMl);

    return newList.map(s => s.stock);
  }

  async findAnyPair() {
    const buys = this.getBuyList()
    const sells = this.getSellList();
    this.addPair(buys, sells, 'Any pair');
  }

  async findMlOnlyPair() {
    const buys = this.getBuyList(() => true)
    const sells = this.getSellList(() => true);
    this.addPair(buys, sells, 'ML pair');
  }

  async findTopBuy() {
    const buys = this.getBuyList();
    for (const b of buys) {
      await this.addBuy(this.createHoldingObj(b), null, 'Buy top stock');
    }
  }

  addPair(buys: string[], sells: string[], reason) {
    let buyCounter = 0;
    let sellCounter = 0;
    while (buyCounter < buys.length) {
      while (sellCounter < sells.length) {
        this.strategyBuilderService.createStrategy(`${buys[buyCounter]} ${reason}`, buys[buyCounter], [buys[buyCounter]], [sells[sellCounter]], reason);
        sellCounter++;
      }
      buyCounter++;
    }
  }

  addPairOnSignal(indicator: SwingtradeAlgorithms, direction: 'buy' | 'sell') {
    let buyFilterFn = null;
    let sellFilterFn = null;
    if (direction === 'buy') {
      buyFilterFn = (backtestData) => backtestData.buySignals && backtestData.buySignals.find(sig => sig === indicator);
      sellFilterFn = (backtestData) => backtestData.sellSignals && backtestData.sellSignals.find(sig => sig === indicator);
    } else {
      sellFilterFn = (backtestData) => backtestData.buySignals && backtestData.buySignals.find(sig => sig === indicator);
      buyFilterFn = (backtestData) => backtestData.sellSignals && backtestData.sellSignals.find(sig => sig === indicator);
    }

    const buys = this.getBuyList(buyFilterFn);
    const sells = this.getSellList(sellFilterFn);
    console.log(`${indicator} ${direction}`, buys, sells);
    this.addPair(buys, sells, `${direction} ${indicator}`);
  }

  async buyOnSignal(indicator: SwingtradeAlgorithms, direction: 'buy' | 'sell') {
    let buyFilterFn = null;
    if (direction === 'buy') {
      buyFilterFn = (backtestData) => backtestData.buySignals && backtestData.buySignals.find(sig => sig === indicator);
    } else {
      buyFilterFn = (backtestData) => backtestData.sellSignals && backtestData.sellSignals.find(sig => sig === indicator);
    }

    const buys = this.getBuyList(buyFilterFn);
    console.log(`${indicator} ${direction}`, buys);
    if (buys.length) {
      const candidate = buys.pop();
      await this.addBuy(this.createHoldingObj(candidate), this.riskToleranceList[this.riskCounter], `${direction} ${indicator}`);
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
      while (minMl < 0.5 && !backtestResults.length) {
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

  async handleBalanceUtilization(currentHoldings) {
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const isOverBalance = Boolean(Number(balance.cashBalance) < 0);
    if (isOverBalance) {
      this.reportingService.addAuditLog(null, 'Over balance');

      currentHoldings = await this.cartService.findCurrentPositions();
      this.sellLoser(currentHoldings, 'Over balance');
    } else {
      const spyPrediction = this.getLastSpyMl() || 0;
      const targetUtilization = Number(new Date().getDate() * 0.005) + spyPrediction - this.getVolatilityMl();
      const actualUtilization = (1 - (balance.cashBalance / balance.liquidationValue));
      if (actualUtilization < targetUtilization) {
        if (this.lastBuyList.length) {
          const buySym = this.lastBuyList.pop();
          this.reportingService.addAuditLog(null, `Underutilized, Target: ${targetUtilization}, Actual: ${actualUtilization}, Buying: ${buySym}`);
          this.buyRightAway(buySym, this.riskToleranceList[0]);
        } else {
          this.lastBuyList = this.getBuyList();
        }
      }
    }
    return isOverBalance;
  }

  async buyRightAway(buySymbol, alloc: number) {
    const price = await this.portfolioService.getPrice(buySymbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const allocation = alloc > 0 && alloc <= 1 ? alloc : 0.01;
    const cash = (balance.cashBalance < balance.availableFunds * 0.01) ?
      balance.cashBalance :
      (balance.cashBalance * this.riskToleranceList[this.riskCounter] * allocation);
    const quantity = this.strategyBuilderService.getQuantity(price, 1, cash);
    const order = this.cartService.buildOrderWithAllocation(buySymbol, quantity, price, 'Buy',
      1, -0.005, 0.01,
      -0.003, 1, false, 'Buy right away');

    this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
  }

  async sellRightAway(symbol, quantity) {
    const price = await this.portfolioService.getPrice(symbol).toPromise();
    const order = this.cartService.buildOrderWithAllocation(symbol, quantity, price, 'Sell',
      1, -0.005, 0.01,
      -0.003, 1, false, 'Sell right away');

    this.daytradeService.sendSell(order, 'market', () => { }, () => { }, () => {});
  }

  async buyUpro(reason: string = 'Buy UPRO', allocation = null) {
    if (!allocation) {
      const backtestData = await this.strategyBuilderService.getBacktestData('SPY');
      allocation = backtestData?.ml > 0 && backtestData?.ml < 0.6 ? backtestData.ml : 0.01;
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
      const backtestResults = this.strategyBuilderService.getRecentBacktest(stock, 5);
      if (backtestResults) {
        if (cb) {
          await cb(stock, backtestResults.ml, backtestResults, backtestResults.sellMl);
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

  isVolatilityHigh() {
    return this.volatility > 0.28;
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

  async addShort(balance = 0) {
    const sells = this.getSellList()
    if (sells.length) {
      const sellSym = sells.pop();
      const backtestResults = await this.strategyBuilderService.getBacktestData(sellSym);

      const targetBalance = balance ? balance : (await this.getMinMaxCashForOptions(backtestResults.impliedMovement + 1)).maxCash;
      this.optionsOrderBuilderService.addOptionByBalance(sellSym, targetBalance, 'Buy put', false, false);
    }
  }

  async balanceCallPutRatio(holdings: PortfolioInfoHolding[]) {
    const results = this.priceTargetService.getCallPutBalance(holdings);
    this.reportingService.addAuditLog(null, `Calls: ${results.call}, Puts: ${results.put}, ratio: ${results.call / results.put}`);
    if (results.put > 0 && results.call > 0) {
      if (results.put + (results.put * this.getLastSpyMl() * (this.riskToleranceList[this.riskCounter] * 3) * (1 - this.volatility)) > results.call) {
        const targetBalance = Number(results.put - results.call);
        this.reportingService.addAuditLog(null, `Add calls Balance call put ratio. Calls: ${results.call}, Puts: ${results.put}, Target: ${targetBalance}`);
        this.optionsOrderBuilderService.addOptionByBalance('SPY', targetBalance, 'Balance call put ratio', true);
        const sqqqHolding = holdings.find(h => h.name.toUpperCase() === 'SQQQ');
        await this.sellRightAway(sqqqHolding.name, sqqqHolding.shares);
        await this.buyRightAway('TQQQ', this.riskToleranceList[0]);
      } else if (results.call / results.put > (1 + this.getLastSpyMl() + this.riskToleranceList[this.riskCounter])) {
        this.addShort(results.put - results.call);
        this.reportingService.addAuditLog(null, 'Add put' + results.call / results.put + `Balance call put ratio. Calls: ${results.call}, Puts: ${results.put}, Target: ${(1 + this.getLastSpyMl() + this.riskToleranceList[this.riskCounter])}`);
        const tqqqHolding = holdings.find(h => h.name.toUpperCase() === 'TQQQ');
        const uproHolding = holdings.find(h => h.name.toUpperCase() === 'UPRO');
        await this.sellRightAway(tqqqHolding.name, tqqqHolding.shares);
        await this.sellRightAway(uproHolding.name, uproHolding.shares);
        await this.buyRightAway('SQQQ', this.riskToleranceList[0]);
      }
    }
  }

  private marketHourCheck(marketHour: any) {
    return marketHour && marketHour.equity && marketHour.equity.EQ && Boolean(marketHour.equity.EQ.isOpen);
  }

  checkCredentials() {
    const accountId = sessionStorage.getItem('accountId');
    if (accountId) {
      this.authenticationService.checkCredentials(accountId).subscribe();
    }
  }

  isMarketOpened() {
    if (this.lastMarketHourCheck && Math.abs(this.lastMarketHourCheck.diff(moment(), 'minutes')) < 20) {
      return of(this.isOpened);
    }
    return this.portfolioService.getEquityMarketHours(moment().format('YYYY-MM-DD')).pipe(
      map((marketHour: any) => {
        if (!marketHour.equity) {
          this.checkCredentials();
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

  updateVolatility() {
    this.machineLearningService.trainVolatility(moment().format('YYYY-MM-DD'),
      moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.6, 5, 0).subscribe((result) => {
        this.setVolatilityMl(result[0].nextOutput);
      });
  }

  async checkStopLoss(holding: PortfolioInfoHolding, stopLoss = -0.045, profitTarget = 0.01) {
    const pnl = holding.pnlPercentage;
    const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);

    const isOptionOnly = holding.primaryLegs && !holding.shares;
    const impliedMove = await this.optionsOrderBuilderService.getImpliedMove(holding.name, backtestResults);
    if (backtestResults.averageMove) {
      if (isOptionOnly) {
        stopLoss = impliedMove * -3;
        this.reportingService.addAuditLog(holding.name, `Setting options stop loss to ${stopLoss}`);
        profitTarget = impliedMove * 5;
        this.reportingService.addAuditLog(holding.name, `Setting options profit target to ${profitTarget}`);
      } else if (holding.assetType === 'collective_investment') {
        stopLoss = impliedMove * -2;
        this.reportingService.addAuditLog(holding.name, `Setting stock stop loss to ${stopLoss}`);
        profitTarget = impliedMove * 3;
        this.reportingService.addAuditLog(holding.name, `Setting stock profit target to ${profitTarget}`);
      } else {
        stopLoss = impliedMove * -0.6;
        this.reportingService.addAuditLog(holding.name, `Setting stock stop loss to ${stopLoss}`);
        profitTarget = impliedMove * 1.2;
        this.reportingService.addAuditLog(holding.name, `Setting stock profit target to ${profitTarget}`);
      }
      if (pnl < stopLoss) {
        if (isOptionOnly) {
          await this.sellOptionsHolding(holding, `Options stop loss reached ${pnl}`);
        } else {
          await this.cartService.portfolioSell(holding, `Stop loss met ${pnl}`);
        }
      } else if (pnl > profitTarget) {
        if (isOptionOnly) {
          await this.sellOptionsHolding(holding, `Options price target reached ${pnl}`);
        } else {
          await this.cartService.portfolioSell(holding, `Price target met ${pnl}`);
        }
      } else if (pnl > 0 && pnl < (profitTarget * 0.2)) {
        if (!isOptionOnly) {
          await this.addBuy(holding, this.riskToleranceList[0], 'Adding to position');
        }
      }
    }
  }

  async executeOrderList() {
    const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
    const orders = buyAndSellList.concat(this.cartService.otherOrders);
    for (let i = 0; i < orders.length; i++) {
      const symbol = orders[i].holding.symbol;
      if (!this.daytradeStrategiesService.shouldSkip(symbol)) {
        await this.orderHandlingService.intradayStep(symbol);
      }
    }
  }

  private async intradayProcess() {
    if (this.intradayProcessCounter > 4) {
      this.intradayProcessCounter = 0;
    }
    this.currentHoldings = await this.cartService.findCurrentPositions();

    switch (this.intradayProcessCounter) {
      case 0: {
        await this.checkIntradayStrategies();
        break;
      }
      case 1: {
        await this.balanceCallPutRatio(this.currentHoldings);
        break;
      }
      case 2: {
        await this.handleBalanceUtilization(this.currentHoldings);
        break;
      }
      default: {
        await this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
        break;
      }
    }
    this.intradayProcessCounter++;
  }

  handleIntraday() {
    if (moment().isAfter(moment(this.sessionStart).add(25, 'minutes')) &&
      moment().isBefore(moment(this.sessionEnd).subtract(5, 'minutes'))) {
      this.isMarketOpened().subscribe(async (isOpen) => {
        if (isOpen) {
          if (!this.lastOptionsCheckCheck || Math.abs(moment().diff(this.lastOptionsCheckCheck, 'minutes')) > 15) {
            this.lastOptionsCheckCheck = moment();
            await this.intradayProcess();
          } else {
            await this.executeOrderList();
          }
        }
      });
      return true;
    } else {
      return false;
    }
  }
}
@Component({
  selector: 'app-autopilot',
  templateUrl: './autopilot.component.html',
  styleUrls: ['./autopilot.component.scss']
})
export class AutopilotComponent implements OnInit, OnDestroy {
  display = false;
  isLoading = true;
  defaultInterval = 121000;
  interval = 120000;
  oneDayInterval;
  timer: Subscription;
  alive = false;
  destroy$ = new Subject();
  maxHoldings = 100;
  addedOrdersCount = 0;
  developedStrategy = false;
  tradingPairsCounter = 0;

  dayTradeRiskCounter = 0;

  dayTradingRiskToleranceList = [
    RiskTolerance.Low,
    RiskTolerance.ExtremeFear,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.ExtremeGreed
  ];

  backtestBuffer$;

  lastInterval = null;

  lastMarketHourCheck = null;
  lastCredentialCheck;

  revealPotentialStrategy = false;

  strategies: PotentialTrade[] = [];

  dialogRef: DynamicDialogRef | undefined;

  lastReceivedRecommendation = null;
  boughtAtClose = false;
  boughtAtOpen = false;
  multibuttonOptions: MenuItem[];
  startButtonOptions: MenuItem[];
  tradingPairs: SmartOrder[][] = [];
  manualStart = false;
  daytradeMode = false;
  isLive = false;
  tradeObserverSub;

  constructor(
    private portfolioService: PortfolioService,
    private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private dailyBacktestService: DailyBacktestService,
    private messageService: MessageService,
    private scoreKeeperService: ScoreKeeperService,
    private reportingService: ReportingService,
    private machineDaytradingService: MachineDaytradingService,
    private findPatternService: FindPatternService,
    private machineLearningService: MachineLearningService,
    private globalSettingsService: GlobalSettingsService,
    public dialogService: DialogService,
    private findDaytradeService: FindDaytradeService,
    private pricingService: PricingService,
    private orderHandlingService: OrderHandlingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private portfolioMgmtService: PortfolioMgmtService,
    private priceTargetService: PriceTargetService,
    public autopilotService: AutopilotService,
    private backtestAggregatorService: BacktestAggregatorService,
    private aiPicksService: AiPicksService,
    private orderingService: OrderingService,
    private newStockFinderService: NewStockFinderService
  ) { }

  ngOnInit(): void {
    const lastStrategy = JSON.parse(localStorage.getItem('profitLoss'));
    if (lastStrategy && lastStrategy.lastStrategy) {
      const lastStrategyCount = this.autopilotService.strategyList.findIndex(strat => strat.toLowerCase() === lastStrategy.lastStrategy.toLowerCase());
      this.autopilotService.strategyCounter = lastStrategyCount >= 0 ? lastStrategyCount : 0;
      this.autopilotService.riskCounter = lastStrategy.lastRiskTolerance || 0;
      console.log('Previous profit loss', lastStrategy);
    } else {
      this.autopilotService.strategyCounter = 0;
    }

    this.startButtonOptions = [
      {
        label: 'Start orders without auto manage',
        command: async () => {
          this.manualStart = true;
          this.destroy$ = new Subject();
          if (this.backtestBuffer$) {
            this.backtestBuffer$.unsubscribe();
          }
          this.backtestBuffer$ = new Subject();

          this.display = true;
          this.startInterval();
          this.interval = this.defaultInterval;
          this.messageService.add({
            severity: 'success',
            summary: 'Trading started'
          });
          this.newStockFinderService.addOldList();
        }
      }
    ];

    this.multibuttonOptions = [
      {
        label: 'Sell All',
        command: async () => {
          await this.sellAll();
        }
      },
      {
        label: 'Set credentials',
        command: async () => {
          this.autopilotService.checkCredentials();
        }
      },
      {
        label: 'Print cart',
        command: async () => {
          console.log('Buy', this.cartService.buyOrders);
          console.log('Sell', this.cartService.sellOrders);
          console.log('Other', this.cartService.otherOrders);
        }
      },
      {
        label: 'Test intraday ml',
        command: async () => {
          this.autopilotService.updateVolatility();
          this.machineLearningService
            .trainDaytrade('APP',
              moment().add({ days: 1 }).format('YYYY-MM-DD'),
              moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
              0.8,
              this.globalSettingsService.daytradeAlgo
            ).subscribe(async (result) => {
              console.log(result);
              const activationResult = await this.machineLearningService.activate('APP',
                this.globalSettingsService.daytradeAlgo).toPromise();
              console.log(activationResult);
            });
        }
      },
      {
        label: 'Test handle strategy',
        command: async () => {
          await this.handleStrategy();
        }
      },
      {
        label: 'Test ml',
        command: async () => {
          const buyFeatures = Array(66).fill(1);

          const featuresToTry = [buyFeatures];
          // for (let i = 0; i < buyFeatures.length; i++) {
          //   featuresToTry.push(buyFeatures.slice(0, i).concat([0]).concat(buyFeatures.slice(i + 1)));
          // }
          console.log('buyFeatures', buyFeatures);
          console.log('featuresToTry', featuresToTry);
          const endDate = moment().format('YYYY-MM-DD');
          const list = ['AMD', 'GOOG', 'CRWD', 'DELL', 'META', 'NVDA'];
          const allScores = [];
          const parameters = [
            // { days: 700, range: 4, limit: 0.08, trainingSize: 0.9 },
            // { days: 700, range: 4, limit: 0.045, trainingSize: 0.9 },
            // { days: 700, range: 4, limit: 0.06, trainingSize: 0.9 },
            // { days: 700, range: 4, limit: 0.055, trainingSize: 0.9 },
            { days: 700, range: 4, limit: 0.04, trainingSize: 0.9 },
            // { days: 700, range: 4, limit: 0.03, trainingSize: 0.9 },
            // { days: 700, range: 4, limit: 0.035, trainingSize: 0.9 }
          ];
          for (const p of parameters) {
            for (const f of featuresToTry) {
              for (const sym1 of list) {
                const train = await this.machineLearningService.trainBuy(sym1, endDate,
                  moment().subtract({ day: p.days }).format('YYYY-MM-DD'), p.trainingSize, f, p.range, p.limit).toPromise();
                allScores.push({ days: p.days, score: train[0].score, features: f.join(), symbol: sym1, range: p.range, limit: p.limit });
                console.log(sym1, 'Train', f, train[0].score, train[0].predictionHistory.filter(r => r.prediction > 0.5).map((val) => {
                  return { date: val.date, prediction: val.prediction, actual: val.actual[0] };
                }));

                const activate = await this.machineLearningService.activateBuy(sym1, endDate,
                  moment().subtract({ day: p.days }).format('YYYY-MM-DD'), p.trainingSize, f, p.range, p.limit).toPromise();
                allScores.push({ days: p.days, score: activate[0].score, features: f.join(), symbol: sym1, range: p.range, limit: p.limit });
                console.log(sym1, 'Activate', f, activate[0].score, activate[0].predictionHistory.filter(r => r.prediction > 0.5).map((val) => {
                  return { date: val.date, prediction: val.prediction, actual: val.actual[0] };
                }));

                // const result2 = await this.machineLearningService.trainSellOff(sym1, endDate,
                //   moment().subtract({ day: 1000 }).format('YYYY-MM-DD'), 0.8, null, 10, -0.03).toPromise();
                // console.log(sym1, 'SELL', result2[0].score, result2[0].predictionHistory.filter(r => r.prediction > 0.6));
                // const result1 = await this.machineLearningService.trainMfiBuy(sym1, endDate,
                //   moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.8, 10, 0.05).toPromise();
                // console.log(sym1, 'MFI', result1[0].score, result1[0].predictionHistory.filter(r => r.prediction > 0.6));
              }
            }
          }
          console.log(allScores.sort((a, b) => b.score - a.score).filter((a) => a.score > 0.5));
          //console.log(allScores.filter((a) => a.score > 0.4));
        }
      },
      {
        label: 'Test api',
        command: async () => {
          const currentHoldings = await this.cartService.findCurrentPositions();
          for (const holding of currentHoldings) {
            if (holding.shares) {
              const price = await this.portfolioService.getPrice(holding.name).toPromise();
              const orderSizePct = 0.5;
              const order = this.cartService.buildOrderWithAllocation(holding.name,
                holding.shares,
                price,
                'Sell',
                orderSizePct, -0.005, 0.01, -0.003, null, true);
              const result = await this.orderingService.getRecommendationAndProcess(order).toPromise();
              console.log('sell result', result);
            }
          }
          const buys = this.autopilotService.getBuyList();
          for (const buy of buys) {
            const price = await this.portfolioService.getPrice(buy).toPromise();
            const order = this.cartService.buildOrderWithAllocation(buy, 1, price, 'Buy',
              0.5, -0.005, 0.01, -0.003, null, true);
            const result = await this.orderingService.getRecommendationAndProcess(order).toPromise();
            console.log('buy result', result);
          }
        }
      },
    ];
  }

  open() {
    this.manualStart = false;

    this.destroy$ = new Subject();
    if (this.backtestBuffer$) {
      this.backtestBuffer$.unsubscribe();
    }
    this.backtestBuffer$ = new Subject();

    this.display = true;
    this.startInterval();
    this.interval = this.defaultInterval;
    this.messageService.add({
      severity: 'success',
      summary: 'Trading started'
    });
  }

  startInterval() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
    this.setupStrategy();
    this.timer = TimerObservable.create(1000, this.interval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        if (!this.lastCredentialCheck || Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 25) {
          if (moment().isAfter(moment(this.autopilotService.sessionEnd).add(60, 'minutes')) &&
            moment().isBefore(moment(this.autopilotService.sessionStart).add(65, 'minutes'))) {
            await this.setupStrategy();
          }
          await this.autopilotService.isMarketOpened().toPromise();
          this.lastCredentialCheck = moment();
          await this.backtestOneStock(true, false);
          this.padOrders();
        } else if (moment().isAfter(moment(this.autopilotService.sessionEnd).subtract(25, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd).subtract(20, 'minutes'))) {
          console.log('Buy on close');
          if (!this.boughtAtClose) {
            await this.buySellAtCloseOrOpen();
          }

          this.boughtAtClose = true;
          this.hedge();
        } else if (moment().isAfter(moment(this.autopilotService.sessionEnd)) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd).add(5, 'minute'))) {
          if (this.reportingService.logs.length > 5) {
            const profitLog = `Profit ${this.scoreKeeperService.total}`;
            this.reportingService.addAuditLog(null, profitLog);
            this.reportingService.exportAuditHistory();
            this.setProfitLoss();

            setTimeout(async () => {
              await this.modifyRisk();
              this.scoreKeeperService.resetTotal();
              this.resetCart();
            }, 31000);
          }
        } else if (this.autopilotService.handleIntraday()) {
          const metTarget = await this.priceTargetService.checkProfitTarget(this.autopilotService.currentHoldings);
          if (metTarget) {
            this.decreaseRiskTolerance();
          }
          if (this.autopilotService.strategyList[this.autopilotService.strategyCounter] === Strategy.Daytrade &&
            (this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length) < this.autopilotService.maxTradeCount && (!this.lastReceivedRecommendation || Math.abs(this.lastReceivedRecommendation.diff(moment(), 'minutes')) > 5)) {
            this.triggerDaytradeRefresh();
          }
        } else if (moment().isAfter(moment(this.autopilotService.sessionStart).subtract(Math.floor(this.interval / 60000) * 2, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionStart))) {
          await this.setupStrategy();
        } else {
          if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 50) {
            this.aiPicksService.mlNeutralResults.next(null);
          }
          await this.backtestOneStock(false, false);
          await this.newStockFinderService.processOneStock();
        }
      });
  }

  calculatePl(records) {
    let profit = 0;
    for (let key in records) {
      if (records[key]) {
        profit += Number(records[key].toFixed(2));
      }
    }

    return profit;
  }

  setProfitLoss() {
    const tempProfitRecord = this.scoreKeeperService.profitLossHash;

    if (tempProfitRecord) {
      const profit = this.calculatePl(tempProfitRecord);

      const profitObj: ProfitLossRecord = {
        'date': moment().format(),
        profit: profit,
        lastStrategy: this.autopilotService.strategyList[this.autopilotService.strategyCounter],
        lastRiskTolerance: this.autopilotService.riskCounter,
        profitRecord: tempProfitRecord
      };
      localStorage.setItem('profitLoss', JSON.stringify(profitObj));
    }
  }

  stop() {
    this.display = false;
    this.timer.unsubscribe();
    this.cleanUp();
    this.messageService.add({
      severity: 'danger',
      summary: 'Autopilot stopped'
    });
  }

  resetCart() {
    this.optionsOrderBuilderService.clearTradingPairs();
    this.autopilotService.addedOrdersCount = 0;
    this.cartService.removeCompletedOrders();
    this.cartService.otherOrders = [];
    this.cartService.buyOrders = [];
    this.developedStrategy = false;
    this.strategyBuilderService.sanitizeData();
  }

  decreaseRiskTolerance() {
    this.autopilotService.riskCounter = 0;
    const msg = `Decrease risk to ${this.autopilotService.riskToleranceList[this.autopilotService.riskCounter]}`;
    console.log(msg);
    this.reportingService.addAuditLog(this.autopilotService.strategyList[this.autopilotService.strategyCounter], msg);
    this.saveRisk();
  }

  decreaseDayTradeRiskTolerance() {
    if (this.dayTradeRiskCounter > 0) {
      this.dayTradeRiskCounter = 0;
    }
    this.changeStrategy();
  }

  increaseRiskTolerance() {
    if (this.autopilotService.riskCounter < this.autopilotService.riskToleranceList.length - 1) {
      this.autopilotService.riskCounter++;
    }
    this.changeStrategy();

    const msg = `Increase risk to ${this.autopilotService.riskToleranceList[this.autopilotService.riskCounter]}`;
    console.log(msg);
    this.reportingService.addAuditLog(this.autopilotService.strategyList[this.autopilotService.strategyCounter], msg);
    this.saveRisk();
  }

  increaseDayTradeRiskTolerance() {
    if (this.dayTradeRiskCounter < this.dayTradingRiskToleranceList.length - 1) {
      this.dayTradeRiskCounter++;
    }
  }

  saveRisk() {
    const profitObj: ProfitLossRecord = {
      'date': moment().format(),
      profit: 0,
      lastStrategy: this.autopilotService.strategyList[this.autopilotService.strategyCounter],
      lastRiskTolerance: this.autopilotService.riskCounter,
      profitRecord: {}
    };
    const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
    if (lastProfitLoss && lastProfitLoss.profit) {
      profitObj.date = lastProfitLoss.date;
      profitObj.profit = lastProfitLoss.profit;
      profitObj.profitRecord = lastProfitLoss.profitRecord;
    }

    localStorage.setItem('profitLoss', JSON.stringify(profitObj));
  }

  changeStrategy(saveOption = false) {
    if (this.autopilotService.strategyCounter < this.autopilotService.strategyList.length - 1) {
      this.autopilotService.strategyCounter++;
    } else {
      this.autopilotService.strategyCounter = 0;
    }
    const strat = this.autopilotService.strategyList[this.autopilotService.strategyCounter];
    const msg = `Strategy changed to ${strat}. Risk tolerance ${this.autopilotService.riskCounter}`;
    this.messageService.add({
      severity: 'info',
      summary: msg
    });

    console.log(msg);
    this.reportingService.addAuditLog(null, msg);

    if (this.autopilotService.strategyList[this.autopilotService.strategyCounter] === 'Daytrade') {
      this.daytradeMode = true;
    }

    if (saveOption) {
      this.saveRisk();
    }
  }

  async setupStrategy() {
    this.autopilotService.updateVolatility();
    this.priceTargetService.setTargetDiff();
    this.backtestAggregatorService.clearTimeLine();

    this.developedStrategy = true;

    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    this.autopilotService.currentHoldings = await this.cartService.findCurrentPositions();

    await this.modifyCurrentHoldings();
  }

  isBuyPrediction(prediction: { label: string; value: AiPicksPredictionData[]; }) {
    if (prediction) {
      let predictionSum = 0;
      for (const p of prediction.value) {
        predictionSum += p.prediction;
      }

      if (predictionSum / prediction.value.length > 0.7) {
        return true;
      } else if (predictionSum / prediction.value.length < 0.3) {
        return false;
      }
    }
    return null;
  }

  async backtestOneStock(overwrite = false, addTrade = true) {
    try {
      let stock = this.machineDaytradingService.getNextStock();
      while (Boolean(this.autopilotService.currentHoldings.find((value) => value.name === stock))) {
        stock = this.machineDaytradingService.getNextStock();
      }
      await this.strategyBuilderService.getBacktestData(stock, overwrite);
    } catch (error) {
      console.log('Error finding new trade', error);
    }
  }

  triggerBacktestNext() {
    this.backtestBuffer$.next();
  }

  async addDaytrade(stock: string) {
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.autopilotService.maxTradeCount) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const indicators = await this.autopilotService.getTechnicalIndicators(stock, startDate, currentDate).toPromise();
        const thresholds = this.autopilotService.getStopLoss(indicators.low, indicators.high);
        await this.portfolioDaytrade(stock,
          round(this.dayTradingRiskToleranceList[this.dayTradeRiskCounter], 2),
          thresholds.profitTakingThreshold,
          thresholds.stopLoss);
      } catch (error) {
        console.log('Error getting backtest data for daytrade', stock, error);
        await this.portfolioDaytrade(stock,
          round(this.dayTradingRiskToleranceList[this.dayTradeRiskCounter], 2),
          null,
          null);
      }
    }
  }

  getLastTradeDate() {
    return this.globalSettingsService.getLastTradeDate();
  }

  setLoading(value: boolean) {
    this.isLoading = value;
  }

  async modifyCurrentHoldings() {
    this.autopilotService.currentHoldings.forEach(async (holding) => {
      await this.autopilotService.checkStopLoss(holding);

      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
        if (holding.primaryLegs) {
          if (this.cartService.isStrangle(holding)) {
            const { callsTotalPrice, putsTotalPrice } = await this.pricingService.getPricing(holding.primaryLegs, holding.secondaryLegs);
            if (putsTotalPrice > callsTotalPrice && backtestResults && backtestResults.sellMl !== null && backtestResults.sellMl > 0.6) {
              this.optionsOrderBuilderService.sellStrangle(holding);
            } else if (callsTotalPrice > putsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7) {
              this.optionsOrderBuilderService.sellStrangle(holding);
            }
          } else if (!holding.secondaryLegs) {
            //this.optionsOrderBuilderService.hedgeTrade(holding.name, this.autopilotService.currentHoldings);
          }
        } else if ((backtestResults && (backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL' || holding.name === 'TQQQ'))) {
          console.log('Backtest indicates sell', backtestResults);
          await this.cartService.portfolioSell(holding, 'Backtest indicates sell');
        } else if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7 && (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY')) {
          console.log('Backtest indicates buying', backtestResults);
          await this.autopilotService.addBuy(this.autopilotService.createHoldingObj(holding.name), RiskTolerance.Zero, 'Backtest indicates buying');
        }
      } catch (error) {
        console.log('Backtest error', error);
      }
    });
  }

  analyseIndicators(stock, signals, holdings) {
    this.dailyBacktestService.getSignalScores(signals).subscribe((score) => {
      const foundIdx = holdings.findIndex((value) => {
        return value.name === stock;
      });

      if (!holdings[foundIdx]) {
        return;
      }

      if (holdings[foundIdx].buyReasons) {
        const indicators = holdings[foundIdx].buyReasons.split(',');

        for (const i in indicators) {
          if (indicators.hasOwnProperty(i)) {
            holdings[foundIdx].buyConfidence += score[indicators[i]].bullishMidTermProfitLoss;
            this.analyseRecommendations(holdings[foundIdx]);
          }
        }
      }
      if (holdings[foundIdx].sellReasons) {
        const indicators = holdings[foundIdx].sellReasons.split(',');
        for (const i in indicators) {
          if (indicators.hasOwnProperty(i)) {
            holdings[foundIdx].sellConfidence += score[indicators[i]].bearishMidTermProfitLoss;
            this.analyseRecommendations(holdings[foundIdx]);
          }
        }
      }
    });
  }

  async analyseRecommendations(holding: PortfolioInfoHolding) {
    if (holding.recommendation.toLowerCase() === 'buy') {
      await this.autopilotService.addBuy(holding, null, 'Recommendated buy');
    } else if (holding.recommendation.toLowerCase() === 'sell') {
      await this.cartService.portfolioSell(holding, 'Recommended sell');
    }
  }

  getAllocationPct(totalAllocationPct: number = 0.1, numberOfOrders: number) {
    return round(divide(totalAllocationPct, numberOfOrders), 2);
  }

  async portfolioDaytrade(symbol: string,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null) {
    await this.cartService.portfolioDaytrade(symbol,
      allocation || this.autopilotService.riskToleranceList[this.autopilotService.riskCounter],
      profitThreshold,
      stopLossThreshold);
  }

  getRecommendationReason(recommendation) {
    const reasons = {
      buyReasons: '',
      sellReasons: ''
    };

    const buyReasons = [];
    const sellReasons = [];

    for (const rec in recommendation) {
      if (recommendation.hasOwnProperty(rec)) {
        if (recommendation[rec].toLowerCase() === 'bullish') {
          buyReasons.push(rec);
        } else if (recommendation[rec].toLowerCase() === 'bearish') {
          sellReasons.push(rec);
        }
      }
    }

    reasons.buyReasons += buyReasons.join(',');
    reasons.sellReasons += sellReasons.join(',');

    return reasons;
  }

  scroll() {
    document.getElementById('#autopilot-toolbar').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  runFindPattern() {
    this.findPatternService.developPattern();
  }

  removeStrategy(item) {
    console.log('TODO remove', item);
    this.strategies = this.strategies.filter(s => s.key !== item.key || s.name !== item.name || s.date !== item.date);
    this.strategyBuilderService.removeTradingStrategy(item);
  }

  addOptions() {
    this.dialogService.open(AddOptionsTradeComponent, {
      header: 'Add options trade',
      contentStyle: { 'overflow-y': 'unset' }
    });
  }

  async modifyRisk() {
    const backtestResults = await this.strategyBuilderService.getBacktestData('SPY');

    if (backtestResults && (backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL')) {
      console.log('Backtest recommendation', backtestResults.recommendation);
      this.increaseDayTradeRiskTolerance();
      this.adjustRiskTolerance();
    } else {
      const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
      if (lastProfitLoss && lastProfitLoss.profit) {
        const profit = Number(this.calculatePl(lastProfitLoss.profitRecord));
        const lastProfitMsg = 'Last profit ' + profit;
        console.log(lastProfitMsg);
        this.reportingService.addAuditLog(this.autopilotService.strategyList[this.autopilotService.strategyCounter], lastProfitMsg);
        const metTarget = await this.priceTargetService.hasMetPriceTarget(0);
        if (!metTarget) {
          this.decreaseDayTradeRiskTolerance();
          this.increaseRiskTolerance();
        } else {
          this.increaseDayTradeRiskTolerance();
        }
      }
    }
  }

  async adjustRiskTolerance() {
    const averageMLResult = this.strategyBuilderService.getRecentBacktest().reduce((acc, currentBacktest, idx) => {
      if (currentBacktest && currentBacktest.ml) {
        acc.sum += currentBacktest.ml;
        acc.counter++;
      }
      return acc;
    }, { sum: 0, counter: 0 });
    const averageOutput = (averageMLResult.sum / averageMLResult.counter);
    console.log('Average output', averageOutput);

    if (averageOutput >= 0.3) {
      this.increaseDayTradeRiskTolerance();
      this.increaseRiskTolerance();
    } else {
      this.decreaseRiskTolerance();
      this.decreaseDayTradeRiskTolerance();
    }
  }

  cleanUpOrders() {
    this.cartService.removeCompletedOrders();
    this.cartService.otherOrders.forEach(order => {
      if (order.side.toLowerCase() === 'daytrade' &&
        moment(order.createdTime).diff(moment(), 'minutes') > 60 &&
        order.positionCount === 0) {
        this.cartService.deleteDaytrade(order);
      }
    });
  }

  async buySellAtCloseOrOpen() {
    const overBalance = await this.autopilotService.handleBalanceUtilization(this.autopilotService.currentHoldings);
    if (this.boughtAtClose || this.manualStart || overBalance) {
      return;
    }

    this.boughtAtClose = true;

    const backtestData = await this.strategyBuilderService.getBacktestData('SPY');

    const buySymbol = 'UPRO';

    this.autopilotService.setLastSpyMl(backtestData.ml);
    await this.autopilotService.buyRightAway(buySymbol, backtestData.ml);
  }

  updateStockList() {
    this.dialogService.open(StockListDialogComponent, {
      header: 'Stock list',
      contentStyle: { 'overflow-y': 'auto' }
    });
  }

  startFindingTrades() {
    this.strategyBuilderService.findTrades();
    this.strategies = this.strategyBuilderService.getTradingStrategies();
    return this.revealPotentialStrategy;
  }

  sendStrangleSellOrder(primaryLegs: Options[], secondaryLegs: Options[], price: number) {
    this.portfolioService.sendMultiOrderSell(primaryLegs,
      secondaryLegs, price).subscribe();
  }

  async sellAllStrangle() {
    this.autopilotService.currentHoldings.forEach(async (holding) => {
      if (this.cartService.isStrangle(holding)) {
        const seenPuts = {};
        const seenCalls = {};
        holding.primaryLegs.concat(holding.secondaryLegs).forEach((option: Options) => {
          const putCall = option.putCallInd;
          const expiry = option.description.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)[0];
          if (putCall === 'C') {
            if (!seenCalls[expiry]) {
              seenCalls[expiry] = [];
            }
            seenCalls[expiry].push(option);
          } else if (putCall === 'P') {
            if (!seenPuts[expiry]) {
              seenPuts[expiry] = [];
            }
            seenPuts[expiry].push(option);
          }
        });

        for (const key in seenCalls) {
          if (seenPuts[key]) {
            const fullOrderList = seenCalls[key].concat(seenPuts[key]);
            let fullPrice = 0;
            for (let i = 0; i < fullOrderList.length; i++) {
              fullPrice += await this.orderHandlingService.getEstimatedPrice(fullOrderList[i].symbol);
            }

            this.cartService.addSellStrangleOrder(holding.name, holding.primaryLegs, holding.secondaryLegs, fullPrice, holding.primaryLegs[0].quantity);
          }
        }
      }
    });
  }

  getPreferences() {
    this.portfolioService.getUserPreferences().subscribe(pref => {
      console.log('pref', pref);
    });
  }

  async hedge() {
    await this.portfolioMgmtService.hedge(this.autopilotService.currentHoldings, this.optionsOrderBuilderService.getTradingPairs(), this.autopilotService.riskToleranceList[0], this.autopilotService.riskToleranceList[this.autopilotService.riskCounter]);
  }

  async sellAll() {
    this.autopilotService.currentHoldings = await this.cartService.findCurrentPositions();
    this.autopilotService.currentHoldings.forEach(async (holding) => {
      if (!this.cartService.isStrangle(holding)) {
        if (!holding?.primaryLegs?.length) {
          await this.cartService.portfolioSell(holding, 'Sell all command');
        }
      }
    });
  }

  async sellAllOptions() {
    this.autopilotService.currentHoldings.forEach(async (holding) => {
      if (holding.primaryLegs) {
        const callPutInd = holding.primaryLegs[0].putCallInd.toLowerCase();
        const isStrangle = this.cartService.isStrangle(holding);

        if (isStrangle) {
          this.optionsOrderBuilderService.sellStrangle(holding);
        } else {
          const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
          let orderType = null;
          if (callPutInd === 'c') {
            orderType = OrderTypes.call;
          } else if (callPutInd === 'p') {
            orderType = OrderTypes.put;
          }

          this.cartService.addSingleLegOptionOrder(holding.name, [holding.primaryLegs[0]],
            estPrice, holding.primaryLegs[0].quantity,
            orderType, 'Sell', 'Manual command to sell all options');
        }
      }
    });
  }

  async handleStrategy() {
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    if (balance.liquidationValue < 26000) {
      await this.autopilotService.findTopBuy();
      return;
    }
    switch (this.autopilotService.strategyList[this.autopilotService.strategyCounter]) {
      case Strategy.TradingPairs:
        this.startFindingTrades();
        break;
      case Strategy.TrimHoldings:
        await this.autopilotService.sellLoser(this.autopilotService.currentHoldings);
        break;
      case Strategy.Short:
        await this.autopilotService.addShort();
        break;
      case Strategy.BuyCalls:
        const buys = this.autopilotService.getBuyList();
        if (buys.length) {
          const buysSym = buys.pop();
          const backtestResults = await this.strategyBuilderService.getBacktestData(buysSym);

          const targetBalance = (await this.getMinMaxCashForOptions(backtestResults.impliedMovement + 1)).minCash;
          this.optionsOrderBuilderService.addOptionByBalance(buys.pop(), targetBalance, 'Buy call', true, false);
        }
        break;
      case Strategy.InverseDispersion:
        await this.addInverseDispersionTrade();
        break;
      case Strategy.BuyWinners:
        await this.buyWinners();
        break;
      case Strategy.BuySnP:
        await this.autopilotService.buyUpro();
        break;
      case Strategy.PerfectPair:
        await this.autopilotService.addPerfectPair();
        break;
      case Strategy.MLPairs:
        await this.autopilotService.addMLPairs();
        await this.autopilotService.addMLPairs(false);
        break;
      case Strategy.VolatilityPairs:
        await this.autopilotService.addVolatilityPairs();
        break;
      case Strategy.SellMfiTrade:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'sell');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfiTrade, 'sell');
        }
        break;
      case Strategy.SellMfiDiv:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        }
        break;
      case Strategy.BuyMfiTrade:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfiTrade, 'buy');
        }
        break;
      case Strategy.BuyMfiDiv:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
        }
        break;
      case Strategy.BuyDemark:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.demark9, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.demark9, 'buy');
        }
        break;
      case Strategy.SellMfi:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfi, 'sell');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfi, 'sell');
        }
        break;
      case Strategy.SellBband:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.bband, 'sell');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.bband, 'sell');
        }
        break;
      case Strategy.BuyMfi:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfi, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfi, 'buy');
        }
        break;
      case Strategy.BuyBband:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.bband, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.bband, 'buy');
        }
        break;
      case Strategy.BuyMacd:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.macd, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.macd, 'buy');
        }
        break;
      default: {
        await this.autopilotService.findTopBuy();
        break;
      }
    }

    await this.createTradingPairs();
    if (this.autopilotService.isVolatilityHigh()) {
      await this.autopilotService.sellLoser(this.autopilotService.currentHoldings);
    }
  }

  async buyWinners() {
    const buyWinner = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction > 0.7 && this.priceTargetService.isProfitable(backtestData.invested, backtestData.net)) {
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
        await this.autopilotService.addBuy(stock, null, 'Buy winners');
      }
    };
    await this.autopilotService.getNewTrades(buyWinner, null, this.autopilotService.currentHoldings);
  }

  async getMinMaxCashForOptions(modifier = 0) {
    const minConstant = modifier ? modifier : 1000;
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.autopilotService.riskToleranceList[this.autopilotService.riskCounter] * cash, 2);
    const minCash = maxCash - minConstant;
    return {
      maxCash,
      minCash
    };
  }

  async createTradingPairs() {
    const cash = await this.getMinMaxCashForOptions();
    await this.optionsOrderBuilderService.createTradingPair(this.autopilotService.currentHoldings, cash.minCash, cash.maxCash);
  }

  async addInverseDispersionTrade() {
    const findPuts = async (symbol: string, prediction: number, backtestData: any, sellMl: number) => {
      if (sellMl > 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
        const cash = await this.getMinMaxCashForOptions(backtestData.impliedMovement + 1);
        await this.optionsOrderBuilderService.balanceTrades(this.autopilotService.currentHoldings,
          ['SPY'], [symbol], cash.minCash, cash.maxCash, 'Inverse dispersion');
      } else if ((prediction > 0.8 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
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
        console.log('Found potential buy', stock);
        await this.autopilotService.addBuy(stock, null, 'inverse dispersion reject');
      }
    };
    await this.autopilotService.getNewTrades(findPuts, null, this.autopilotService.currentHoldings);
  }

  async padOrders() {
    if (!this.autopilotService.hasReachedBuyLimit(this.autopilotService.addedOrdersCount)) {
      this.changeStrategy();
      await this.handleStrategy();
    }
  }

  showStrategies() {
    this.revealPotentialStrategy = false;
    this.tradingPairs = [];

    this.tradingPairs = this.optionsOrderBuilderService.getTradingPairs();
    setTimeout(() => {
      this.revealPotentialStrategy = true;
    }, 500);
    console.log(this.tradingPairs);
  }

  hasTradeCapacity() {
    return this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length < this.autopilotService.maxTradeCount;
  }

  async placeInverseDispersionOrders() {
    await this.addInverseDispersionTrade();
    this.addTradingPairOrders();
  }

  private addTradingPairOrders() {
    this.optionsOrderBuilderService.getTradingPairs().forEach(async (trade) => {
      if (trade.length === 2 && trade[0] && trade[1]) {
        this.optionsOrderBuilderService.addTradingPair(trade, 'Add pair for test');
      }
    });
  }

  handleDaytrade() {
    if (this.tradeObserverSub) {
      this.tradeObserverSub.unsubscribe();
    }
    if (this.daytradeMode) {
      this.tradeObserverSub = this.findDaytradeService.getTradeObserver()
        .pipe(takeUntil(this.destroy$))
        .subscribe((trade: Trade) => {
          this.lastReceivedRecommendation = moment();
          if (this.hasTradeCapacity()) {
            this.addDaytrade(trade.stock);
            this.cartService.removeCompletedOrders();
          }
        });
    }
  }

  triggerDaytradeRefresh() {
    if (this.daytradeMode) {
      this.findDaytradeService.getRefreshObserver().next(true);
    }
  }

  cleanUp() {
    this.resetCart();
    if (this.destroy$) {
      this.destroy$.next();
      this.destroy$.complete();
    }
    if (this.tradeObserverSub) {
      this.tradeObserverSub.unsubscribe();
    }
    if (this.backtestBuffer$) {
      this.backtestBuffer$.unsubscribe();
    }
  }

  async test() {
    this.cartService.removeCompletedOrders();
    this.autopilotService.currentHoldings = await this.cartService.findCurrentPositions();
    await this.modifyCurrentHoldings();
    console.log(this.autopilotService.currentHoldings);
    await this.orderHandlingService.intradayStep('SPY');
  }

  ngOnDestroy() {
    this.cleanUp();
  }
}

