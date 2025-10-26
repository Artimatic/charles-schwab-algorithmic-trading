import { Injectable } from '@angular/core';
import { AuthenticationService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService } from '@shared/services';
import { round } from 'lodash-es';
import * as moment from 'moment-timezone';
import { BacktestData } from './interfaces/backtest-data.interface';
import { MarketHours } from './interfaces/market-hours.interface';
import { TradingStrategy } from './interfaces/trading-strategy.interface';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { PriceTargetService } from './price-target.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderTypes } from '@shared/models/smart-order';
import { map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { Balance } from '@shared/services/portfolio.service';
import { IntradayStrategyService } from '../strategies/intraday-strategy.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { RiskTolerance } from './risk-tolerance.enum';
import { Strategy } from './strategy.enum';
import { DelayedBuySellStrategyService } from '../delayed-buy-sell-strategy.service';
import { IntradayStrategyScannerService } from '../strategies/intraday-strategy-scanner.service';

export interface ProfitLossRecord {
  date: string;
  profit: number;
  lastStrategy: string;
  profitRecord: ScoringIndex<number>;
  lastRiskTolerance: number;
}

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
  bbandBreakout = 'bbandBreakout',
  flagPennant = 'flagPennant',
  breakSupport = 'breakSupport',
  breakResistance = 'breakResistance'
}

@Injectable({
  providedIn: 'root'
})
export class AutopilotService {
  private lastBalanceUtilizationCheck: moment.Moment | null = null;
  private _riskCounter = 0;
  private _lastSpyMl = 0;
  private _lastGldMl = 0;
  private _lastBtcMl = 0;

  get riskCounter(): number {
    return this._riskCounter;
  }

  set riskCounter(value: number) {
    this._riskCounter = value;
  }

  get lastSpyMl(): number {
    return this._lastSpyMl;
  }

  set lastSpyMl(value: number) {
    this._lastSpyMl = value;
  }

  get lastGldMl(): number {
    return this._lastGldMl;
  }

  set lastGldMl(value: number) {
    this._lastGldMl = value;
  }

  get lastBtcMl(): number {
    return this._lastBtcMl;
  }

  set lastBtcMl(value: number) {
    this._lastBtcMl = value;
  }
  private _volatility = 0;
  private lastMarketHourCheck: moment.Moment | null = null;
  private _sessionStart: Date | null = null;
  private _sessionEnd: Date | null = null;

  get volatility(): number {
    return this._volatility;
  }

  set volatility(value: number) {
    this._volatility = value;
  }

  get sessionStart(): Date | null {
    return this._sessionStart;
  }

  set sessionStart(value: Date | null) {
    this._sessionStart = value;
  }

  get sessionEnd(): Date | null {
    return this._sessionEnd;
  }

  set sessionEnd(value: Date | null) {
    this._sessionEnd = value;
  }

  riskToleranceList = [
    RiskTolerance.Two,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral,
    RiskTolerance.Greed,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.Neutral,
    RiskTolerance.Lower,
    RiskTolerance.Greed,
    RiskTolerance.Low,
    RiskTolerance.Neutral,
    RiskTolerance.XXXXLGreed
  ];
  private isOpened = false;
  private maxHoldings = 15;
  private lastBuyList: string[] = [];
  private lastOptionsCheckCheck: moment.Moment | null = null;
  private _currentHoldings: PortfolioInfoHolding[] = [];

  get currentHoldings(): PortfolioInfoHolding[] {
    return this._currentHoldings;
  }

  set currentHoldings(value: PortfolioInfoHolding[]) {
    this._currentHoldings = value;
  }

  private readonly defaultList: Strategy[] = [
    Strategy.Default,
    Strategy.BuySnP,
    Strategy.StopLoss,
    Strategy.IwmInverseDispersion,
    Strategy.TrimHoldings,
    Strategy.PerfectPair,
    Strategy.Swingtrade
  ];

