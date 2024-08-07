import { Component, OnDestroy, OnInit } from '@angular/core';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { SmartOrder } from '@shared/index';
import { Options } from '@shared/models/options';
import { Trade } from '@shared/models/trade';
import { BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { AiPicksPredictionData, AiPicksService } from '@shared/services/ai-picks.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { AlgoQueueItem } from '@shared/services/trade.service';
import { divide, floor, round } from 'lodash';
import * as moment from 'moment-timezone';
import { MenuItem, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, Subscription } from 'rxjs';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { delay, finalize, take, takeUntil } from 'rxjs/operators';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { TrainingResults } from '../machine-learning/ask-model/ask-model.component';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PricingService } from '../pricing/pricing.service';
import { AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { OrderTypes } from '@shared/models/smart-order';

export interface PositionHoldings {
  name: string;
  pl: number;
  netLiq: number;
  shares: number;
  alloc: number;
  recommendation: 'None' | 'Bullish' | 'Bearish' | null;
  buyReasons: string;
  sellReasons: string;
  buyConfidence: number;
  sellConfidence: number;
  prediction: number;
}

export interface ProfitLossRecord {
  date: string;
  profit: number;
  lastStrategy: string;
  profitRecord: ScoringIndex<number>;
  lastRiskTolerance: number;
}

export enum DaytradingAlgorithms {
  recommendation,
  bband,
  demark9,
  macd,
  mfi,
  mfiTrade,
  roc,
  vwma
}

export enum SwingtradeAlgorithms {
  recommendation,
  demark9,
  macd,
  mfi,
  mfiDivergence,
  mfiDivergence2,
  mfiLow,
  mfiTrade,
  roc,
  vwma
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
  TradingPairs = 'TradingPairs'
}

export enum RiskTolerance {
  Zero = 0.01,
  Lower = 0.02,
  Low = 0.05,
  ExtremeFear = 0.1,
  Fear = 0.25,
  Neutral = 0.5,
  Greed = 0.75,
  ExtremeGreed = 1,
  XLGreed = 1.05,
  XXLGreed = 1.1,
  XXXLGreed = 1.25,
  XXXXLGreed = 1.5,
  XXXXXLGreed = 1.75,
}

@Component({
  selector: 'app-autopilot',
  templateUrl: './autopilot.component.html',
  styleUrls: ['./autopilot.component.scss']
})
export class AutopilotComponent implements OnInit, OnDestroy {
  display = false;
  isLoading = true;
  defaultInterval = 120000;
  interval = 120000;
  oneDayInterval;
  timer: Subscription;
  orderListTimer: Subscription;
  alive = false;
  destroy$ = new Subject();
  currentHoldings: PortfolioInfoHolding[] = [];
  strategyCounter = null;
  maxTradeCount = 20;
  maxHoldings = 15;
  developedStrategy = false;

  strategyList = [
    Strategy.Default,
    // Strategy.OptionsStrangle,
    Strategy.Swingtrade,
    // Strategy.SingleStockPick,
    // Strategy.StateMachine,
    // Strategy.InverseSwingtrade,
    //Strategy.DaytradeShort,
    // Strategy.TradingPairs,
    Strategy.TrimHoldings,
    Strategy.Short,
    // Strategy.DaytradeFullList,
  ];

  bearishStrategy = [
    Strategy.MLSpy,
    Strategy.TrimHoldings,
    Strategy.DaytradeShort,
    Strategy.Short
  ];

  riskCounter = 0;
  dayTradeRiskCounter = 0;

  riskToleranceList = [
    RiskTolerance.Zero,
    RiskTolerance.Lower,
    RiskTolerance.Low,
    RiskTolerance.ExtremeFear,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.Greed,
    RiskTolerance.ExtremeGreed
  ];

  dayTradingRiskToleranceList = [
    RiskTolerance.Low,
    RiskTolerance.ExtremeFear,
    RiskTolerance.Fear,
    RiskTolerance.Neutral,
    RiskTolerance.ExtremeGreed
  ];

  backtestBuffer$;

  lastOrderListIndex = 0;

  lastInterval = null;

  lastMarketHourCheck = null;
  lastCredentialCheck = moment();

  unsubscribe$ = new Subject();

  revealPotentialStrategy = false;

  strategies: PotentialTrade[] = [];

  dialogRef: DynamicDialogRef | undefined;

  lastReceivedRecommendation = null;
  boughtAtClose = false;
  multibuttonOptions: MenuItem[];
  tradingPairs = [];

  constructor(
    private portfolioService: PortfolioService,
    private backtestService: BacktestService,
    private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private dailyBacktestService: DailyBacktestService,
    private messageService: MessageService,
    private scoreKeeperService: ScoreKeeperService,
    private reportingService: ReportingService,
    private tradeService: TradeService,
    private machineDaytradingService: MachineDaytradingService,
    private findPatternService: FindPatternService,
    private machineLearningService: MachineLearningService,
    private globalSettingsService: GlobalSettingsService,
    private daytradeService: DaytradeService,
    public dialogService: DialogService,
    private findDaytradeService: FindDaytradeService,
    private aiPicksService: AiPicksService,
    private pricingService: PricingService,
    private daytradeStrategiesService: DaytradeStrategiesService,
    private orderHandlingService: OrderHandlingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService
  ) { }

  ngOnInit(): void {
    const lastStrategy = JSON.parse(localStorage.getItem('profitLoss'));
    if (lastStrategy && lastStrategy.lastStrategy) {
      const lastStrategyCount = this.strategyList.findIndex(strat => strat.toLowerCase() === lastStrategy.lastStrategy.toLowerCase());
      this.strategyCounter = lastStrategyCount >= 0 ? lastStrategyCount : 0;
      this.riskCounter = lastStrategy.lastRiskTolerance || 0;
    } else {
      this.strategyCounter = 0;
    }

    this.findDaytradeService.getTradeObserver()
      .pipe(takeUntil(this.destroy$))
      .subscribe((trade: Trade) => {
        this.lastReceivedRecommendation = moment();
        if (this.cartService.otherOrders.length < this.maxTradeCount) {
          this.addDaytrade(trade.stock);
          this.cartService.removeCompletedOrders();
        }
      });

    this.multibuttonOptions = [
      {
        label: 'Sell options',
        command: async () => {
          this.currentHoldings = await this.cartService.findCurrentPositions();
          this.analyseCurrentOptions();
        }
      },
      {
        label: 'Hedge',
        command: () => {
          this.hedge();
        }
      },
      {
        label: 'Sell All',
        command: async () => {
          await this.sellAll();
        }
      },
      {
        label: 'Update stock list',
        command: () => {
          this.updateStockList();
        }
      },
      {
        label: 'Add strangle',
        command: () => {
          this.addOptions();
        }
      },
      {
        label: 'Sell all strangles',
        command: () => {
          this.sellAllStrangle();
        }
      },
      {
        label: 'Show strategies',
        command: async () => {
          this.revealPotentialStrategy = !this.revealPotentialStrategy;
          await this.optionsOrderBuilderService.createTradingPair(this.tradingPairs);
          setTimeout(() => {
            console.log(this.tradingPairs);
          }, 300000);
        }
      },
      {
        label: 'Get User Preferences',
        command: () => {
          this.getPreferences();
        }
      },
      {
        label: 'Process current holdings',
        command: async () => {
          this.currentHoldings = await this.cartService.findCurrentPositions();
          await this.modifyCurrentHoldings();
        }
      }
    ];
  }

  open() {
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
      summary: 'Autopilot started'
    });
  }

  analyseCurrentOptions() {
    this.currentHoldings.forEach(async (holding) => {
      if (holding.primaryLegs) {
        const callPutInd = holding.primaryLegs[0].putCallInd.toLowerCase();
        const isStrangle = this.cartService.isStrangle(holding);
        const shouldSell = this.shouldSellOptions(holding, isStrangle, callPutInd);

        if (shouldSell) {
          if (isStrangle) {
            this.sellStrangle(holding);
          } else {
            const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
            let orderType = null;
            if (callPutInd === 'c') {
              orderType = OrderTypes.call;
            } else if (callPutInd === 'p') {
              orderType = OrderTypes.put;
            }

            this.cartService.addOptionOrder(holding.name, [holding.primaryLegs[0]], estPrice, holding.primaryLegs[0].quantity, orderType, 'Sell');
          }
        }
      }
    });
  }

  startInterval() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
    this.developStrategy();
    this.timer = TimerObservable.create(1000, this.interval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        const startStopTime = this.globalSettingsService.getStartStopTime();
        if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 25) {
          this.lastCredentialCheck = moment();
          await this.findNewTrade(true, false);
        } else if (moment().isAfter(moment(startStopTime.endDateTime).subtract(8, 'minutes')) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          this.buySellAtClose();
        } else if (moment().isAfter(moment(startStopTime.endDateTime).add(3, 'hours')) &&
          this.reportingService.logs.length > 0 &&
          moment().isBefore(moment(startStopTime.endDateTime).add(5, 'minute'))) {
          const profitLog = `Profit ${this.scoreKeeperService.total}`;
          this.reportingService.addAuditLog(null, profitLog);
          this.reportingService.exportAuditHistory();
          await this.modifyStrategy();
          this.setProfitLoss();
          this.scoreKeeperService.resetTotal();
          this.resetCart();
          this.developStrategy();
        } else if (moment().isAfter(moment(startStopTime.startDateTime)) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          const isOpened = await this.isMarketOpened();
          if (isOpened) {
            this.executeOrderList();
            if (this.cartService.otherOrders.length < this.maxTradeCount && (!this.lastReceivedRecommendation || Math.abs(this.lastReceivedRecommendation.diff(moment(), 'minutes')) > 5)) {
              this.findDaytradeService.getRefreshObserver().next(true);
            } else {
              this.cartService.removeCompletedOrders();
              this.cartService.otherOrders.forEach(order => {
                if (order.side.toLowerCase() === 'daytrade' &&
                  moment(order.createdTime).diff(moment(), 'minutes') > 60 &&
                  order.positionCount === 0) {
                  this.reportingService.addAuditLog(order.holding.name, 'Deleting day trade');
                  this.cartService.deleteDaytrade(order);
                }
              });
            }
            this.currentHoldings = await this.cartService.findCurrentPositions();
            this.analyseCurrentOptions();
          }
        } else {
          if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 3) {
            await this.findNewTrade(false, false);
            this.startFindingTrades();
          }
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

    const profit = this.calculatePl(tempProfitRecord);

    const profitObj: ProfitLossRecord = {
      'date': moment().format(),
      profit: profit,
      lastStrategy: this.strategyList[this.strategyCounter],
      lastRiskTolerance: this.riskCounter,
      profitRecord: tempProfitRecord
    };
    localStorage.setItem('profitLoss', JSON.stringify(profitObj));
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
    this.lastOrderListIndex = 0;
    //this.cartService.removeCompletedOrders();
    this.cartService.deleteCart();
    this.developedStrategy = false;
  }

  decreaseRiskTolerance() {
    if (this.riskCounter > 0) {
      this.riskCounter--;
    }
    this.changeStrategy();
  }

  decreaseDayTradeRiskTolerance() {
    if (this.dayTradeRiskCounter > 0) {
      this.dayTradeRiskCounter = 0;
    }
    this.changeStrategy();
  }

  increaseRiskTolerance() {
    if (this.riskCounter < this.riskToleranceList.length - 1) {
      this.riskCounter++;
    }
    console.log(`Increase risk to ${this.riskCounter}`);
  }

  increaseDayTradeRiskTolerance() {
    if (this.dayTradeRiskCounter < this.dayTradingRiskToleranceList.length - 1) {
      this.dayTradeRiskCounter++;
    }
  }

  changeStrategy() {
    if (this.strategyCounter < this.strategyList.length - 1) {
      this.strategyCounter++;
    } else {
      this.strategyCounter = 0;
    }
    const strat = this.strategyList[this.strategyCounter];
    this.messageService.add({
      severity: 'info',
      summary: `Strategy changed to ${strat}`
    });
    console.log(`Strategy changed to ${strat}. Risk tolerance ${this.riskCounter}`);
  }

  async developStrategy() {
    this.developedStrategy = true;

    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    this.currentHoldings = await this.cartService.findCurrentPositions();

    this.setProfitLoss();

    await this.modifyCurrentHoldings();
    await this.checkPersonalLists();
    await this.hedge();
    // await this.optionsOrderBuilderService.createTradingPair();

    switch (this.strategyList[this.strategyCounter]) {
      case Strategy.OptionsStrangle:
        const buyStrangleCb = async (symbol: string, prediction: number, backtestData: any) => {
          if (backtestData?.optionsVolume > 230 && backtestData.sellSignals.length > 1) {
            if (prediction < 0.3 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
              const optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
              const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
              this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
              console.log('Adding Bearish strangle', symbol, price, optionStrategy);
            } else {
              if (prediction > 0.6 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
                const optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
                const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
                this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
                console.log('Adding Bullish strangle', symbol, price, optionStrategy);
              }
            }
          }
        };
        await this.getNewTrades(buyStrangleCb);
        break;
      case Strategy.TradingPairs:
        await this.optionsOrderBuilderService.createTradingPair(this.tradingPairs);
        break;
      case Strategy.Swingtrade:
        await this.findNewTrade(true);
        break;
      case Strategy.TrimHoldings:
        this.trimHoldings();
        break;
      case Strategy.Short:
        const buyBearishStrangle = async (symbol: string, prediction: number, backtestData: any) => {
          if (backtestData?.optionsVolume > 230 && backtestData.sellSignals.length > 1) {
            if (prediction < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
              const optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
              const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
              this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
              console.log('Adding Bearish strangle', symbol, price, optionStrategy);
            }
          }
        };
        await this.getNewTrades(buyBearishStrangle);
        break;
      default: {
        await this.getNewTrades();
        break;
      }
    }
  }

  async findSwingStockCallback(symbol: string, prediction: number, backtestData: any) {
    if (symbol === 'TQQQ' || (prediction => 0.3 && prediction <= 0.7)) {
      return;
    }
    if (prediction > 0.7 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
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
      await this.addBuy(stock);
    }
  }

  async getNewTrades(cb = null, list = null) {
    this.findPatternService.buildTargetPatterns();
    if (list) {
      this.machineDaytradingService.setCurrentStockList(list);
    } else if (!this.machineDaytradingService.getCurrentStockList()) {
      this.machineDaytradingService.setCurrentStockList(CurrentStockList);
    }
    let stock;
    const found = (name) => {
      return Boolean(this.currentHoldings.find((value) => value.name === name));
    };
    let counter = this.machineDaytradingService.getCurrentStockList().length;
    while (counter > 0 && (this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
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

  isBuyPrediction(prediction: { label: string, value: AiPicksPredictionData[] }) {
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

  async backtestList(cb = async (stock: any, mlResult: number) => { }, stockList: (PortfolioInfoHolding[] | any[]) = CurrentStockList) {
    stockList.forEach(async (stock) => {
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock.name);
      if (backtestResults) {
        cb(stock, backtestResults.ml);
      }
    });
  }

  async findNewTrade(overwrite = false, addTrade = true) {
    try {
      let stock = this.machineDaytradingService.getNextStock();
      while (Boolean(this.currentHoldings.find((value) => value.name === stock))) {
        stock = this.machineDaytradingService.getNextStock();
      }
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock, overwrite);
      if (addTrade && backtestResults && backtestResults.ml !== null && (this.cartService.sellOrders.length + this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
        this.findSwingStockCallback(stock, backtestResults.ml, backtestResults);
      }
    } catch (error) {
      console.log('Error finding new trade', error);
    }
  }

  triggerBacktestNext() {
    this.backtestBuffer$.next();
  }

  async addBuy(holding: PortfolioInfoHolding, allocation = round(this.riskToleranceList[this.riskCounter], 2)) {
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {

      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicators = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicators.low, indicators.high);
        await this.portfolioBuy(holding,
          allocation,
          thresholds.profitTakingThreshold,
          thresholds.stopLoss);
      } catch (error) {
        console.log('Error getting backtest data for ', holding.name, error);
      }
    } else {
      console.log('Tried to add buy order but too many orders', holding);

      this.unsubscribeStockFinder();
    }
  }

  async addDaytrade(stock: string) {
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const indicators = await this.getTechnicalIndicators(stock, startDate, currentDate).toPromise();
        const thresholds = this.getStopLoss(indicators.low, indicators.high);
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
    } else {
      this.unsubscribeStockFinder();
    }
  }

  initializeOrder(order: SmartOrder) {
    order.stopped = false;
    const queueItem: AlgoQueueItem = {
      symbol: order.holding.symbol,
      reset: true
    };

    this.tradeService.algoQueue.next(queueItem);
  }

  initializeOrders() {
    const concat = this.cartService.sellOrders.concat(this.cartService.buyOrders);
    const orders = concat.concat(this.cartService.otherOrders);
    orders.forEach((order: SmartOrder) => {
      this.initializeOrder(order);
    });
  }

  executeOrderList() {
    if (this.orderListTimer) {
      this.orderListTimer.unsubscribe();
    }
    const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
    const orders = buyAndSellList.concat(this.cartService.otherOrders);

    this.orderListTimer = TimerObservable.create(100, 1500)
      .pipe(take(orders.length))
      .subscribe(async () => {
        if (this.lastOrderListIndex >= orders.length) {
          this.lastOrderListIndex = 0;
        }
        const symbol = orders[this.lastOrderListIndex].holding.symbol;
        if (!this.daytradeStrategiesService.shouldSkip(symbol)) {
          await this.orderHandlingService.intradayStep(symbol);
        }

        this.lastOrderListIndex++;
      });
  }

  getLastTradeDate() {
    return this.globalSettingsService.getLastTradeDate();
  }

  setLoading(value: boolean) {
    this.isLoading = value;
  }

  async modifyCurrentHoldings() {
    const sellHolding = this.currentHoldings.find(holdingInfo => {
      return holdingInfo.name === 'TQQQ';
    });
    if (sellHolding) {
      this.portfolioSell(sellHolding);
    }

    const currentDate = moment().format('YYYY-MM-DD');
    const startDate = moment().subtract(365, 'days').format('YYYY-MM-DD');
    this.currentHoldings.forEach(async (holding) => {
      await this.checkStopLoss(holding);

      const indicatorsResponse = await this.getTechnicalIndicators(holding.name,
        startDate,
        currentDate)
        .pipe(delay(new Date().getMilliseconds())).toPromise();

      this.analyseIndicators(holding.name, indicatorsResponse.signals, this.currentHoldings);
      const indicators = indicatorsResponse.signals[indicatorsResponse.signals.length - 1];
      const foundIdx = this.currentHoldings.findIndex((value) => {
        return value.name === holding.name;
      });

      this.currentHoldings[foundIdx].recommendation = indicators.recommendation.recommendation;
      const reasons = this.getRecommendationReason(indicators.recommendation);
      this.currentHoldings[foundIdx].buyReasons = reasons.buyReasons;
      this.currentHoldings[foundIdx].sellReasons = reasons.sellReasons;
      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
        if (holding.primaryLegs) {
          if (this.cartService.isStrangle(holding)) {
            const { callsTotalPrice, putsTotalPrice } = await this.pricingService.getPricing(holding.primaryLegs, holding.secondaryLegs);
            if (putsTotalPrice > callsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml < 0.3) {
              this.sellStrangle(holding);
            } else if (callsTotalPrice > putsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7) {
              this.sellStrangle(holding);
            }
          } else if (!holding.secondaryLegs) {
            //this.optionsOrderBuilderService.hedgeTrade(holding.name, this.currentHoldings);
          }
        } else if ((backtestResults && (backtestResults.net < 0 || (backtestResults.ml !== null &&
          (backtestResults.ml < 0.3 || backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL')) || holding.name === 'TQQQ'))) {
          console.log('Backtest indicates sell', backtestResults);
          this.portfolioSell(holding);
        } else if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7 && (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY')) {
          console.log('Backtest indicates buying', backtestResults);
          await this.addBuy(this.createHoldingObj(holding.name), RiskTolerance.Zero);
        } else {
          //await this.optionsOrderBuilderService.createProtectivePutOrder(holding);
        }
      } catch (error) {
        console.log('Backtest error', error);
      }
    });
  }

  isExpiring(holding: PortfolioInfoHolding) {
    return (holding.primaryLegs ? holding.primaryLegs : []).concat(holding.secondaryLegs ? holding.secondaryLegs : []).find((option: Options) => {
      const expiry = option.description.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)[0];
      return moment(expiry).diff(moment(), 'days') < 30;
    });
  }

  getTechnicalIndicators(stock: string, startDate: string, currentDate: string) {
    return this.backtestService.getBacktestEvaluation(stock, startDate, currentDate, 'daily-indicators');
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

  trimHoldings() {
    const callback = async (symbol: string, prediction: number) => {
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
      if (prediction < 0.5) {
        const sellHolding = this.currentHoldings.find(holdingInfo => {
          return holdingInfo.name === stock.name;
        });
        if (sellHolding && !sellHolding.primaryLegs.length) {
          this.portfolioSell(sellHolding);
        }
      }
    };

    this.backtestList(callback, this.currentHoldings);
  }

  async analyseRecommendations(holding: PortfolioInfoHolding) {
    if (holding.recommendation.toLowerCase() === 'buy') {
      await this.addBuy(holding);
    } else if (holding.recommendation.toLowerCase() === 'sell') {
      this.portfolioSell(holding);
    }
  }

  async checkStopLoss(holding: PortfolioInfoHolding) {
    const percentLoss = divide(holding.pl, holding.netLiq);
    if (percentLoss < -0.045) {
      this.portfolioSell(holding);
    } else if (percentLoss > 0.01) {
      await this.addBuy(holding);
    }
  }

  checkIfTooManyHoldings(currentHoldings: any[]) {
    if (currentHoldings.length > this.maxTradeCount) {
      currentHoldings.sort((a, b) => a.pl - b.pl);
      const toBeSold = currentHoldings.slice(0, 1);
      console.log('too many holdings. selling', toBeSold, 'from', currentHoldings);
      toBeSold.forEach(holdingInfo => {
        console.log('selling ', holdingInfo);
        this.portfolioSell(holdingInfo);
      });
    }
  }

  buildOrder(symbol: string, quantity = 0, price = 0,
    side = 'DayTrade', orderSizePct = 0.5, lossThreshold = -0.004,
    profitTarget = 0.008, trailingStop = -0.003, allocation = null): SmartOrder {
    return {
      holding: {
        instrument: null,
        symbol,
      },
      quantity,
      price,
      submitted: false,
      pending: false,
      orderSize: floor(quantity * orderSizePct) || 1,
      side,
      lossThreshold: lossThreshold,
      profitTarget: profitTarget,
      trailingStop: trailingStop,
      useStopLoss: true,
      useTrailingStopLoss: true,
      useTakeProfit: true,
      sellAtClose: (side.toLowerCase() === 'sell' || side.toLowerCase() === 'daytrade') ? true : false,
      // sellAtClose: false,
      allocation
    };
  }

  getAllocationPct(totalAllocationPct: number = 0.1, numberOfOrders: number) {
    return round(divide(totalAllocationPct, numberOfOrders), 2);
  }

  async portfolioSell(holding: PortfolioInfoHolding) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const orderSizePct = 0.5;
    const order = this.buildOrder(holding.name, holding.shares, price, 'Sell',
      orderSizePct, null, null, null);
    this.cartService.addToCart(order, true);
    this.initializeOrder(order);
  }

  async buildBuyOrder(holding: PortfolioInfoHolding,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null,
    useCashBalance = true) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const cash = await this.cartService.getAvailableFunds(useCashBalance);
    const quantity = this.getQuantity(price, allocation, cash);
    const orderSizePct = (this.riskToleranceList[this.riskCounter] > 0.5) ? 0.5 : 0.3;
    const order = this.buildOrder(holding.name, quantity, price, 'Buy',
      orderSizePct, stopLossThreshold, profitThreshold,
      stopLossThreshold, allocation);
    return order;
  }

  async portfolioBuy(holding: PortfolioInfoHolding,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null) {
    const order = await this.buildBuyOrder(holding, allocation, profitThreshold, stopLossThreshold);
    if (order.quantity) {
      this.cartService.addToCart(order);
      this.initializeOrder(order);
    }
  }

  async portfolioDaytrade(symbol: string,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null) {
    const price = await this.portfolioService.getPrice(symbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const quantity = this.getQuantity(price, allocation, balance.buyingPower);
    const orderSizePct = 0.5;
    const order = this.buildOrder(symbol,
      quantity,
      price,
      'DayTrade',
      orderSizePct,
      stopLossThreshold,
      profitThreshold,
      stopLossThreshold,
      allocation);
    const log = 'Added day trade';
    this.reportingService.addAuditLog(symbol, log);

    this.cartService.addToCart(order);
    this.initializeOrder(order);
  }

  private getQuantity(stockPrice: number, allocationPct: number, total: number) {
    const totalCost = round(total * allocationPct, 2);
    if (!totalCost) {
      return 0;
    }
    return Math.floor(totalCost / stockPrice);
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

  private getStopLoss(low: number, high: number) {
    const profitTakingThreshold = round(((high / low) - 1) / 2, 4);
    const stopLoss = profitTakingThreshold * -1;
    return {
      profitTakingThreshold,
      stopLoss
    }
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

  async modifyStrategy() {
    const backtestResults = await this.strategyBuilderService.getBacktestData('SPY');

    if (backtestResults && (backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL')) {
      this.decreaseDayTradeRiskTolerance();
      this.decreaseRiskTolerance();
      this.trimHoldings();
    } else {
      const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
      if (lastProfitLoss && lastProfitLoss.profit) {
        if (Number(this.calculatePl(lastProfitLoss.profitRecord)) > 0) {
          this.increaseDayTradeRiskTolerance();
          this.increaseRiskTolerance();
        } else if (Number(this.calculatePl(lastProfitLoss.profitRecord)) < 0) {
          this.decreaseDayTradeRiskTolerance();
          this.decreaseRiskTolerance();
        }
      } else {
        try {
          this.machineLearningService
            .trainDaytrade('AAPL',
              moment().add({ days: 1 }).format('YYYY-MM-DD'),
              moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
              1,
              this.globalSettingsService.daytradeAlgo
            ).subscribe((mlResults: TrainingResults[]) => {
              if (mlResults && mlResults[0] !== null) {
                console.log('Next output', mlResults[0]?.nextOutput);
                if (mlResults[0]?.nextOutput > 0.5) {
                  this.increaseRiskTolerance();
                  this.increaseDayTradeRiskTolerance();
                } else if (mlResults[0]?.nextOutput < 0.5) {
                  this.decreaseRiskTolerance();
                  this.decreaseDayTradeRiskTolerance();
                }
              }
            });

        } catch (error) {
          console.log(error);
        }
      }
    }
  }

  async buySellAtClose() {
    if (this.boughtAtClose) {
      return;
    }
    const balance = await this.portfolioService.getTdBalance().toPromise();

    if (Number(balance.cashBalance) <= 0) {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      this.currentHoldings.forEach(async (holding) => {
        if (holding.name === 'VTI' || holding.name === 'TQQQ') {
          this.portfolioSell(holding);
        }
      });
    } else {
      const trainingResult = await this.aiPicksService.trainAndActivate('VTI');

      console.log('buy at close training results', trainingResult);
      if (trainingResult) {
        this.boughtAtClose = true;

        const price = await this.portfolioService.getPrice('VTI').toPromise();
        const balance = await this.portfolioService.getTdBalance().toPromise();

        const quantity = this.getQuantity(price, trainingResult.value, balance.cashBalance);
        const orderSizePct = (this.riskToleranceList[this.riskCounter] > 0.5) ? 0.5 : 0.3;

        const order = this.buildOrder('VTI', quantity, price, 'Buy',
          orderSizePct, null, null,
          null, trainingResult.value);
        this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
      }
    }
  }

  updateStockList() {
    this.dialogService.open(StockListDialogComponent, {
      header: 'Stock list',
      contentStyle: { 'overflow-y': 'unset' }
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
    this.currentHoldings.forEach(async (holding) => {
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

  async sellStrangle(holding: PortfolioInfoHolding) {
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
  }

  async isMarketOpened() {
    if (this.lastMarketHourCheck && this.lastMarketHourCheck.diff(moment(), 'minutes') < 29) {
      return false;
    }
    try {
      const marketHour: any = await this.portfolioService.getEquityMarketHours(moment().format('YYYY-MM-DD')).toPromise();
      if (marketHour && marketHour.equity) {
        if (marketHour.equity.EQ.isOpen) {
          return true;
        } else {
          this.lastMarketHourCheck = moment();
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      console.log('error checking equity hours', error);
    }
    return false;
  }

  getPreferences() {
    this.portfolioService.getUserPreferences().subscribe(pref => {
      console.log('pref', pref);
    });
  }

  async checkPersonalLists() {
    AlwaysBuy.forEach(async (stock) => {
      const name = stock.ticker;
      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(name);
        const stock: PortfolioInfoHolding = {
          name: name,
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
        if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.5) {
          await this.addBuy(stock);
          const log = `Adding buy ${stock.name}`;
          this.reportingService.addAuditLog(null, log);
        } else {
          await this.addBuy(stock, RiskTolerance.Zero);
          const log = `Adding buy ${stock.name}`;
          this.reportingService.addAuditLog(null, log);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async hedge() {
    this.currentHoldings = await this.cartService.findCurrentPositions();
    this.machineDaytradingService.getPortfolioBalance().subscribe(async (balance) => {
      this.currentHoldings.forEach(async (holding) => {
        if (!holding.primaryLegs) {
          if (holding.netLiq && (holding.netLiq / balance.liquidationValue) > 0.15)
            console.log('Adding protective put for', holding.name);
          await this.optionsOrderBuilderService.createProtectivePutOrder(holding);
        }
      });
    });
  }

  async shouldSellOptions(holding: PortfolioInfoHolding, isStrangle: boolean, putCallInd: string) {
    if (this.isExpiring(holding)) {
      console.log(`${holding.name} options are expiring soon`);
      return true;
    } else {
      const price = await this.backtestService.getLastPriceTiingo({ symbol: holding.name }).toPromise();
      const lastPrice = price[holding.name].quote.lastPrice;
      const closePrice = price[holding.name].quote.closePrice;
      const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);

      if (!backtestResults.averageMove) {
        backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
      }
      if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
        if (isStrangle && Math.abs(lastPrice - closePrice) > (backtestResults.averageMove * 1.15)) {
          return true;
        } else if (putCallInd === 'c' && lastPrice - closePrice < (backtestResults.averageMove * -1.15)) {
          return true;
        } else if (putCallInd === 'p' && lastPrice - closePrice > (backtestResults.averageMove * 1.15)) {
          return true;
        }
      }
    }
    return false;
  }

  async sellAll() {
    this.currentHoldings = await this.cartService.findCurrentPositions();
    this.currentHoldings.forEach(async (holding) => {
      if (!this.cartService.isStrangle(holding)) {
        if (holding?.primaryLegs?.length) {

        } else {
          this.portfolioSell(holding);
        }
      }
    });
    await this.sellAllStrangle();
  }

  async findExtremeIntradayMoves() {
    const recentBacktests = this.strategyBuilderService.sanitizeData();
    for (const symbol in recentBacktests) {
      const backtestResults = recentBacktests[symbol];
      if (backtestResults) {
        if (backtestResults.averageMove) {
          const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
          if ((price[symbol].closePrice - price[symbol].lastPrice) > backtestResults.averageMove) {
            const optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
            const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
            this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
            console.log('Adding Bullish strangle on big move', symbol, price, optionStrategy);
          }
        }
      }
    }
  }

  unsubscribeStockFinder() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  cleanUp() {
    this.resetCart();
    if (this.destroy$) {
      this.destroy$.next();
      this.destroy$.complete();
    }
    if (this.backtestBuffer$) {
      this.backtestBuffer$.unsubscribe();
    }
  }

  ngOnDestroy() {
    this.cleanUp();
  }
}
