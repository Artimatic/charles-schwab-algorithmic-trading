import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { finalize, takeUntil, take, delay } from 'rxjs/operators';
import * as moment from 'moment-timezone';
import { BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { SmartOrder } from '@shared/index';
import { divide, floor, round } from 'lodash';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { MenuItem, MessageService } from 'primeng/api';
import { AlgoQueueItem } from '@shared/services/trade.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { CurrentStockList } from '../rh-table/stock-list.constant';
import { AiPicksPredictionData, AiPicksService } from '@shared/services/ai-picks.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { Trade } from '@shared/models/trade';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { Options } from '@shared/models/options';
import { PricingService } from '../pricing/pricing.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { SimulationService } from '../simulation/simulation.service';
import { SimulationChartComponent } from '../simulation/simulation-chart/simulation-chart.component';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { TrainingData } from 'server/api/machine-learning/training.service';
import { TrainingResults } from '../machine-learning/ask-model/ask-model.component';
import { AlwaysBuy } from '../rh-table/backtest-stocks.constant';

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
  OptionsStrangle = 'OptionsStrangle'
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
  defaultInterval = 80000;
  interval = 80000;
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
    // Strategy.OptionsStrangle,
    // Strategy.MLSpy,
    // Strategy.SingleStockPick,
    // Strategy.StateMachine,
    //Strategy.Swingtrade,
    Strategy.Daytrade,
    //Strategy.TrimHoldings,
    // Strategy.InverseSwingtrade,
    //Strategy.DaytradeShort,
    // Strategy.Short,
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
    private orderHandlingService: OrderHandlingService
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
        label: 'Test trading functionalities',
        command: () => {
          this.testTrading();
        }
      },
      {
        label: 'Hedge',
        command: () => {
          this.hedge();
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
        command: () => {
          this.revealPotentialStrategy = !this.revealPotentialStrategy;
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
          await this.findCurrentPositions();
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
      if (this.isStrangle(holding)) {
        const price = await this.backtestService.getLastPriceTiingo({ symbol: holding.name }).toPromise();
        const lastPrice = price[holding.name].quote.lastPrice;
        const closePrice = price[holding.name].quote.closePrice;
        const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);

        if (!backtestResults.averageMove) {
          backtestResults.averageMove = backtestResults.impliedMovement * lastPrice;
        }
        if (backtestResults && backtestResults.ml !== null && backtestResults.averageMove && Math.abs(lastPrice - closePrice) > (backtestResults.averageMove * 1.15)) {
          console.log(`Large move detected for ${holding.name}. Selling strangle. Last price ${lastPrice}. Close price ${closePrice}.`);
          this.sellStrangle(holding);
        } else {
          const foundExpiringOption = holding.primaryLegs.concat(holding.secondaryLegs).find((option: Options) => {
            const expiry = option.description.match(/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/)[0];
            console.log(`${option.description} is expiring on ${moment(expiry).format()} ${expiry}`);
            return moment(expiry).diff(moment(), 'days') < 30;
          });
          if (foundExpiringOption) {
            console.log(`${holding.name} options are expiring soon`);
            this.sellStrangle(holding);
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
          await this.findNewTrade(true);
        } else if (moment().isAfter(moment(startStopTime.endDateTime).subtract(8, 'minutes')) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          this.buyAtClose();
          if (this.reportingService.logs.length > 0) {
            const profitLog = `Profit ${this.scoreKeeperService.total}`;
            this.reportingService.addAuditLog(null, profitLog);
            this.reportingService.exportAuditHistory();
            this.setProfitLoss();
            this.scoreKeeperService.resetTotal();
            this.resetCart();
          }
        } else if (moment().isAfter(moment(startStopTime.startDateTime)) &&
          moment().isBefore(moment(startStopTime.endDateTime))) {
          const isOpened = await this.isMarketOpened();
          if (isOpened) {
            if (!this.developedStrategy) {
              this.developStrategy();
              return;
            }
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
            await this.findCurrentPositions();
            this.analyseCurrentOptions();
          }
        } else {
          await this.findNewTrade();
          this.startFindingTrades();
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
    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    await this.findCurrentPositions();
    await this.modifyCurrentHoldings();
    await this.checkPersonalLists();
    this.setProfitLoss();
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

    await this.getNewTrades();
    this.developedStrategy = true;
  }

  async findTradeCallBack(symbol: string, prediction: number, backtestData: any) {
    if (symbol === 'TQQQ' || (prediction => 0.3 && prediction <= 0.7)) {
      return;
    }
    const price = await this.backtestService.getLastPriceTiingo({ symbol: symbol }).toPromise();

    if (this.currentHoldings.length > this.maxHoldings) {
      if (prediction > 0.7) {
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
        const backtestDate = this.getLastTradeDate();
        try {
          const trainingResults = await this.machineDaytradingService.trainStock(stock.name, backtestDate.subtract({ days: 3 }).format('YYYY-MM-DD'), backtestDate.add({ days: 2 }).format('YYYY-MM-DD'));
          console.log(`Intraday training results for ${stock.name} Correct: ${trainingResults[0].correct} Guesses: ${trainingResults[0].guesses}`);
          if (trainingResults && trainingResults[0].correct / trainingResults[0].guesses > 0.6 && trainingResults[0].guesses > 23) {
            const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
            if (!(lastProfitLoss && lastProfitLoss.profitRecord && lastProfitLoss.profitRecord[stock.name] && lastProfitLoss.profitRecord[stock.name] < 10)) {
              const trainingMsg = `Day trade training results correct: ${trainingResults[0].correct}, guesses: ${trainingResults[0].guesses}`;
              this.reportingService.addAuditLog(stock.name, trainingMsg);
              await this.addDaytrade(stock.name);
              console.log('Added day trade', stock.name);
            }
          }
        } catch (error) {
          console.log('error getting training results ', error);
        }
      }
    } else if (backtestData && backtestData.buySignals.length + backtestData.sellSignals.length > 3 && (backtestData.net / backtestData.invested) >= 0.08) {
      if ((Math.abs(price[symbol].closePrice - price[symbol].lastPrice) / price[symbol].closePrice) < (backtestData.averageMove * 0.85) || 0.01 &&
        backtestData?.optionsVolume > 230 && (prediction > 0.7 || prediction < 0.3)) {
        let optionStrategy;
        if (prediction > 0.7) {
          optionStrategy = await this.strategyBuilderService.getCallTrade(symbol);
          const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
          this.strategyBuilderService.addStrangle(optionStrategy.call.symbol + '/' + optionStrategy.put.symbol, price, optionStrategy);
          console.log('Adding Bullish strangle', symbol, price, optionStrategy);
        } else if (prediction < 0.3) {
          optionStrategy = await this.strategyBuilderService.getPutTrade(symbol);
          const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
          this.strategyBuilderService.addStrangle(optionStrategy.put.symbol + '/' + optionStrategy.call.symbol, price, optionStrategy);
          console.log('Adding Bearish strangle', symbol, price, optionStrategy);
        }
      } else if (prediction > 0.7) {
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
  }

  async getNewTrades() {
    this.findPatternService.buildTargetPatterns();
    if (!this.machineDaytradingService.getCurrentStockList()) {
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
        this.findTradeCallBack(stock, backtestResults.ml, backtestResults);
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

  async findNewTrade(overwrite = false) {
    try {
      let stock = this.machineDaytradingService.getNextStock();
      while (Boolean(this.currentHoldings.find((value) => value.name === stock))) {
        stock = this.machineDaytradingService.getNextStock();
      }
      const backtestResults = await this.strategyBuilderService.getBacktestData(stock, overwrite);
      if (backtestResults && backtestResults.ml !== null && (this.cartService.sellOrders.length + this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
        this.findTradeCallBack(stock, backtestResults.ml, backtestResults);
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

  createOptionObj(holding): Options {
    return {
      symbol: holding.instrument.symbol,
      putCall: holding.instrument.putCall,
      putCallInd: (holding.instrument.putCall.toLowerCase() === 'call' ? 'C' : (holding.instrument.putCall.toLowerCase() === 'put' ? 'P' : null)),
      quantity: holding.longQuantity,
      description: holding.instrument.description,
      averagePrice: holding.averagePrice * 100,
      underlyingSymbol: holding.instrument.underlyingSymbol
    };
  }

  private isStrangle(holding: PortfolioInfoHolding) {
    return (holding.primaryLegs && holding.secondaryLegs) &&
      (holding.primaryLegs.length === holding.secondaryLegs.length) &&
      (holding.primaryLegs[0].putCallInd !== holding.secondaryLegs[0].putCallInd);
  }

  private protectivePutCount(holding: PortfolioInfoHolding): number {
    if (holding.shares) {
      if (!holding.primaryLegs && holding.secondaryLegs) {
        if (holding.secondaryLegs[0].putCallInd === 'P') {
          return holding.secondaryLegs.reduce((acc, curr) => acc + curr.quantity, 0);
        }
      } else if (holding.primaryLegs && !holding.secondaryLegs) {
        if (holding.primaryLegs[0].putCallInd === 'P') {
          return holding.primaryLegs.reduce((acc, curr) => acc + curr.quantity, 0);
        }
      }
    }

    return 0;
  }

  async findCurrentPositions() {
    this.currentHoldings = [];
    this.setLoading(true);

    const data = await this.portfolioService.getTdPortfolio()
      .pipe(
        finalize(() => this.setLoading(false))
      ).toPromise();

    if (data) {
      for (const holding of data) {
        if (holding.instrument.assetType.toLowerCase() === 'option') {
          const symbol = holding.instrument.underlyingSymbol;
          const pl = holding.marketValue - (holding.averagePrice * holding.longQuantity) * 100;
          let found = false;
          this.currentHoldings = this.currentHoldings.map(holdingInfo => {
            if (holdingInfo.name === symbol) {
              found = true;
              if (!holdingInfo.primaryLegs) {
                holdingInfo.primaryLegs = [];
                holdingInfo.primaryLegs.push(this.createOptionObj(holding));
              } else {
                if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'c' &&
                  holding.instrument.putCall.toLowerCase() === 'call') {
                  holdingInfo.primaryLegs.push(this.createOptionObj(holding));
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'c' &&
                  holding.instrument.putCall.toLowerCase() === 'put') {
                  if (!holdingInfo.secondaryLegs) {
                    holdingInfo.secondaryLegs = [];
                  }
                  holdingInfo.secondaryLegs.push(this.createOptionObj(holding));
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'p' &&
                  holding.instrument.putCall.toLowerCase() === 'put') {
                  holdingInfo.primaryLegs.push(this.createOptionObj(holding));
                } else if (holdingInfo.primaryLegs[0].putCallInd.toLowerCase() === 'p' &&
                  holding.instrument.putCall.toLowerCase() === 'call') {
                  if (!holdingInfo.secondaryLegs) {
                    holdingInfo.secondaryLegs = [];
                  }
                  holdingInfo.secondaryLegs.push(this.createOptionObj(holding));
                }
              }

              holdingInfo.pl = holdingInfo.pl + (holding.marketValue - (holding.averagePrice * holding.longQuantity) * 100);
            }

            return holdingInfo;
          });
          if (!found) {
            const tempHoldingObj: PortfolioInfoHolding = {
              name: symbol,
              pl,
              netLiq: 0,
              shares: 0,
              alloc: 0,
              recommendation: null,
              buyReasons: '',
              sellReasons: '',
              buyConfidence: 0,
              sellConfidence: 0,
              prediction: null,
              primaryLegs: [this.createOptionObj(holding)]
            };
            this.currentHoldings.push(tempHoldingObj);
          }
        } else if (holding.instrument.assetType.toLowerCase() === 'equity' || holding.instrument.assetType === 'COLLECTIVE_INVESTMENT') {
          const symbol = holding.instrument.symbol;

          const pl = holding.marketValue - (holding.averagePrice * holding.longQuantity);

          const tempHoldingObj = {
            name: symbol,
            pl,
            netLiq: holding.marketValue,
            shares: holding.longQuantity,
            alloc: 0,
            recommendation: null,
            buyReasons: '',
            sellReasons: '',
            buyConfidence: 0,
            sellConfidence: 0,
            prediction: null
          };

          this.scoreKeeperService.addProfitLoss(tempHoldingObj.name, Number(tempHoldingObj.pl), false);
          this.currentHoldings.push(tempHoldingObj);
        }
      }
      //this.checkIfTooManyHoldings(this.currentHoldings);
    }
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
        if (this.isStrangle(holding)) {
          const { callsTotalPrice, putsTotalPrice } = await this.pricingService.getPricing(holding.primaryLegs, holding.secondaryLegs);
          if (putsTotalPrice > callsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml < 0.3) {
            this.sellStrangle(holding);
          } else if (callsTotalPrice > putsTotalPrice && backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7) {
            this.sellStrangle(holding);
          }
        } else if ((backtestResults && backtestResults.ml !== null && backtestResults.ml < 0.3) || holding.name === 'TQQQ') {
          console.log('Backtest indicates sell', backtestResults);
          this.portfolioSell(holding);
        } else if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7) {
          console.log('Backtest indicates buying', backtestResults);
          await this.addBuy(this.createHoldingObj(holding.name));
        } else {
          await this.createProtectivePutOrder(holding);
        }
      } catch (error) {
        console.log('Backtest error', error);
      }
    });
  }

  async createProtectivePutOrder(holding: PortfolioInfoHolding) {
    if (holding.shares) {
      let putsNeeded = 0;
      if ((holding.primaryLegs && !holding.secondaryLegs && holding.primaryLegs[0].putCallInd === 'P')) {
        putsNeeded = Math.floor((holding.shares / 100) - holding.primaryLegs.length) || 1;
      } else if (!holding.primaryLegs && holding.secondaryLegs && holding.secondaryLegs[0].putCallInd === 'P') {
        putsNeeded = Math.floor((holding.shares / 100) - holding.secondaryLegs.length) || 1;
      } else if (!holding.primaryLegs && !holding.secondaryLegs) {
        putsNeeded = Math.floor(holding.shares / 100);
      }

      putsNeeded -= this.protectivePutCount(holding);

      if (putsNeeded > 0) {
        const putOption = await this.strategyBuilderService.getProtectivePut(holding.name);
        const estimatedPrice = this.strategyBuilderService.findOptionsPrice(putOption.put.bid, putOption.put.ask);

        if ((estimatedPrice * 100) > 100) {
          console.log('addProtectivePutOrder', holding.name, putOption, estimatedPrice);
          this.cartService.addProtectivePutOrder(holding.name, [putOption.put], estimatedPrice, putsNeeded);
        } else {
          console.log('Protective put option too cheap.', holding.name, estimatedPrice);
        }
      }
    }
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
      if (prediction > 0.7) {
        console.log('trim holdings prediction', prediction);

        await this.addBuy(stock);
        const log = `Adding swing trade ${stock.name}`;
        this.reportingService.addAuditLog(null, log);
      } else if (prediction < 0.4) {
        const sellHolding = this.currentHoldings.find(holdingInfo => {
          return holdingInfo.name === stock.name;
        });
        if (sellHolding) {
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

  async enterSellOptionOrder(holding: PortfolioInfoHolding) {
    // this.backtestService.getLastPriceTiingo({ symbol: holding.primaryLegSymbol })
    //   .subscribe(tiingoQuote => {
    //     const lastPrice = tiingoQuote[holding.primaryLegSymbol].quote.lastPrice;
    //     this.strategyBuilderService.addOptionOrder(holding.name, holding.primaryLegSymbol, 'P', lastPrice, holding.shares, 'Sell');
    //   });
  }

  async buildBuyOrder(holding: PortfolioInfoHolding,
    allocation: number,
    profitThreshold: number = null,
    stopLossThreshold: number = null,
    useCashBalance = true) {
    const price = await this.portfolioService.getPrice(holding.name).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const quantity = this.getQuantity(price, allocation, useCashBalance ? balance.cashBalance : balance.availableFunds);
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
    this.findPatternService.developStrategy();
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


  async buyAtClose() {
    if (this.boughtAtClose) {
      return;
    }
    const trainingResult = await this.aiPicksService.trainAndActivate('TQQQ');

    console.log('buy at close training results', trainingResult);
    if (trainingResult) {
      this.boughtAtClose = true;
      const stock: PortfolioInfoHolding = {
        name: 'TQQQ',
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
      const order = await this.buildBuyOrder(stock, trainingResult.value, null, null, true);
      this.daytradeService.sendBuy(order, 'limit', () => { }, () => { });
      console.log('buy at close', order);
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
      if (this.isStrangle(holding)) {
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
              const price = await this.backtestService.getLastPriceTiingo({ symbol: fullOrderList[i].symbol }).toPromise();

              const askPrice = price[fullOrderList[i].symbol].quote.askPrice;
              const bidPrice = price[fullOrderList[i].symbol].quote.bidPrice;

              const estimatedPrice = this.strategyBuilderService.findOptionsPrice(bidPrice, askPrice);
              fullPrice += estimatedPrice;
            }

            this.cartService.addSellStrangleOrder(holding.name, holding.primaryLegs, holding.secondaryLegs, fullPrice, holding.primaryLegs[0].quantity);
          }
        }
      }
    });
  }

  async sellStrangle(holding: PortfolioInfoHolding) {
    if (this.isStrangle(holding)) {
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
            const price = await this.backtestService.getLastPriceTiingo({ symbol: fullOrderList[i].symbol }).toPromise();

            const askPrice = price[fullOrderList[i].symbol].quote.askPrice;
            const bidPrice = price[fullOrderList[i].symbol].quote.bidPrice;

            const estimatedPrice = this.strategyBuilderService.findOptionsPrice(bidPrice, askPrice);
            fullPrice += estimatedPrice;
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
    await this.findCurrentPositions();
    this.currentHoldings.forEach(async (holding) => {
      if (!this.isStrangle(holding)) {
        await this.createProtectivePutOrder(holding);
      }
    });
  }

  testTrading() {
    this.dialogService.open(SimulationChartComponent, {
      header: 'Simulation',
      contentStyle: { 'overflow-y': 'unset' },
      width: '100vw',
      height: '100vh',
      data: {
        symbol: 'META'
      }
    });
    // this.portfolioService.getIntradayPriceHistoryQuotes('MSFT').subscribe(data => {
    //   console.log('getIntradayPriceHistoryQuotes', data);
    //   this.backtestService.getDaytradeIndicators(data.candles, 80).subscribe(data => {
    //     console.log('daytrade indicators', data);
    //     this.backtestService.getDaytradeRecommendationFn('MSFT', null, null, { minQuotes: 80 }, data[data.length - 1])
    //       .subscribe(data => console.log('recommendation', data));
    //   });
    // });

    // this.backtestService.getDaytradeRecommendation('SPY', null, null, { minQuotes: 81 }).subscribe(data => console.log('getDaytradeRecommendation', data));
    // this.machineLearningService
    // .trainDaytrade('SPY',
    //   moment().add({ days: 1 }).format('YYYY-MM-DD'),
    //   moment().subtract({ days: 1 }).format('YYYY-MM-DD'),
    //   1,
    //   this.globalSettingsService.daytradeAlgo
    // ).subscribe(data => {
    //   console.log('ml daytrade data', data);
    // });
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