  private readonly bearishList: Strategy[] = [
    Strategy.Hedge,
    Strategy.InverseDispersion,
    Strategy.VolatilityPairs,
    Strategy.StopLoss,
    Strategy.MLPairs,
    Strategy.TrimHoldings,
    Strategy.BuyMfiTrade,
    Strategy.Gold,
    Strategy.BuyMfiDiv,
    Strategy.BuyMfi,
    Strategy.BuyBband,
    Strategy.BuyMfiDiv2,
    Strategy.Short
  ];

  private readonly bullishList: Strategy[] = [
    Strategy.AddToPositions,
    Strategy.BuyCalls,
    Strategy.BuyBbandBreakout,
    Strategy.BuyWinners,
    Strategy.BuyFlag,
    Strategy.BuyWinnersSellLosers,
    Strategy.BTC,
    Strategy.StopLoss
  ];

  private _strategyList: Strategy[] = this.defaultList;

  get strategyList(): Strategy[] {
    return this._strategyList;
  }

  set strategyList(value: Strategy[]) {
    this._strategyList = value;
    // Reset counter if it's out of bounds with new list
    this.strategyCounter = this.strategyCounter >= value.length ? 0 : this.strategyCounter;
  }

  private readonly callPutBuffer = 0.05;
  private intradayProcessCounter = 0;
  private _strategies: TradingStrategy[] = [];
  private _strategyCounter = 0;

  get strategyCounter(): number {
    return this._strategyCounter;
  }

  set strategyCounter(value: number) {
    this._strategyCounter = value;
  }
  private _riskLevel: RiskTolerance = RiskTolerance.One;
  private readonly processes: Array<() => Promise<void>> = [
    async () => await this.priceTargetService.setTargetDiff(),
    async () => {
      await this.setCurrentHoldings();
      // Prevent handleBalanceUtilization if last call was within 45 minutes
      if (!this.lastBalanceUtilizationCheck || Math.abs(moment().diff(this.lastBalanceUtilizationCheck, 'minutes')) > 45) {
        this.lastBalanceUtilizationCheck = moment();
        await this.handleBalanceUtilization(this.currentHoldings);
      } else {
        this.reportingService.addAuditLog(null, 'Skipped handleBalanceUtilization: last call within 45 minutes');
      }
    },
    async () => await this.checkIntradayStrategies(),
    async () => await this.findAnyPair(),
    async () => {
      await this.setCurrentHoldings();
      const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
      await this.optionsOrderBuilderService.hedge(this.currentHoldings, balance, 0.2);
    },
    async () => {
      await this.optionsOrderBuilderService.addOptionsStrategiesToCart();
    },
    async () => {
      await this.setCurrentHoldings();
      await this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
    },
    async () => {
      await this.setCurrentHoldings();
      // await this.balanceCallPutRatio(this.currentHoldings);
    },
    async () => await this.findStockBuys()
  ];

  constructor(private cartService: CartService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private priceTargetService: PriceTargetService,
    private machineDaytradingService: MachineDaytradingService,
    private strategyBuilderService: StrategyBuilderService,
    private orderHandlingService: OrderHandlingService,
    private reportingService: ReportingService,
    private portfolioService: PortfolioService,
    private globalSettingsService: GlobalSettingsService,
    private authenticationService: AuthenticationService,
    private daytradeService: DaytradeService,
    private daytradeStrategiesService: DaytradeStrategiesService,
    private machineLearningService: MachineLearningService,
    private intradayStrategyService: IntradayStrategyService,
    private delayedBuySellStrategyService: DelayedBuySellStrategyService,
    private intradayStrategyScannerService: IntradayStrategyScannerService
  ) {
    const globalStartStop = this.globalSettingsService.getStartStopTime();
    this.sessionStart = globalStartStop.startDateTime;
    this.sessionEnd = globalStartStop.endDateTime;
    this.strategyList = this.defaultList;
  }

