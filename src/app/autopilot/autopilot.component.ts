import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment-timezone';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { SmartOrder } from '@shared/index';
import { Options } from '@shared/models/options';
import { OrderTypes } from '@shared/models/smart-order';
import { Trade } from '@shared/models/trade';
import { BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { AiPicksPredictionData } from '@shared/services/ai-picks.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { divide, round } from 'lodash';
import { MenuItem, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, Subscription } from 'rxjs';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { delay, take, takeUntil } from 'rxjs/operators';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PortfolioMgmtService } from '../portfolio-mgmt/portfolio-mgmt.service';
import { PricingService } from '../pricing/pricing.service';
import { PersonalBearishPicks } from '../rh-table/backtest-stocks.constant';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { PriceTargetService } from './price-target.service';

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
  TradingPairs = 'TradingPairs',
  BuyCalls = 'BuyCalls',
  BuyPuts = 'BuyPuts',
  BuySnP = 'Buy S&P500',
  InverseDispersion = 'Inverse dispersion trade',
  None = 'None'
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
  maxTradeCount = 9;
  maxHoldings = 15;
  developedStrategy = false;
  tradingPairsCounter = 0;
  strategyList = [
    Strategy.Default,
    Strategy.InverseDispersion,
    Strategy.OptionsStrangle,
    Strategy.Swingtrade,
    // Strategy.SingleStockPick,
    // Strategy.StateMachine,
    // Strategy.InverseSwingtrade,
    //Strategy.DaytradeShort,
    // Strategy.TradingPairs,
    Strategy.Daytrade,
    Strategy.TrimHoldings,
    Strategy.Short,
    // Strategy.DaytradeFullList,
    Strategy.BuyCalls,
    Strategy.BuySnP,
    //Strategy.None
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
  lastOptionsCheckCheck = null;
  lastCredentialCheck = moment();

  unsubscribe$ = new Subject();

  revealPotentialStrategy = false;

  strategies: PotentialTrade[] = [];

  dialogRef: DynamicDialogRef | undefined;

  lastReceivedRecommendation = null;
  boughtAtClose = false;
  multibuttonOptions: MenuItem[];
  startButtonOptions: MenuItem[];
  tradingPairs: SmartOrder[][] = [];
  manualStart = false;
  constructor(
    private portfolioService: PortfolioService,
    private backtestService: BacktestService,
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
    private daytradeStrategiesService: DaytradeStrategiesService,
    private orderHandlingService: OrderHandlingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private daytradeService: DaytradeService,
    private portfolioMgmtService: PortfolioMgmtService,
    private priceTargetService: PriceTargetService
  ) { }

  ngOnInit(): void {
    const lastStrategy = JSON.parse(localStorage.getItem('profitLoss'));
    if (lastStrategy && lastStrategy.lastStrategy) {
      const lastStrategyCount = this.strategyList.findIndex(strat => strat.toLowerCase() === lastStrategy.lastStrategy.toLowerCase());
      this.strategyCounter = lastStrategyCount >= 0 ? lastStrategyCount : 0;
      this.riskCounter = lastStrategy.lastRiskTolerance || 1;
      console.log('Previous profit loss', lastStrategy);
    } else {
      this.strategyCounter = 0;
    }

    this.findDaytradeService.getTradeObserver()
      .pipe(takeUntil(this.destroy$))
      .subscribe((trade: Trade) => {
        this.lastReceivedRecommendation = moment();
        if (this.hasTradeCapacity()) {
          this.addDaytrade(trade.stock);
          this.cartService.removeCompletedOrders();
        }
      });

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
        }
      }
    ];

    this.multibuttonOptions = [
      {
        label: 'Add strangle',
        command: () => {
          this.addOptions();
        }
      },
      {
        label: 'Sell All',
        command: async () => {
          await this.sellAll();
        }
      },
      {
        label: 'Sell All Options',
        command: async () => {
          await this.sellAllOptions();
        }
      },
      {
        label: 'Sell all strangles',
        command: () => {
          this.sellAllStrangle();
        }
      },
      {
        label: 'Get User Preferences',
        command: () => {
          this.getPreferences();
        }
      },
      {
        label: 'Add inverse dispersion trade',
        command: async () => {
          await this.placeInverseDispersionOrders();
        }
      },
      {
        label: 'Add trading pair trade',
        command: async () => {
          await this.placePairOrders();
        }
      },
      {
        label: 'Test pilot',
        command: async () => {
          this.cartService.removeCompletedOrders();
          this.currentHoldings = await this.cartService.findCurrentPositions();
          await this.modifyCurrentHoldings();
          console.log(this.currentHoldings);
          await this.orderHandlingService.intradayStep('SPY');
        }
      }
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
    this.developStrategy();
    this.timer = TimerObservable.create(1000, this.interval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        const startStopTime = this.globalSettingsService.getStartStopTime();
        if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 25) {
          this.lastCredentialCheck = moment();
          await this.backtestOneStock(true, false);
        } else if (moment().isAfter(moment(startStopTime.endDateTime).subtract(8, 'minutes')) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          if (!this.boughtAtClose) {
            await this.buySellAtClose();
            setTimeout(async () => {
              const profitLog = `Profit ${this.scoreKeeperService.total}`;
              this.reportingService.addAuditLog(null, profitLog);
              this.reportingService.exportAuditHistory();
              this.setProfitLoss();
            }, 600000);

            setTimeout(async () => {
              await this.modifyStrategy();
              this.scoreKeeperService.resetTotal();
              this.resetCart();
              this.developStrategy();
              this.boughtAtClose = false;
            }, 10800000);
          }

          this.boughtAtClose = true;
        } else if (moment().isAfter(moment(startStopTime.startDateTime)) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          await this.handleIntraday();
        } else {
          if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 3) {
            await this.backtestOneStock(false, false);
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

    if (tempProfitRecord) {
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
    this.cartService.removeCompletedOrders();
    this.cartService.otherOrders = [];
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
    if (this.manualStart) {
      return;
    }
    this.developedStrategy = true;

    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    this.currentHoldings = await this.cartService.findCurrentPositions();

    await this.modifyCurrentHoldings();
    await this.checkPersonalLists();
    await this.hedge();
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    if (balance.liquidationValue < 28000) {
      await this.defaultStrategy();
      return;
    }
    await this.handleStrategy();
  }

  async addStranglesToList() {
    const buyStrangleCb = async (symbol: string, prediction: number, backtestData: any) => {
      if (backtestData?.optionsVolume > 180) {
        const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();
        const lastPrice = price[symbol].quote.lastPrice;
        const closePrice = price[symbol].quote.closePrice;
        const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);

        if (!backtestResults.averageMove) {
          backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
        }
        if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove) {
          if (Math.abs(lastPrice - closePrice) < (backtestResults.averageMove * 0.90)) {
            if (prediction < 0.3 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
              const optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
              if (optionStrategy && optionStrategy.call && optionStrategy.put) {
                const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
                const order = await this.strategyBuilderService.addStrangleOrder(symbol, price, optionStrategy);
                console.log('Adding Bearish strangle', symbol, price, optionStrategy);
                this.optionsOrderBuilderService.addTradingPairs([order]);
              }
            } else {
              if (prediction > 0.6 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
                const optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
                if (optionStrategy && optionStrategy.call && optionStrategy.put) {
                  const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
                  const order = await this.strategyBuilderService.addStrangleOrder(symbol, price, optionStrategy);
                  console.log('Adding Bullish strangle', symbol, price, optionStrategy);
                  this.optionsOrderBuilderService.addTradingPairs([order]);
                } else {
                  console.log('Unable to build strangle for ', symbol);
                }
              }
            }
          }
        }
      }
    };
    await this.getNewTrades(buyStrangleCb);
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

  async getNewTrades(cb = null, list = null, maxTradeCount = this.maxTradeCount) {
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
    console.log('Current stock list length', counter);
    while (counter > 0 &&
      (this.cartService.buyOrders.length + this.cartService.otherOrders.length) < maxTradeCount) {
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

  async backtestOneStock(overwrite = false, addTrade = true) {
    try {
      let stock = this.machineDaytradingService.getNextStock();
      while (Boolean(this.currentHoldings.find((value) => value.name === stock))) {
        stock = this.machineDaytradingService.getNextStock();
      }
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock, overwrite);
      if (addTrade && backtestResults && (this.cartService.sellOrders.length + this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
        this.findSwingStockCallback(stock, backtestResults.ml, backtestResults);
      }
    } catch (error) {
      console.log('Error finding new trade', error);
    }
  }

  triggerBacktestNext() {
    this.backtestBuffer$.next();
  }

  async addBuy(holding: PortfolioInfoHolding, allocation = round(this.riskToleranceList[this.riskCounter], 2), reason) {
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {

      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const allIndicators = await this.getTechnicalIndicators(holding.name, startDate, currentDate).toPromise();
        const indicators = allIndicators.signals[allIndicators.signals.length - 1];
        const thresholds = this.getStopLoss(indicators.low, indicators.high);
        await this.cartService.portfolioBuy(holding,
          allocation,
          thresholds.profitTakingThreshold,
          thresholds.stopLoss, reason);
        await this.orderHandlingService.intradayStep(holding.name);
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
              this.optionsOrderBuilderService.sellStrangle(holding);
            } else if (callsTotalPrice > putsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7) {
              this.optionsOrderBuilderService.sellStrangle(holding);
            }
          } else if (!holding.secondaryLegs) {
            //this.optionsOrderBuilderService.hedgeTrade(holding.name, this.currentHoldings);
          }
        } else if ((backtestResults && (backtestResults.net < 0 || backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL' || holding.name === 'TQQQ'))) {
          console.log('Backtest indicates sell', backtestResults);
          await this.cartService.portfolioSell(holding, 'Backtest indicates sell');
        } else if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7 && (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY')) {
          console.log('Backtest indicates buying', backtestResults);
          await this.addBuy(this.createHoldingObj(holding.name), RiskTolerance.Zero, 'Backtest indicates buying');
        }
      } catch (error) {
        console.log('Backtest error', error);
      }
    });
    this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
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

  async trimHoldings() {
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
          await this.cartService.portfolioSell(sellHolding, 'Trim holdings');
        }
      }
    };

    this.backtestList(callback, this.currentHoldings);

    await this.checkIfTooManyHoldings(this.currentHoldings, 5);
  }

  async analyseRecommendations(holding: PortfolioInfoHolding) {
    if (holding.recommendation.toLowerCase() === 'buy') {
      await this.addBuy(holding, null, 'Recommendated buy');
    } else if (holding.recommendation.toLowerCase() === 'sell') {
      await this.cartService.portfolioSell(holding, 'Recommended sell');
    }
  }

  async sellOptionsHolding(holding: PortfolioInfoHolding, reason: string) {
    let orderType = null;
    if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
      orderType = OrderTypes.call;
    } else if (holding.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
      orderType = OrderTypes.put;
    }
    const estPrice = await this.orderHandlingService.getEstimatedPrice(holding.primaryLegs[0].symbol);
    this.cartService.addOptionOrder(holding.name, [holding.primaryLegs[0]], estPrice, holding.primaryLegs[0].quantity, orderType, 'Sell', reason);
  }

  async checkStopLoss(holding: PortfolioInfoHolding, stopLoss = -0.045, addStop = 0.01) {
    const pnl = holding.pnlPercentage;
    const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
    const price = await this.backtestService.getLastPriceTiingo({ symbol: holding.name }).toPromise();
    const lastPrice = price[holding.name].quote.lastPrice;

    const isOptionOnly = !this.cartService.isStrangle(holding) && holding.primaryLegs && holding.shares === 0;
    if (backtestResults.averageMove) {
      if (isOptionOnly) {
        stopLoss = (backtestResults.averageMove / lastPrice) * -12;
        this.reportingService.addAuditLog(holding.name, `Setting options stop loss to ${stopLoss}`);
        addStop = (backtestResults.averageMove / lastPrice) * 10;
      } else {
        stopLoss = (backtestResults.averageMove / lastPrice) * -3;
        this.reportingService.addAuditLog(holding.name, `Setting stock stop loss to ${stopLoss}`);
        addStop = (backtestResults.averageMove / lastPrice) / 3;
      }
    }
    if (pnl < stopLoss) {
      if (isOptionOnly) {
        await this.sellOptionsHolding(holding, `Options stop loss reached ${pnl}`);
      } else {
        await this.cartService.portfolioSell(holding, `Stop loss ${pnl}`);
      }
    } else if (pnl > addStop) {
      if (!isOptionOnly) {
        await this.addBuy(holding, null, 'Profit loss is positive');
      }
    }
  }

  async checkIfTooManyHoldings(currentHoldings: any[], maxHoldings = this.maxTradeCount) {
    if (currentHoldings.length > maxHoldings) {
      currentHoldings.sort((a, b) => a.pl - b.pl);
      const toBeSold = currentHoldings.slice(0, 1);
      console.log('too many holdings. selling', toBeSold, 'from', currentHoldings);
      toBeSold.forEach(async (holdingInfo) => {
        if (this.cartService.isStrangle(holdingInfo)) {
          this.optionsOrderBuilderService.sellStrangle(holdingInfo);
        } else if (holdingInfo.shares) {
          await this.cartService.portfolioSell(holdingInfo, 'Too many holdings');
        } else if (holdingInfo.primaryLegs) {
          await this.sellOptionsHolding(holdingInfo, 'Too many holdings');
        }
      });
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
      allocation,
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
      console.log('Decrease risk', backtestResults);

      this.decreaseDayTradeRiskTolerance();
      this.decreaseRiskTolerance();
      await this.trimHoldings();
    } else {
      const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
      if (lastProfitLoss && lastProfitLoss.profit) {
        if (Number(this.calculatePl(lastProfitLoss.profitRecord)) > 0) {
          console.log('increase risk', lastProfitLoss);
          this.increaseDayTradeRiskTolerance();
          this.increaseRiskTolerance();
        } else if (Number(this.calculatePl(lastProfitLoss.profitRecord)) < 0) {
          console.log('decrease risk', lastProfitLoss);
          this.decreaseDayTradeRiskTolerance();
          this.decreaseRiskTolerance();
        } else {
          this.adjustRiskTolerance();
        }
      } else {
        this.adjustRiskTolerance();
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

    if (averageOutput >= 0.5) {
      this.increaseDayTradeRiskTolerance();
      this.increaseRiskTolerance();
    } else {
      this.decreaseRiskTolerance();
      this.decreaseDayTradeRiskTolerance();
    }
  }

  async checkIfOverBalance() {
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const isOverBalance = Boolean(Number(balance.cashBalance) < 0);
    if (isOverBalance) {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      await this.checkIfTooManyHoldings(this.currentHoldings, 5);
    }
    return isOverBalance;
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

  async buySellAtClose() {
    await this.checkIfOverBalance();
    if (this.boughtAtClose || this.manualStart) {
      return;
    }

    this.boughtAtClose = true;

    const backtestData = await this.strategyBuilderService.getBacktestData('SPY');

    const buySymbol = 'UPRO';

    const price = await this.portfolioService.getPrice(buySymbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const allocation = backtestData?.ml || this.riskToleranceList[0];
    const cash = (balance.cashBalance < balance.availableFunds * 0.01) ? balance.cashBalance : ( balance.cashBalance > balance.availableFunds * 0.5 ?  balance.cashBalance * allocation * 2 : balance.cashBalance * allocation);
    const quantity = this.strategyBuilderService.getQuantity(price, 1, cash);
    const order = this.cartService.buildOrderWithAllocation(buySymbol, quantity, price, 'Buy',
      1, null, null,
      null, 1);
    console.log('Sending buy', order, 'ml result:', backtestData?.ml);

    this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
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
    this.strategyBuilderService.getBuyList().forEach(async (stock) => {
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
        if (backtestResults && backtestResults.ml !== null && (backtestResults.ml > 0.5 && (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY'))) {
          const msg = `Buy ${name}, date: ${moment().format()}`;
          this.messageService.add({ severity: 'success', summary: 'Buy alert', detail: msg, sticky: true });
          console.log(msg);
          await this.addBuy(stock, null, 'Personal list buy');
          setTimeout(() => {
            this.revealPotentialStrategy = true;
          }, 1000);
        }
      } catch (error) {
        console.log(error);
      }
    });

    PersonalBearishPicks.forEach(async (stock) => {
      const name = stock.ticker;
      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(name);
        if (backtestResults && backtestResults.ml !== null && (backtestResults.ml < 0.5 && (backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL'))) {
          const msg = `Sell ${name}, date: ${moment().format()}`;
          this.messageService.add({ severity: 'error', summary: 'Sell alert', detail: msg, sticky: true });
          console.log(msg);
          const cash = await this.cartService.getAvailableFunds(false);
          const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
          const minCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
          this.optionsOrderBuilderService.balanceTrades(this.currentHoldings, ['SPY'], [name], minCash, maxCash);
          setTimeout(() => {
            this.revealPotentialStrategy = true;
          }, 1000);
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async hedge() {
    this.portfolioMgmtService.hedge(this.currentHoldings, this.optionsOrderBuilderService.getTradingPairs(), this.riskToleranceList[1], this.riskToleranceList[this.riskCounter]);
  }

  async sellAll() {
    this.currentHoldings = await this.cartService.findCurrentPositions();
    this.currentHoldings.forEach(async (holding) => {
      if (!this.cartService.isStrangle(holding)) {
        if (!holding?.primaryLegs?.length) {
          await this.cartService.portfolioSell(holding, 'Sell all command');
        }
      }
    });
  }

  async sellAllOptions() {
    this.currentHoldings.forEach(async (holding) => {
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

          this.cartService.addOptionOrder(holding.name, [holding.primaryLegs[0]],
            estPrice, holding.primaryLegs[0].quantity,
            orderType, 'Sell', 'Manual command to sell all options');
        }
      }
    });
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

  async handleStrategy() {
    switch (this.strategyList[this.strategyCounter]) {
      case Strategy.OptionsStrangle:
        await this.addStranglesToList();
        await this.getNewTrades(null, null, 2);
        break;
      case Strategy.TradingPairs:
        await this.placePairOrders();
        await this.getNewTrades(null, null, 2);
        break;
      case Strategy.Swingtrade:
        await this.getNewTrades(null, null, 5);
        break;
      case Strategy.TrimHoldings:
        await this.trimHoldings();
        break;
      case Strategy.Short:
        this.optionsOrderBuilderService.getTradingPairs().forEach(async (trade) => {
          if (trade.length === 2) {
            this.cartService.addToCart(trade[1], true, 'Short strategy');
          }
        });
        const buyBearishStrangle = async (symbol: string, prediction: number, backtestData: any) => {
          if (backtestData?.optionsVolume > 230 && backtestData.sellSignals.length > 1) {
            if (prediction < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
              const optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
              if (optionStrategy && optionStrategy.call && optionStrategy.put) {
                const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
                this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
                console.log('Adding Bearish strangle', symbol, price, optionStrategy);
              }
            }
          }
        };
        await this.getNewTrades(buyBearishStrangle);
        break;
      case Strategy.BuyCalls:
        this.optionsOrderBuilderService.getTradingPairs().forEach(async (trade) => {
          if (trade.length === 2) {
            this.cartService.addToCart(trade[0], false, 'Buy calls strategy');
          }
        });
        await this.getNewTrades(null, null, 2);
        break;
      case Strategy.BuySnP:
        const balance = await this.portfolioService.getTdBalance().toPromise();
        const maxCash = round(this.riskToleranceList[0] * balance.cashBalance);
        await this.strategyBuilderService.buySnP(maxCash, balance.cashBalance);
        await this.getNewTrades(null, null, 2);
        break;
      case Strategy.InverseDispersion:
        await this.defaultStrategy();
        break;
      default: {
        await this.defaultStrategy();
        break;
      }
    }
    await this.padBuys();
  }

  async defaultStrategy() {
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
    const minCash = round(this.riskToleranceList[0] * cash, 2);
    await this.optionsOrderBuilderService.createTradingPair(this.currentHoldings, minCash, maxCash);

    const findPuts = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
        const cash = await this.cartService.getAvailableFunds(false);
        const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
        const minCash = round(this.riskToleranceList[0] * cash, 2);
        await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings, ['SPY'], [symbol], minCash, maxCash);
      } else if ((prediction > 0.7 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
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
    };
    await this.getNewTrades(findPuts);
  }

  async padBuys() {
    if (this.cartService.sellOrders.length + this.cartService.buyOrders.length + this.cartService.otherOrders.length < 3) {
      const buyStockCb = async (symbol: string, prediction: number, backtestData: any) => {
        if ((prediction > 0.5 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
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
      };
      await this.getNewTrades(buyStockCb, null, 3);
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
    return this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length < this.maxTradeCount;
  }

  async handleIntraday() {
    const isOpened = await this.isMarketOpened();
    if (isOpened) {
      this.cleanUpOrders();
      if (!this.lastOptionsCheckCheck || Math.abs(moment().diff(this.lastOptionsCheckCheck, 'minutes')) > 15) {
        this.lastOptionsCheckCheck = moment();
        this.currentHoldings = await this.cartService.findCurrentPositions();
        await this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
        await this.priceTargetService.checkProfitTarget(this.currentHoldings);
        await this.checkIfOverBalance();
      } else {
        this.executeOrderList();
        if (this.strategyList[this.strategyCounter] === Strategy.Daytrade &&
          (this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length) < this.maxTradeCount && (!this.lastReceivedRecommendation || Math.abs(this.lastReceivedRecommendation.diff(moment(), 'minutes')) > 5)) {
          this.findDaytradeService.getRefreshObserver().next(true);
        }
      }
    }
  }

  async placeInverseDispersionOrders() {
    await this.defaultStrategy();
    this.addTradingPairOrders();
  }

  async placePairOrders() {
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.riskToleranceList[this.riskCounter] * cash, 2);
    const minCash = round(this.riskToleranceList[1] * cash, 2);
    await this.optionsOrderBuilderService.createTradingPair(this.currentHoldings, minCash, maxCash);
    this.addTradingPairOrders();
  }

  private addTradingPairOrders() {
    this.optionsOrderBuilderService.getTradingPairs().forEach(async (trade) => {
      if (trade.length === 2 && trade[0] && trade[1]) {
        this.optionsOrderBuilderService.addTradingPair(trade, 'Add pair for test');
      }
    });
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
