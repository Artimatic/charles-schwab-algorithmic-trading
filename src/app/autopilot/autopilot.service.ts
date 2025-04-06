import { Injectable } from '@angular/core';
import { AuthenticationService, BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService } from '@shared/services';
import { round } from 'lodash-es';
import * as moment from 'moment-timezone';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { PriceTargetService } from './price-target.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';
import { map, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { Balance } from '@shared/services/portfolio.service';

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
  bband = 'bband',
  flagPennant = 'flagPennant'
}

export enum RiskTolerance {
  None = 0.003,
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
  BuyMfiDiv2 = 'Buy by mfi divergence2 buy signal',
  BuyMfi = 'Buy by mfi buy signal',
  BuyMacd = 'Buy by macd buy signal',
  BuyFlag = 'Buy by flag pennant buy signal',
  SellMfi = 'Buy by mfi sell signal',
  BuyBband = 'Buy by bband buy signal',
  SellBband = 'Buy by bband sell signal',
  InverseDispersion = 'Inverse dispersion trade',
  PerfectPair = 'Perfect Pair',
  AnyPair = 'Any Pair',
  BuyDemark = 'Buy demark',
  AddToPositions = 'Add to current positions',
  Hedge = 'Hedge',
  None = 'None'
}

@Injectable({
  providedIn: 'root'
})
export class AutopilotService {
  riskCounter = 0;
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
  maxHoldings = 30;
  lastBuyList = [];
  lastOptionsCheckCheck = null;
  currentHoldings: PortfolioInfoHolding[] = [];
  strategyList = [
    Strategy.Default,
    Strategy.InverseDispersion,
    Strategy.BuyMfiTrade,
    Strategy.BuyMfiDiv,
    Strategy.BuyMfi,
    Strategy.AddToPositions,
    Strategy.PerfectPair,
    Strategy.BuyCalls,
    Strategy.Hedge,
    Strategy.BuyMacd,
    Strategy.BuyBband,
    Strategy.Short,
    Strategy.SellMfi,
    Strategy.BuyFlag,
    Strategy.BuyML,
    Strategy.SellBband,
    Strategy.BuySnP,
    Strategy.MLPairs,
    Strategy.TradingPairs,
    Strategy.BuyDemark,
    Strategy.VolatilityPairs,
    Strategy.BuyWinners,
    Strategy.TrimHoldings
    //Strategy.None
  ];

  strategyCounter = 0;
  callPutBuffer = 0.05;
  intradayProcessCounter = 0;
  intradayStrategyTriggered = false;
  strategies = [];

  private processes = [
    async () => await this.priceTargetService.setTargetDiff(),
    async () => {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      await this.handleBalanceUtilization(this.currentHoldings);
    },
    async () => await this.checkIntradayStrategies(),
    async () => {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
      await this.optionsOrderBuilderService.hedge(this.currentHoldings, balance, 0.2);
    },
    async () => await this.optionsOrderBuilderService.addOptionsStrategiesToCart(),
    async () => {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      await this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
    },
    async () => {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      await this.balanceCallPutRatio(this.currentHoldings);
    }
  ];

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