  setPreferencesFromDB() {
    this.portfolioService.getProfitLoss().pipe(tap(plArray => {
      const currentPl = JSON.parse(localStorage.getItem('profitLoss'));
      if (plArray && plArray.length) {
        plArray.sort((a, b) => {
          if (!a || !b || !a.date || !b.date) {
            return 0;
          };
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // Sort in descending order (latest first)
        });
        const dbPl = plArray[0];
        if (!currentPl || (dbPl && dbPl.date && moment(dbPl.date).isAfter(moment(currentPl.date)))) {
          localStorage.setItem('profitLoss', JSON.stringify(dbPl));
        }
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
        this.setRiskLevel();
        this.portfolioService.getStrategy().subscribe(strategies => this.strategyBuilderService.addAndRemoveOldStrategies(strategies));
      });
  }

  async setCurrentHoldings() {
    this.currentHoldings = await this.cartService.findCurrentPositions();
  }

  getCurrentHoldings() {
    return this.currentHoldings;
  }

  async checkIntradayStrategies() {
    await this.intradayStrategyService.checkIntradayStrategies(this.riskLevel);
  }

  async getMinMaxCashForOptions(modifier = 1) {
    const cash = await this.cartService.getAvailableFunds(false);
    const minConstant = modifier ? (cash * RiskTolerance.Zero * modifier) : 1000;
    const maxCash = round(this.riskLevel * cash, 2);
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
        if (backtestObj.ml > 0.5 &&
          backtestObj.recommendation.toLowerCase() === 'strongbuy') {
          if (MlBuys[key]) {
            MlBuys[key].push(symbol);
          } else {
            MlBuys[key] = [symbol];
          }
        } else if (backtestObj?.sellMl > 0.5 &&
          backtestObj.recommendation.toLowerCase() === 'strongsell') {
          if (MlSells[key]) {
            MlSells[key].push(symbol);
          } else {
            MlSells[key] = [symbol];
          }
        }
      }
    }
    console.log('Perfect pairs', MlBuys, MlSells);
    this.addPairsFromHashMap(MlBuys, MlSells, 'Perfect pair');
  }