  setPreferencesFromDB() {
    this.portfolioService.getProfitLoss().pipe(tap(plArray => {
      if (plArray && plArray.length) {
        plArray.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // Sort in descending order (latest first)
        });
        localStorage.setItem('profitLoss', JSON.stringify(plArray[0]));
      }
    }))
      .subscribe(() => {
        const lastStrategy = JSON.parse(localStorage.getItem('profitLoss'));
        if (lastStrategy && lastStrategy.lastStrategy) {
          const lastStrategyCount = this.strategyList.findIndex(strat => strat.toLowerCase() === lastStrategy.lastStrategy.toLowerCase());
          this.strategyCounter = lastStrategyCount >= 0 ? lastStrategyCount : 0;
          this.riskCounter = lastStrategy.lastRiskTolerance || 0;
          console.log('Previous profit loss', lastStrategy);
        } else {
          this.strategyCounter = 0;
        }
        this.portfolioService.getStrategy().subscribe(strategies => this.strategyBuilderService.addAndRemoveOldStrategies(strategies));
      });
  }

  async getMinMaxCashForOptions(modifier = 1) {
    const cash = await this.cartService.getAvailableFunds(false);
    const minConstant = modifier ? (cash * RiskTolerance.Zero * modifier) : 1000;
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
        this.strategyBuilderService.createStrategy(`${reason} Pair trade`, reason, MlBuys[buyKey], MlSells[buyKey], reason);
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
        if (backtestObj.ml > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongbuy') {
          if (MlBuys[key]) {
            MlBuys[key].push(symbol);
          } else {
            MlBuys[key] = [symbol];
          }
        } else if (backtestObj?.sellMl > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongsell') {
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

  async addMLPairs() {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const symbol = backtestObj.stock
        if (backtestObj.ml > 0.5 && backtestObj.sellMl < 0.5 && backtestObj.recommendation.toLowerCase() === 'STRONGBUY') {
          if (MlBuys[backtestObj.ml]) {
            MlBuys[backtestObj.ml].push(symbol);
          } else {
            MlBuys[backtestObj.ml] = [symbol];
          }
        } else if (backtestObj.ml < 0.5 && backtestObj.sellMl > 0.5 && backtestObj.recommendation.toLowerCase() === 'STRONGSELL') {
          if (MlSells[backtestObj.sellMl]) {
            MlSells[backtestObj.sellMl].push(symbol);
          } else {
            MlSells[backtestObj.sellMl] = [symbol];
          }
        }
      }
    }
    await this.addPairsFromHashMap(MlBuys, MlSells, 'ML pairs');
  }

  async buySpyCall() {
    const spy = 'SPY';
    const callOption = await this.strategyBuilderService.getCallStrangleTrade(spy);
    const estimatedPrice = this.strategyBuilderService.findOptionsPrice(callOption.call.bid, callOption.call.ask);
    this.cartService.addSingleLegOptionOrder(spy, [callOption.call],
      estimatedPrice, 1, OrderTypes.call, 'Buy',
      'Buying the dip');
  }
  async checkIntradayStrategies() {
    if (this.intradayStrategyTriggered) {
      return;
    }
    if (this.getLastSpyMl() > 0.5 && moment().isAfter(moment().tz('America/New_York').set({ hour: 10, minute: 35 })) &&
      moment().isBefore(moment().tz('America/New_York').set({ hour: 11, minute: 15 }))) {
      const isDown = await this.priceTargetService.isDownDay();
      if (isDown) {
        const currentDate = moment().format('YYYY-MM-DD');
        const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
        const spyBacktest = await this.backtestService.getBacktestEvaluation('SPY', startDate, currentDate, 'daily-indicators').toPromise();
        const vxxBacktest = await this.backtestService.getBacktestEvaluation('VXX', startDate, currentDate, 'daily-indicators').toPromise();
        const spySignal = spyBacktest.signals[spyBacktest.signals.length - 1];
        const vxxSignal = vxxBacktest.signals[vxxBacktest.signals.length - 1];
        if (spySignal.mfiPrevious < spySignal.mfiLeft &&
          spySignal?.bband80[1][0] < spySignal.close &&
          spySignal?.support[0] < spySignal.close &&
          vxxSignal.mfiPrevious < vxxSignal.mfiLeft &&
          vxxSignal?.bband80[1][0] < vxxSignal.close &&
          vxxSignal?.support[0] < vxxSignal.close) {
          this.intradayStrategyTriggered = true;
          this.reportingService.addAuditLog(null, 'Down day, buy the dip');
          // await this.buySpyCall();
          await this.addToCurrentPositions(this.currentHoldings, RiskTolerance.Zero);
        }
      }
    } else if (moment().isAfter(moment().tz('America/New_York').set({ hour: 3, minute: 20 })) &&
      moment().isBefore(moment().tz('America/New_York').set({ hour: 3, minute: 45 }))) {
      this.intradayStrategyTriggered = false;
    }
  }

  hasReachedBuyLimit() {
    return (this.cartService.buyOrders.length + this.cartService.otherOrders.length) > this.cartService.maxTradeCount;
  }

  hasReachedLimit() {
    return (this.cartService.buyOrders.length + this.cartService.otherOrders.length + this.optionsOrderBuilderService.tradingPairs.length) > this.cartService.maxTradeCount;
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
    if ((this.cartService.getBuyOrders().length + this.cartService.getOtherOrders().length) < this.cartService.getMaxTradeCount()) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');

      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicator = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicator.low, indicator.high);
        await this.cartService.portfolioBuy(holding,
          allocation || (this.riskToleranceList[this.riskCounter]),
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

  async findStock() {
    if (this.strategyBuilderService.bullishStocks.length) {
      await this.addBuy(this.createHoldingObj(this.strategyBuilderService.bullishStocks.pop()), null, 'Buy bullish stock');
    }
  }

  addPair(buys: string[], sells: string[], reason) {
    let counter = 0;
    while (counter < buys.length && counter < sells.length) {
      this.strategyBuilderService.createStrategy(`${buys[counter]} ${reason}`, buys[counter], [buys[counter]], [sells[counter]], reason);
      counter++;
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
    const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
    const isOverBalance = Boolean(Number(balance.cashBalance) < 0);
    if (isOverBalance) {
      this.reportingService.addAuditLog(null, 'Over balance');
      this.sellLoser(currentHoldings, 'Over balance');
    } else {
      let targetUtilization = 1.618034 - this.getVolatilityMl() - (1 - this.getLastSpyMl());
      targetUtilization = targetUtilization > 1 ? 1 : targetUtilization;
      const actualUtilization = (1 - (balance.cashBalance / balance.liquidationValue));
      if (actualUtilization < targetUtilization) {
        this.reportingService.addAuditLog(null, `Underutilized, Target: ${targetUtilization}, Actual: ${actualUtilization}`);

        await this.addToCurrentPositions(currentHoldings, RiskTolerance.Zero);
      }
    }
    return isOverBalance;
  }

  async buyRightAway(buySymbol, alloc: number) {
    const price = await this.portfolioService.getPrice(buySymbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const allocation = alloc > 0 && alloc <= 1 ? alloc : 0.01;
    const cash = (balance.cashBalance < balance.availableFunds * 0.05) ?
      balance.cashBalance :
      (balance.cashBalance * allocation);
    const quantity = this.strategyBuilderService.getQuantity(price, 1, cash);
    const order = this.cartService.buildOrderWithAllocation(buySymbol, quantity, price, 'Buy',
      1, -0.005, 0.01,
      -0.003, 1, false, 'Buy right away');
    this.reportingService.addAuditLog(buySymbol, `Buying ${quantity} right away`);

    this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
  }

  async sellRightAway(symbol, quantity) {
    this.reportingService.addAuditLog(symbol, `Selling ${quantity} right away`);

    const price = await this.portfolioService.getPrice(symbol).toPromise();
    const order = this.cartService.buildOrderWithAllocation(symbol, quantity, price, 'Sell',
      1, -0.005, 0.01,
      -0.003, 1, false, 'Sell right away');

    this.daytradeService.sendSell(order, 'market', () => { }, () => { }, () => { });
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
    this.volatility = round(val, 2);
  }

  getVolatilityMl() {
    return this.volatility;
  }

  isVolatilityHigh() {
    return (this.volatility - 0.1618034) > this.priceTargetService.getPortfolioVolatility();
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
        await this.cartService.portfolioSell(holdingInfo, reason, false, false);
      } else if (holdingInfo.primaryLegs) {
        await this.sellOptionsHolding(holdingInfo, 'Selling loser');
      }
    });
  }

  sellCallLoser(currentHoldings: PortfolioInfoHolding[]) {
    currentHoldings
      .sort((a, b) => a.pl - b.pl)
      .filter(holding => {
        if (!holding.primaryLegs) {
          return false;
        }
        return holding.primaryLegs[0].putCallInd.toLowerCase() === 'c';
      });
    const toBeSold = currentHoldings.slice(0, 1);
    toBeSold.forEach(async (holdingInfo) => {
      if (holdingInfo.primaryLegs) {
        await this.sellOptionsHolding(holdingInfo, 'Selling call');
      }
    });
  }

  sellPutLoser(currentHoldings: PortfolioInfoHolding[]) {
    currentHoldings
      .sort((a, b) => a.pl - b.pl)
      .filter(holding => {
        if (!holding.primaryLegs) {
          return false;
        }
        return holding.primaryLegs[0].putCallInd.toLowerCase() === 'p';
      });

    const toBeSold = currentHoldings.slice(0, 1);
    toBeSold.forEach(async (holdingInfo) => {
      if (holdingInfo.primaryLegs) {
        await this.sellOptionsHolding(holdingInfo, 'Selling put');
      }
    });
  }

  async addShort() {
    const sells = this.getSellList()
    if (sells.length) {
      this.optionsOrderBuilderService.addPutToCurrentTrades(sells.pop());
    }
  }

  async balanceCallPutRatio(holdings: PortfolioInfoHolding[]) {
    const results = this.priceTargetService.getCallPutBalance(holdings);
    const threshold = await this.priceTargetService.getCallPutRatio(this.volatility);
    const putPct = results.put / (results.call + results.put);
    this.reportingService.addAuditLog(null, `Call put ratio: ${results.call / results.put}`);

    //if (results.put + (results.put * this.getLastSpyMl() * (this.riskToleranceList[this.riskCounter] * 3) * (1 - this.volatility)) > results.call) {
    if (putPct > threshold + this.callPutBuffer) {
      const sqqqHolding = holdings.find(h => h.name.toUpperCase() === 'SQQQ');
      if (sqqqHolding) {
        await this.sellRightAway(sqqqHolding.name, sqqqHolding.shares);
      }
      await this.buyRightAway('TQQQ', RiskTolerance.None);
      //this.optionsOrderBuilderService.addOptionByBalance('SPY', threshold, 'Balance call put ratio', true);

      // this.currentHoldings = await this.cartService.findCurrentPositions();
      //await this.sellLoser(this.currentHoldings);
      //const currentHoldings = await this.cartService.findCurrentPositions();
      // await this.sellPutLoser(currentHoldings);
      //} else if (results.call / results.put > (1 + this.getLastSpyMl() + this.riskToleranceList[this.riskCounter])) {
    } else if (putPct < threshold - this.callPutBuffer) {
      const tqqqHolding = holdings.find(h => h.name.toUpperCase() === 'TQQQ');
      const uproHolding = holdings.find(h => h.name.toUpperCase() === 'UPRO');
      if (tqqqHolding) {
        await this.sellRightAway(tqqqHolding.name, tqqqHolding.shares);
      }
      if (uproHolding) {
        await this.sellRightAway(uproHolding.name, uproHolding.shares);
      }
      await this.buyRightAway('SQQQ', RiskTolerance.None);
      // this.currentHoldings = await this.cartService.findCurrentPositions();
      // await this.sellLoser(this.currentHoldings);
      // await this.sellCallLoser(currentHoldings);

    }
  }

  private marketHourCheck(marketHour: any) {
    return marketHour && marketHour.equity && marketHour.equity.EQ && Boolean(marketHour.equity.EQ.isOpen);
  }

  checkCredentials() {
    const accountId = sessionStorage.getItem('accountId');
    this.authenticationService.checkCredentials(accountId).subscribe();
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
          await this.cartService.portfolioSell(holding, `Price target met ${pnl}`, false, false);
        }
      } else if (pnl > 0) {
        if (!isOptionOnly) {
          await this.addBuy(holding, RiskTolerance.Zero, 'Adding to position');
        }
      }
    }
  }

  async addToCurrentPositions(currentHoldings = null, allocation = null) {
    currentHoldings.forEach(async (holding) => {
      if (holding.pnlPercentage > -0.01) {
        if (!holding.primaryLegs && holding.shares) {
          await this.addBuy(holding, allocation || this.riskToleranceList[this.riskCounter], 'Adding to winners');
        }
      }
    });
  }

  async executeOrderList() {
    const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
    const orders = buyAndSellList.concat(this.cartService.otherOrders);
    for (let i = 0; i < orders.length; i++) {
      const symbol = orders[i].holding.symbol;
      if (!this.daytradeStrategiesService.shouldSkip(symbol)) {
        await this.orderHandlingService.intradayStep(orders[i]);
      }
    }
  }

  private async runIntradayProcess() {
    if (this.intradayProcessCounter >= this.processes.length) {
      this.intradayProcessCounter = 0;
    }

    await this.processes[this.intradayProcessCounter]();
    this.intradayProcessCounter++;
  }


  handleIntraday() {
    if (moment().isAfter(moment(this.sessionStart).add(23, 'minutes')) &&
      moment().isBefore(moment(this.sessionEnd).subtract(10, 'minutes'))) {
      this.isMarketOpened().subscribe(async (isOpen) => {
        if (isOpen) {
          if (!this.lastOptionsCheckCheck || Math.abs(moment().diff(this.lastOptionsCheckCheck, 'minutes')) > 9) {
            this.lastOptionsCheckCheck = moment();
            await this.runIntradayProcess();
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


  async addInverseDispersionTrade() {
    const findPuts = async (symbol: string, prediction: number, backtestData: any, sellMl: number) => {
      if (sellMl > 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
        const cash = await this.getMinMaxCashForOptions(backtestData.impliedMovement + 1);
        await this.optionsOrderBuilderService.balanceTrades(['SPY'], [symbol], cash.minCash, cash.maxCash, 'Inverse dispersion');
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
        await this.addBuy(stock, null, 'inverse dispersion reject');
      }
    };
    await this.getNewTrades(findPuts, null, this.currentHoldings);
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
        await this.addBuy(stock, null, 'Buy winners');
      }
    };
    await this.getNewTrades(buyWinner, null, this.currentHoldings);
  }

  async createTradingPairs() {
    const cash = await this.getMinMaxCashForOptions();
    await this.optionsOrderBuilderService.createTradingPair(cash.minCash, cash.maxCash);
  }

  async handleStrategy() {
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    if (balance.liquidationValue < 26000) {
      await this.findTopBuy();
      return;
    }

    this.strategyBuilderService.findTrades();
    this.strategies = this.strategyBuilderService.getTradingStrategies();

    switch (this.strategyList[this.strategyCounter]) {
      case Strategy.MLPairs:
        await this.addMLPairs();
        break;
      case Strategy.TrimHoldings:
        await this.sellLoser(this.currentHoldings);
        break;
      case Strategy.Short:
        await this.addShort();
        break;
      case Strategy.BuyCalls:
        this.optionsOrderBuilderService.addAnyPair();
        break;
      case Strategy.InverseDispersion:
        await this.addInverseDispersionTrade();
        break;
      case Strategy.BuyWinners:
        await this.buyWinners();
        break;
      case Strategy.AddToPositions:
        this.currentHoldings = await this.cartService.findCurrentPositions();
        await this.addToCurrentPositions(this.currentHoldings);
        break;
      case Strategy.PerfectPair:
        await this.addPerfectPair();
        break;
      case Strategy.VolatilityPairs:
        await this.addVolatilityPairs();
        break;
      case Strategy.SellMfiTrade:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiTrade, 'sell');
        }
        break;
      case Strategy.SellMfiDiv:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        }
        break;
      case Strategy.BuyMfiTrade:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiTrade, 'buy');
        }
        break;
      case Strategy.BuyMfiDiv2:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
        }
        break;
      case Strategy.BuyMfiDiv:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
        }
        break;
      case Strategy.BuyFlag:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.flagPennant, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.flagPennant, 'buy');
        }
        break;
      case Strategy.BuyDemark:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.demark9, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.demark9, 'buy');
        }
        break;
      case Strategy.SellMfi:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfi, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfi, 'sell');
        }
        break;
      case Strategy.SellBband:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.bband, 'sell');
        }
        break;
      case Strategy.BuyMfi:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfi, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfi, 'buy');
        }
        break;
      case Strategy.BuyBband:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.bband, 'buy');
        }
        break;
      case Strategy.BuyMacd:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.macd, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.macd, 'buy');
        }
        break;
      case Strategy.Hedge:
        this.currentHoldings = await this.cartService.findCurrentPositions();
        const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
        await this.optionsOrderBuilderService.hedge(this.currentHoldings, balance);
        break;
      default: {
        await this.sellLoser(this.currentHoldings);
        break;
      }
    }

    await this.createTradingPairs();
    await this.findStock();
    await this.findTopBuy();
  }
}