  async addMLPairs() {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    const MlBuys = {};
    const MlSells = {};
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        const symbol = backtestObj.stock
        if (backtestObj.ml > 0.5 && backtestObj.sellMl < 0.5 && backtestObj.recommendation.toLowerCase() === 'strongbuy') {
          if (MlBuys[backtestObj.ml]) {
            MlBuys[backtestObj.ml].push(symbol);
          } else {
            MlBuys[backtestObj.ml] = [symbol];
          }
        } else if (backtestObj.ml < 0.5 && backtestObj.sellMl > 0.5 && backtestObj.recommendation.toLowerCase() === 'strongsell') {
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

  hasReachedBuyLimit() {
    return (this.cartService.buyOrders.length + this.cartService.otherOrders.length) > this.cartService.maxTradeCount;
  }

  hasReachedLimit() {
    return (this.cartService.buyOrders.length + this.cartService.otherOrders.length + this.optionsOrderBuilderService.tradingPairs.length) > this.cartService.maxTradeCount;
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

  async findSwingStockCallback(symbol: string, prediction: number | null, backtestData: BacktestData): Promise<void> {
    if ((prediction > 0.65 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY') && this.priceTargetService.isProfitable(backtestData.invested, backtestData.net)) {
      this.strategyBuilderService.addBullishStock(symbol);
    }
  }

  getBuyList(filter: (data: BacktestData) => boolean = (data: BacktestData) => data.recommendation === 'STRONGBUY'): string[] {
    const savedBacktest = JSON.parse(localStorage.getItem('backtest') || '{}');
    let backtestResults: BacktestData[] = [];
    let newList: BacktestData[] = [];

    if (savedBacktest) {
      for (const saved in savedBacktest) {
        const backtestObj = savedBacktest[saved];
        backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
        backtestResults.push(backtestObj);
      }
      let minMl = 1;
      while (minMl > 0.4 && !newList.length) {
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
      while (minMl > 0.4 && !newList.length) {
        newList = backtestResults?.filter(backtestData => filter(backtestData) && backtestData?.sellMl && backtestData.sellMl > minMl);
        minMl -= 0.1;
      }
    }
    newList?.sort((a, b) => b?.sellMl - a?.sellMl);

    return newList.map(s => s.stock);
  }

  async findAnyPair() {
    const buySellList = await this.intradayStrategyScannerService.scanStocksForIntradayStrategies()
    this.addPair(buySellList.buys, buySellList.sells, 'Intraday pair');
  }

  async findStockBuys() {
    const buyList = await this.intradayStrategyScannerService.scanStocksForIntradayBuys()
      
    buyList.forEach(async (buy) => await this.orderHandlingService.addBuy(this.createHoldingObj(buy),
        this.riskLevel * 2, 'Buy bullish stock'), true);
  }

  async findMlOnlyPair() {
    const buys = this.getBuyList(() => true)
    const sells = this.getSellList(() => true);
    this.addPair(buys, sells, 'ML pair');
  }

  async buyWinnersSellLosers() {
    const buys = this.getBuyList((backtestData) => backtestData.net / backtestData.total > 0.04 && backtestData.ml > 0.6)
    const sells = this.getSellList((backtestData) => backtestData.net / backtestData.total < -0.04 && backtestData.sellMl > 0.6);
    console.log('buyWinnersSellLosers', buys, sells);
    this.addPair(buys, sells, 'Winner Loser pair');
  }

  addPair(buys: string[], sells: string[], reason) {
    if (!sells.length) {
      buys.forEach(buy => {
        this.strategyBuilderService.addBullishStock(buy);
      });
      return;
    } else if (!buys.length) {
      buys = ['IWM', 'QQQ', 'SPY'];
    }

    buys.forEach(buy => {
      sells.forEach(sell => {
        this.strategyBuilderService.createStrategy(`${buy} ${reason}`, buy, [buy], [sell], reason);
      });
    });
  }

  addPairOnSignal(indicator: SwingtradeAlgorithms, direction: 'buy' | 'sell', addPair = true) {
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
    if (addPair) {
      this.addPair(buys, sells, `${direction} ${indicator}`);
    }
  }

  findIwmTrade() {
    const buys = ['IWM'];
    const sells = this.getSellList((backtestData) => backtestData.recommendation.toLowerCase() === 'strongsell' && backtestData.sellMl > 0.63);
    console.log('IWM trade', buys, sells);
    this.addPair(buys, sells, 'IWM pair');
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
      await this.orderHandlingService.addBuy(this.createHoldingObj(candidate), this.riskLevel * 2, `${direction} ${indicator}`);
    }
    return buys;
  }

  async handleBalanceUtilization(currentHoldings, canSell = false) {
    const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
    this.priceTargetService.setLiquidationValue(balance.liquidationValue);
    const isOverBalance = Boolean(Number(balance.cashBalance) < 0);
    if (isOverBalance) {
      this.reportingService.addAuditLog(null, 'Over balance');
      this.currentHoldings.forEach(async (holding) => {
        await this.checkStopLoss(holding);
      });
      this.sellLoser(currentHoldings, 'Over balance');
    } else {
      const actualUtilization = (1 - (balance.cashBalance / balance.liquidationValue));

      if (actualUtilization > 0.95) {
        await this.orderHandlingService.addBuy(this.createHoldingObj('SPY'), 1, 'Near 100 percent utilization');
      } else {
        let targetUtilization = this.getLastSpyMl();
        targetUtilization = targetUtilization > 1 ? 1 : targetUtilization;
        if (actualUtilization < targetUtilization) {
          this.reportingService.addAuditLog(null, `Underutilized, Target: ${targetUtilization}, Actual: ${actualUtilization}`);

          // Get the best symbol based on ML scores
          // const symbols = ['GLD', 'SH', 'SPY', 'TLT'];
          // const bestSymbolResult = await this.selectBestSymbolByMl(symbols);

          // await this.orderHandlingService.addBuy(this.createHoldingObj(bestSymbolResult.symbol), this.riskToleranceList[0], `Underutilized. Buy ${bestSymbolResult.symbol} (ml: ${bestSymbolResult.ml})`);
          this.findIwmTrade();
        } else if (canSell && actualUtilization > targetUtilization + 0.03) {
          this.reportingService.addAuditLog(null, `Overutilized, Target: ${targetUtilization}, Actual: ${actualUtilization}`);
          this.currentHoldings.forEach(async (holding) => {
            await this.checkStopLoss(holding);
          });
        }
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
    this.lastSpyMl = round(val, 2);
    let newList;
    if (this.lastSpyMl > 0.7) {
      newList = this.bullishList;
    } else if (this.lastSpyMl < 0.33) {
      newList = this.bearishList;
    } else {
      newList = this.defaultList;
    }
    if (this.strategyList !== newList) {
      this.reportingService.addAuditLog(null, `Strategy list changed: ${newList.map(s => s).join(', ')}. Last SPY prediction: ${this.lastSpyMl}`);
    }
    this.strategyList = newList;
    this.strategyCounter = this.strategyCounter >= this.strategyList.length ? 0 : this.strategyCounter;
  }

  getLastSpyMl() {
    return round(this.lastSpyMl, 2);
  }

  setVolatilityMl(val: number) {
    this.volatility = round(val, 2);
  }

  getVolatilityMl() {
    return this.volatility;
  }

  isVolatilityHigh() {
    return this.volatility > this.priceTargetService.getPortfolioVolatility();
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
    await this.orderHandlingService.addBuy(this.createHoldingObj('SH'),
      this.riskLevel, 'Short');
  }

  async balanceCallPutRatio(holdings: PortfolioInfoHolding[]) {
    const results = this.priceTargetService.getCallPutBalance(holdings);
    const threshold = await this.priceTargetService.getCallPutRatio(this.volatility);
    const putPct = results.put / (results.call + results.put);
    this.reportingService.addAuditLog(null, `Call/put ratio: ${results.call / results.put} Target: ~${threshold}`);

    //if (results.put + (results.put * this.getLastSpyMl() * (this.riskLevel * 3) * (1 - this.volatility)) > results.call) {
    if (putPct > threshold + this.callPutBuffer) {
      const sqqqHolding = holdings.find(h => h.name.toUpperCase() === 'SQQQ');
      if (sqqqHolding) {
        await this.sellRightAway(sqqqHolding.name, sqqqHolding.shares);
      }
      await this.buyRightAway('TQQQ', RiskTolerance.None);
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
    }
  }

  private marketHourCheck(marketHour: any) {
    return marketHour && marketHour.equity && marketHour.equity.EQ && Boolean(marketHour.equity.EQ.isOpen);
  }

  checkCredentials() {
    const accountId = sessionStorage.getItem('accountId');
    this.authenticationService.checkCredentials(accountId).subscribe();
  }

  isMarketOpened(): Observable<boolean> {
    if (this.lastMarketHourCheck && Math.abs(this.lastMarketHourCheck.diff(moment(), 'minutes')) < 20) {
      return of(this.isOpened);
    }
    return this.portfolioService.getEquityMarketHours(moment().format('YYYY-MM-DD')).pipe(
      map((marketHour: MarketHours) => {
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

  async updateBtcPrediction() {
    const backtestData = await this.strategyBuilderService.getBacktestData('BTC');
    this.lastBtcMl = round(backtestData.ml, 2);
  }

  async updateGldPrediction() {
    const backtestData = await this.strategyBuilderService.getBacktestData('GLD');
    this.lastGldMl = round(backtestData.ml, 2);
  }

  /**
   * Selects the best symbol from a list of symbols based on their machine learning scores
   * @param symbols Array of symbols to evaluate
   * @returns Object containing the best symbol and its ml score
   */
  async selectBestSymbolByMl(symbols: string[]): Promise<{ symbol: string; ml: number }> {
    const backtestResults: Array<BacktestData | null> = await Promise.all(
      symbols.map(symbol => this.strategyBuilderService.getBacktestData(symbol))
    );

    let bestSymbol = symbols[0]; // Default to first symbol
    let highestMl = -1;

    for (let i = 0; i < symbols.length; i++) {
      if (backtestResults[i] && backtestResults[i].ml > highestMl) {
        highestMl = backtestResults[i].ml;
        bestSymbol = symbols[i];
      }
    }

    return { symbol: bestSymbol, ml: highestMl };
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
        stopLoss = impliedMove * -6;
        this.reportingService.addAuditLog(holding.name, `Setting options stop loss to ${stopLoss}`);
        profitTarget = impliedMove * 10;
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
          await this.orderHandlingService.addBuy(holding, RiskTolerance.One, 'Adding to position');
        }
      }
    }
  }

  async addToCurrentPositions(currentHoldings = null, allocation = null) {
    currentHoldings.forEach(async (holding) => {
      if (holding.pnlPercentage > -0.01) {
        if (!holding.primaryLegs && holding.shares) {
          await this.orderHandlingService.addBuy(holding, allocation || this.riskLevel, 'Adding to winners');
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
        await this.orderHandlingService.addBuy(stock, this.riskLevel, 'inverse dispersion reject');
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
        await this.orderHandlingService.addBuy(stock, this.riskLevel, 'Buy winners');
      }
    };
    await this.getNewTrades(buyWinner, null, this.currentHoldings);
  }

  async createTradingPairs() {
    const cash = await this.getMinMaxCashForOptions();
    await this.optionsOrderBuilderService.createTradingPair(cash.minCash, cash.maxCash);
  }

  async handleStrategy(useDefault = false) {
    this.strategyBuilderService.findTrades();
    this._strategies = this.strategyBuilderService.getTradingStrategies();
    const strategy = useDefault ? Strategy.Default : this.strategyList[this.strategyCounter];

    // Get the list of stocks to sell today from delayed sells
    const delayedSells = this.delayedBuySellStrategyService.getTodaysDelayedSells();
    console.log('Delayed sells for today', delayedSells);

    // Add sell orders for any current positions that match the delayed sells
    for (const stock of delayedSells) {
      const holding = this.currentHoldings.find(h => h.name === stock);
      if (holding) {
        this.reportingService.addAuditLog(stock, `Selling due to delayed sell signal`);
        await this.cartService.portfolioSell(holding, 'Delayed sell signal', false, false);
      }
    }

    switch (strategy) {
      case Strategy.MLPairs:
        await this.addMLPairs();
        break;
      case Strategy.TrimHoldings:
        this.handleBalanceUtilization(this.currentHoldings, true);
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
      case Strategy.BuyWinnersSellLosers:
        await this.buyWinnersSellLosers();
        break;
      case Strategy.AddToPositions:
        await this.setCurrentHoldings();
        await this.addToCurrentPositions(this.currentHoldings);
        break;
      case Strategy.PerfectPair:
        await this.addPerfectPair();
        break;
      case Strategy.VolatilityPairs:
        await this.addVolatilityPairs();
        break;
      case Strategy.BuyMfiTrade:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'buy');
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.bband, 'buy');
        }
        break;
      case Strategy.BuyMfiDiv2:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
        }
        break;
      case Strategy.BuyMfiDiv:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
          await this.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
          await this.buyOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
        }
        break;
      case Strategy.BuyFlag:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.flagPennant, 'buy');
          await this.addPairOnSignal(SwingtradeAlgorithms.flagPennant, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.flagPennant, 'buy');
        }
        break;
      case Strategy.BuyMfi:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.mfi, 'sell');
          await this.addPairOnSignal(SwingtradeAlgorithms.mfi, 'buy');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.mfi, 'buy');
          await this.buyOnSignal(SwingtradeAlgorithms.mfi, 'sell');
        }
        break;
      case Strategy.BuyBband:
        if (this.isVolatilityHigh()) {
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'buy');
          await this.addPairOnSignal(SwingtradeAlgorithms.bband, 'sell');
        } else {
          await this.buyOnSignal(SwingtradeAlgorithms.bband, 'buy');
          await this.buyOnSignal(SwingtradeAlgorithms.bband, 'sell');
        }
        break;
      case Strategy.BuyBbandBreakout:
        const buys = await this.buyOnSignal(SwingtradeAlgorithms.bbandBreakout, 'buy');
        if (buys.length) {
          this.reportingService.addAuditLog(null, `Adding delayed sell for ${buys.join(', ')}`);
          this.delayedBuySellStrategyService.addDelayedSell(buys);
        }
        break;
      case Strategy.Hedge:
        this.currentHoldings = await this.cartService.findCurrentPositions();
        const balance: Balance = await this.portfolioService.getTdBalance().toPromise();
        await this.optionsOrderBuilderService.hedge(this.currentHoldings, balance);
        break;
      case Strategy.Gold:
        await this.orderHandlingService.addBuy(this.createHoldingObj('GLD'),
          this.riskLevel, 'Buy gold');
        break;
      case Strategy.BuySnP:
        await this.orderHandlingService.addBuy(this.createHoldingObj('UPRO'),
          this.riskLevel, 'Buy snp');
        break;
      case Strategy.BTC:
        await this.orderHandlingService.addBuy(this.createHoldingObj('UPRO'),
          this.riskLevel, 'Buy BTC');
        break;
      case Strategy.StopLoss:
        this.currentHoldings.forEach(async (holding) => {
          await this.checkStopLoss(holding);
        });
      case Strategy.IwmInverseDispersion:
        this.findIwmTrade();
        break;
      case Strategy.Swingtrade:
        await this.getNewTrades(null, null, this.currentHoldings);
        break;
      default: {
        this.findIwmTrade();
        break;
      }
    }

    await this.createTradingPairs();
  }

  saveRisk() {
    const profitObj: ProfitLossRecord = {
      'date': moment().format(),
      profit: 0,
      lastStrategy: this.strategyList[this.strategyCounter],
      lastRiskTolerance: this.riskCounter,
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
    if (this.strategyCounter < this.strategyList.length - 1) {
      this.strategyCounter++;
    } else {
      this.strategyCounter = 0;
    }
    const strat = this.strategyList[this.strategyCounter];
    const msg = `Strategy changed to ${strat}. Risk tolerance ${this.riskCounter}`;
    this.reportingService.addAuditLog(null, msg);

    if (saveOption) {
      this.saveRisk();
    }
  }

  resetRiskLevel() {
    this.riskCounter = 0;
    this.setRiskLevel();
  }
  setRiskLevel() {
    if (this.riskCounter < this.riskToleranceList.length) {
      this._riskLevel = this.riskToleranceList[this.riskCounter];
    } else {
      this._riskLevel = this.riskToleranceList[this.riskToleranceList.length - 1];
    }
  }

  async executeMartingale() {
    if (this.riskCounter < this.riskToleranceList.length - 1) {
      this.riskCounter++;
      this.strategyBuilderService.setStrategyRisk(this.riskCounter, this.riskToleranceList.length);
    } else {
      await this.setCurrentHoldings();
      this.riskCounter = 0;
      this.strategyBuilderService.increaseStrategyRisk();
    }
    this.checkAndChangeStrategyOnNegativePnL();
    this.setRiskLevel();
    this.saveRisk();

    await this.handleStrategy();
  }

  /**
 * Checks today's combined portfolio PnL from localStorage and calls changeStrategy if negative.
 */
  public get strategies(): TradingStrategy[] {
    return this._strategies;
  }

  public set strategies(value: TradingStrategy[]) {
    this._strategies = value;
  }

  public get riskLevel(): RiskTolerance {
    return this._riskLevel;
  }

  public set riskLevel(value: RiskTolerance) {
    this._riskLevel = value;
  }

  public checkAndChangeStrategyOnNegativePnL(): void {
    try {
      const key = 'todaysPortfolioPlHistory';
      const historyRaw = localStorage.getItem(key);
      if (!historyRaw) { return; }
      const history = JSON.parse(historyRaw);
      // Sum all values in the history
      const combinedValue = history.reduce((sum: number, entry: { date: string, value: number }) => sum + (typeof entry.value === 'number' ? entry.value : 0), 0);
      if (combinedValue <= 0) {
        this.changeStrategy();
        this.currentHoldings.forEach(async (holding) => {
          await this.checkStopLoss(holding);
        });
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }
}
