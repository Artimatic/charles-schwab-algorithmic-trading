import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment-timezone';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { SmartOrder } from '@shared/index';
import { Options } from '@shared/models/options';
import { OrderTypes } from '@shared/models/smart-order';
import { Trade } from '@shared/models/trade';
import { BacktestService, CartService, DaytradeService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { AiPicksPredictionData, AiPicksService } from '@shared/services/ai-picks.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { divide, round } from 'lodash';
import { MenuItem, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, Subscription } from 'rxjs';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { take, takeUntil } from 'rxjs/operators';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PortfolioMgmtService } from '../portfolio-mgmt/portfolio-mgmt.service';
import { PricingService } from '../pricing/pricing.service';
import { PersonalBearishPicks } from '../rh-table/backtest-stocks.constant';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { PriceTargetService } from './price-target.service';
import { SchedulerService } from '@shared/service/scheduler.service';
import { AlgoEvaluationService } from '../algo-evaluation/algo-evaluation.service';
import { AutopilotService, RiskTolerance } from './autopilot.service';
import { BacktestAggregatorService } from '../backtest-table/backtest-aggregator.service';

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

export enum SwingtradeAlgorithms {
  demark9 = 'demark',
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
  SellMfi = 'Buy by mfi sell signal',
  BuyBband = 'Buy by bband buy signal',
  SellBband = 'Buy by bband sell signal',
  InverseDispersion = 'Inverse dispersion trade',
  InverseStrategies = 'Inverse',
  PerfectPair = 'Perfect Pair',
  AnyPair = 'Any Pair',
  UPRO = 'Buy UPRO',
  None = 'None'
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
  maxTradeCount = 10;
  maxHoldings = 100;
  addedOrdersCount = 0;
  developedStrategy = false;
  tradingPairsCounter = 0;
  strategyList = [
    Strategy.Default,
    Strategy.Swingtrade,
    Strategy.InverseDispersion,
    // Strategy.SellMfiTrade,
    // Strategy.SingleStockPick,
    // Strategy.StateMachine,
    // Strategy.InverseSwingtrade,
    //Strategy.DaytradeShort,
    Strategy.BuyML,
    Strategy.MLPairs,
    Strategy.SellMfi,
    Strategy.BuyCalls,
    Strategy.BuyBband,
    // Strategy.Daytrade,
    Strategy.BuyMfiDiv,
    Strategy.TrimHoldings,
    Strategy.VolatilityPairs,
    Strategy.BuySnP,
    Strategy.BuyWinners,
    Strategy.BuyMfiTrade,
    // Strategy.DaytradeFullList,
    // Strategy.InverseStrategies,
    // Strategy.SellMfiDiv,
    Strategy.BuyMfi,
    Strategy.Short,
    Strategy.TradingPairs,
    Strategy.SellBband,
    Strategy.PerfectPair,
    Strategy.AnyPair
    //Strategy.None
  ];

  bearishStrategy = [
    Strategy.MLSpy,
    Strategy.TrimHoldings,
    Strategy.DaytradeShort,
    Strategy.Short
  ];

  dayTradeRiskCounter = 0;

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
  lastCredentialCheck;

  revealPotentialStrategy = false;

  strategies: PotentialTrade[] = [];

  dialogRef: DynamicDialogRef | undefined;

  lastReceivedRecommendation = null;
  boughtAtClose = false;
  multibuttonOptions: MenuItem[];
  startButtonOptions: MenuItem[];
  tradingPairs: SmartOrder[][] = [];
  manualStart = false;
  daytradeMode = false;
  isLive = false;
  tradeObserverSub;

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
    private priceTargetService: PriceTargetService,
    private schedulerService: SchedulerService,
    private algoEvaluationService: AlgoEvaluationService,
    public autopilotService: AutopilotService,
    private backtestAggregatorService: BacktestAggregatorService
  ) { }

  ngOnInit(): void {
    const lastStrategy = JSON.parse(localStorage.getItem('profitLoss'));
    if (lastStrategy && lastStrategy.lastStrategy) {
      const lastStrategyCount = this.strategyList.findIndex(strat => strat.toLowerCase() === lastStrategy.lastStrategy.toLowerCase());
      this.strategyCounter = lastStrategyCount >= 0 ? lastStrategyCount : 0;
      this.autopilotService.riskCounter = lastStrategy.lastRiskTolerance || 0;
      console.log('Previous profit loss', lastStrategy);
    } else {
      this.strategyCounter = 0;
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
        }
      }
    ];

    this.multibuttonOptions = [
      {
        label: 'Backtest',
        command: () => {
          this.algoEvaluationService.openDialog();
        }
      },
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
        label: 'Test profit target',
        command: async () => {
          await this.priceTargetService.checkProfitTarget(this.currentHoldings);
        }
      },
      {
        label: 'Test backtest',
        command: async () => {
          await this.backtestOneStock(true, false);
        }
      },
      {
        label: 'Test filter',
        command: async () => {
          const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
          const backtestResults = [];
          if (savedBacktest) {
            for (const saved in savedBacktest) {
              const backtestObj = savedBacktest[saved];
              backtestObj.pnl = this.priceTargetService.getDiff(backtestObj.invested, backtestObj.invested + backtestObj.net);
              backtestResults.push(backtestObj);
            }
            backtestResults?.sort((a, b) => a.pnl - b.pnl);
          }
          const list = backtestResults?.filter(backtestData => backtestData?.ml > 0.5);
          console.log('list', list);
        }
      },
      {
        label: 'Test vol',
        command: async () => {
          this.machineLearningService.trainVolatility(moment().format('YYYY-MM-DD'),
            moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.6, 5, 0).subscribe((result) => {
              console.log(result[0].predictionHistory.filter(r => r.prediction >= 0.5));
            });
        }
      },
      {
        label: 'Test api',
        command: async () => {
          this.machineLearningService.trainVolatility(moment().format('YYYY-MM-DD'),
            moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.6, 5, 0).subscribe((result) => {
              console.log(result[0].predictionHistory.filter(r => r.prediction >= 0.5));
            });
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
        if (!this.lastCredentialCheck || Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 25) {
          await this.autopilotService.isMarketOpened().toPromise();
          this.lastCredentialCheck = moment();
          await this.backtestOneStock(true, false);
          if (!this.schedulerService.executeTask()) {
            this.padOrders();
          }
        } else if (moment().isAfter(moment(this.autopilotService.sessionEnd).subtract(7, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd))) {
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
              this.boughtAtClose = false;
            }, 1200000);
          }

          this.boughtAtClose = true;
        } else if (moment().isAfter(moment(this.autopilotService.sessionStart)) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd))) {
          this.handleIntraday();
        } else if (moment().isAfter(moment(this.autopilotService.sessionStart).subtract(Math.floor(this.interval / 60000) * 2, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionStart))) {
          this.machineLearningService.trainVolatility(moment().format('YYYY-MM-DD'),
            moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.6, 5, 0).subscribe((result) => {
              this.autopilotService.setVolatilityMl(result[0].nextOutput);
            });
        } else {
          await this.backtestOneStock(false, false);
          if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 3) {
            this.startFindingTrades();
            this.padOrders();
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
    this.lastOrderListIndex = 0;
    this.cartService.removeCompletedOrders();
    this.cartService.otherOrders = [];
    this.developedStrategy = false;
  }

  decreaseRiskTolerance() {
    this.autopilotService.riskCounter = 0;
    const msg = `Decrease risk to ${this.autopilotService.riskToleranceList[this.autopilotService.riskCounter]}`;
    console.log(msg);
    this.reportingService.addAuditLog(this.strategyList[this.strategyCounter], msg);
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
    this.reportingService.addAuditLog(this.strategyList[this.strategyCounter], msg);
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
      lastStrategy: this.strategyList[this.strategyCounter],
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
    if (this.strategyCounter < this.strategyList.length - 1) {
      this.strategyCounter++;
    } else {
      this.strategyCounter = 0;
    }
    const strat = this.strategyList[this.strategyCounter];
    const msg = `Strategy changed to ${strat}. Risk tolerance ${this.autopilotService.riskCounter}`;
    this.messageService.add({
      severity: 'info',
      summary: msg
    });

    console.log(msg);
    this.reportingService.addAuditLog(null, msg);

    if (this.strategyList[this.strategyCounter] === 'Daytrade') {
      this.daytradeMode = true;
    }

    if (saveOption) {
      this.saveRisk();
    }
  }

  async developStrategy() {
    console.log('developing strategy', moment().format('HH:mm YYYY-MM-DD'));
    console.log(this.backtestAggregatorService.getTimeLine());
    this.backtestAggregatorService.clearTimeLine();
    if (this.manualStart) {
      return;
    }
    const vol = await this.machineLearningService.trainVolatility(moment().format('YYYY-MM-DD'),
      moment().subtract({ day: 600 }).format('YYYY-MM-DD'), 0.6, 5, 0).toPromise();
    if (vol[0].nextOutput < 0.3) {
      await this.autopilotService.findTopBuy(this.maxTradeCount);
    }
    this.developedStrategy = true;

    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    this.currentHoldings = await this.cartService.findCurrentPositions();

    await this.modifyCurrentHoldings();
    await this.checkPersonalLists();
    const balance = await this.machineDaytradingService.getPortfolioBalance().toPromise();
    if (balance.liquidationValue < 26000) {
      await this.autopilotService.getNewTrades(null, null, this.currentHoldings);
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
    await this.autopilotService.getNewTrades(buyStrangleCb, null, this.currentHoldings);
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

  async backtestOneStock(overwrite = false, addTrade = true) {
    try {
      let stock = this.machineDaytradingService.getNextStock();
      while (Boolean(this.currentHoldings.find((value) => value.name === stock))) {
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
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.maxTradeCount) {
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
    this.currentHoldings.forEach(async (holding) => {
      await this.checkStopLoss(holding);
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
            //this.optionsOrderBuilderService.hedgeTrade(holding.name, this.currentHoldings);
          }
        } else if ((backtestResults && (backtestResults.net < 0 || backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL' || holding.name === 'TQQQ'))) {
          console.log('Backtest indicates sell', backtestResults);
          await this.cartService.portfolioSell(holding, 'Backtest indicates sell');
        } else if (backtestResults && backtestResults.ml !== null && backtestResults.ml > 0.7 && (backtestResults.recommendation === 'STRONGBUY' || backtestResults.recommendation === 'BUY')) {
          console.log('Backtest indicates buying', backtestResults);
          await this.autopilotService.addBuy(this.createHoldingObj(holding.name), RiskTolerance.Zero, 'Backtest indicates buying');
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

  async checkStopLoss(holding: PortfolioInfoHolding, stopLoss = -0.045, profitTarget = 0.01) {
    const pnl = holding.pnlPercentage;
    const backtestResults = await this.strategyBuilderService.getBacktestData(holding.name);
    const price = await this.backtestService.getLastPriceTiingo({ symbol: holding.name }).toPromise();
    const lastPrice = price[holding.name].quote.lastPrice;

    const isOptionOnly = holding.primaryLegs && !holding.shares;
    if (backtestResults.averageMove) {
      if (isOptionOnly) {
        stopLoss = (backtestResults.averageMove / lastPrice) * -12;
        this.reportingService.addAuditLog(holding.name, `Setting options stop loss to ${stopLoss}`);
        profitTarget = (backtestResults.averageMove / lastPrice) * 15;
        this.reportingService.addAuditLog(holding.name, `Setting options profit target to ${profitTarget}`);
      } else {
        stopLoss = (backtestResults.averageMove / lastPrice) * -3;
        this.reportingService.addAuditLog(holding.name, `Setting stock stop loss to ${stopLoss}`);
        profitTarget = (backtestResults.averageMove / lastPrice) * 5;
        this.reportingService.addAuditLog(holding.name, `Setting stock profit target to ${profitTarget}`);
      }
      if (pnl < stopLoss) {
        if (isOptionOnly) {
          await this.autopilotService.sellOptionsHolding(holding, `Options stop loss reached ${pnl}`);
        } else {
          await this.cartService.portfolioSell(holding, `Stop loss met ${pnl}`);
        }
      } else if (pnl > profitTarget) {
        if (isOptionOnly) {
          await this.autopilotService.sellOptionsHolding(holding, `Options price target reached ${pnl}`);
        } else {
          await this.cartService.portfolioSell(holding, `Price target met ${pnl}`);
        }
      } else if (pnl > -0.01 && pnl < profitTarget * 0.1) {
        if (!isOptionOnly) {
          await this.autopilotService.addBuy(holding, null, 'Profit loss is positive');
        }
      }
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

  async modifyStrategy() {
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
        this.reportingService.addAuditLog(this.strategyList[this.strategyCounter], lastProfitMsg);

        const metTarget = await this.priceTargetService.checkProfitTarget(this.currentHoldings, -0.005);
        console.log('Met target', metTarget);
        if (profit > 0) {
          this.increaseDayTradeRiskTolerance();
        } else if (profit < 0 || !metTarget) {
          this.decreaseDayTradeRiskTolerance();
          this.increaseRiskTolerance();
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

  async checkIfOverBalance(balance = null) {
    if (!balance) {
      balance = await this.portfolioService.getTdBalance().toPromise();
    }
    const isOverBalance = Boolean(Number(balance.cashBalance) < 0);
    if (isOverBalance) {
      this.currentHoldings = await this.cartService.findCurrentPositions();
      await this.autopilotService.checkIfTooManyHoldings(this.currentHoldings, 10);
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
    const overBalance = await this.checkIfOverBalance();
    if (this.boughtAtClose || this.manualStart || overBalance) {
      return;
    }

    this.boughtAtClose = true;

    const backtestData = await this.strategyBuilderService.getBacktestData('SPY');

    const buySymbol = 'UPRO';

    const price = await this.portfolioService.getPrice(buySymbol).toPromise();
    const balance = await this.portfolioService.getTdBalance().toPromise();
    const allocation = backtestData.ml > 0 ? backtestData.ml : 0.01;
    this.autopilotService.setLastSpyMl(backtestData.ml);
    const cash = (balance.cashBalance < balance.availableFunds * 0.01) ? balance.cashBalance : (balance.cashBalance * this.autopilotService.riskToleranceList[this.autopilotService.riskCounter] * allocation);
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
          this.messageService.add({ severity: 'success', summary: 'Buy alert', detail: msg, life: 21600000 });
          console.log(msg);
          await this.autopilotService.addBuy(stock, null, 'Personal list buy');
        }
      } catch (error) {
        console.log(error);
      }
    });

    PersonalBearishPicks.forEach(async (stock) => {
      const name = stock.ticker;
      try {
        const backtestResults = await this.strategyBuilderService.getBacktestData(name);
        if (backtestResults && backtestResults.sellMl !== null && (backtestResults.sellMl > 0.6 && (backtestResults.recommendation === 'STRONGSELL' || backtestResults.recommendation === 'SELL'))) {
          const msg = `Sell ${name}, date: ${moment().format()}`;
          this.messageService.add({ severity: 'error', summary: 'Sell alert', detail: msg, life: 21600000 });
          console.log(msg);
          const cash = await this.getMinMaxCashForOptions();

          this.optionsOrderBuilderService.balanceTrades(this.currentHoldings, ['SPY'], [name], cash.minCash, cash.maxCash, 'Bearish pick');
        }
      } catch (error) {
        console.log(error);
      }
    });
  }

  async hedge() {
    await this.portfolioMgmtService.hedge(this.currentHoldings, this.optionsOrderBuilderService.getTradingPairs(), this.autopilotService.riskToleranceList[1], this.autopilotService.riskToleranceList[this.autopilotService.riskCounter]);
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

          this.cartService.addSingleLegOptionOrder(holding.name, [holding.primaryLegs[0]],
            estPrice, holding.primaryLegs[0].quantity,
            orderType, 'Sell', 'Manual command to sell all options');
        }
      }
    });
  }

  async handleStrategy() {
    switch (this.strategyList[this.strategyCounter]) {
      case Strategy.TradingPairs:
        await this.createTradingPairs();
        break;
      case Strategy.Swingtrade:
        await this.autopilotService.getNewTrades(null, null, this.currentHoldings);
        break;
      case Strategy.TrimHoldings:
        await this.autopilotService.sellLoser(this.currentHoldings);
        break;
      case Strategy.Short:
        await this.buyCallsOrPuts('puts');
        break;
      case Strategy.BuyCalls:
        await this.buyCallsOrPuts('calls');
        break;
      case Strategy.BuySnP:
        await this.autopilotService.buyUpro();

        // const balance = await this.portfolioService.getTdBalance().toPromise();
        // const maxCash = round(this.autopilotService.riskToleranceList[0] * balance.cashBalance);
        // await this.strategyBuilderService.buySnP(maxCash, balance.cashBalance);
        await this.autopilotService.getNewTrades(null, null, this.currentHoldings);
        break;
      case Strategy.InverseDispersion:
        await this.addInverseDispersionTrade();
        break;
      case Strategy.BuyWinners:
        await this.buyWinners();
        break;
      case Strategy.PerfectPair:
        await this.autopilotService.addPerfectPair(this.currentHoldings);
        break;
      case Strategy.AnyPair:
        await this.autopilotService.addAnyPair(this.currentHoldings);
        break;
      case Strategy.BuyML:
        await this.buyByMLSignal();
        break;
      case Strategy.MLPairs:
        await this.autopilotService.addMLPairs(this.currentHoldings);
        await this.autopilotService.addMLPairs(this.currentHoldings, false);
        break;
      case Strategy.VolatilityPairs:
        await this.autopilotService.addVolatilityPairs(this.currentHoldings);
        break;
      case Strategy.SellMfiTrade:
        await this.buyByIndicator(SwingtradeAlgorithms.mfiTrade, 'sell');
        break;
      case Strategy.SellMfiDiv:
        await this.buyByIndicator(SwingtradeAlgorithms.mfiDivergence, 'sell');
        break;
      case Strategy.BuyMfiTrade:
        await this.buyByIndicator(SwingtradeAlgorithms.mfiTrade, 'buy');
        break;
      case Strategy.BuyMfiDiv:
        await this.buyByIndicator(SwingtradeAlgorithms.mfiDivergence, 'buy');
        break;
      case Strategy.SellMfi:
        await this.buyByIndicator(SwingtradeAlgorithms.mfi, 'sell');
        break;
      case Strategy.SellBband:
        await this.buyByIndicator(SwingtradeAlgorithms.bband, 'sell');
        break;
        break;
      case Strategy.BuyMfi:
        await this.buyByIndicator(SwingtradeAlgorithms.mfi, 'buy');
        break;
        break;
      case Strategy.BuyBband:
        await this.buyByIndicator(SwingtradeAlgorithms.bband, 'buy');
        break;
      case Strategy.InverseStrategies:
        await this.inverseStrategies();
        break;
      case Strategy.UPRO:
        await this.autopilotService.buyUpro();
        break;
      default: {
        await this.autopilotService.findTopBuy();
        await this.autopilotService.findTopNotSell();
        await this.createTradingPairs();
        await this.addInverseDispersionTrade();
        const cash = await this.getMinMaxCashForOptions();
        await this.autopilotService.findAnyPair(this.currentHoldings, cash.minCash, cash.maxCash);
        break;
      }
    }
  }

  async inverseStrategies() {
    const inverse = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction > 0.8 && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
        const cash = await this.getMinMaxCashForOptions();

        await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings, ['SPY'], [symbol], cash.minCash, cash.maxCash, 'Inverse strategies');
      } else if ((prediction < 0.4 || prediction === null) && (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY')) {
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
        await this.autopilotService.addBuy(stock, null, 'Inverse strategy buy');
      }
    };
    await this.autopilotService.getNewTrades(inverse, null, this.currentHoldings);
  }

  async buyByMLSignal() {
    const buyWinner = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction > 0.8 && this.priceTargetService.isProfitable(backtestData.invested, backtestData.net)) {
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
        await this.autopilotService.addBuy(stock, null, 'ml signal');
      }
    };
    await this.autopilotService.getNewTrades(buyWinner, null, this.currentHoldings);
  }

  async buyByIndicator(indicator: SwingtradeAlgorithms, direction: 'buy' | 'sell') {
    this.optionsOrderBuilderService.resetCurrentTradeIdeas();
    const buyIndicator = async (symbol: string, prediction: number, backtestData: any) => {
      let matchBuy = false;
      if (direction === 'buy') {
        matchBuy = backtestData.buySignals && backtestData.buySignals.find(sig => sig === indicator);
      } else {
        matchBuy = backtestData.sellSignals && backtestData.sellSignals.find(sig => sig === indicator);
      }

      if (matchBuy && prediction > 0.6 && this.priceTargetService.isProfitable(backtestData.invested, backtestData.net)) {
        if (this.optionsOrderBuilderService.currentTradeIdeas.puts.length) {
          const cash = await this.getMinMaxCashForOptions();
          await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings,
            [symbol], this.optionsOrderBuilderService.getSellList(),
            cash.minCash, cash.maxCash, `${direction} ${indicator}`);
        } else {
          this.optionsOrderBuilderService.currentTradeIdeas.calls.push(symbol);
        }
      } else if (matchBuy && prediction < 0.4 && this.priceTargetService.notProfitable(backtestData.invested, backtestData.net)) {
        if (this.optionsOrderBuilderService.currentTradeIdeas.calls.length) {
          const cash = await this.getMinMaxCashForOptions();
          await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings,
            this.optionsOrderBuilderService.getBuyList(), [symbol],
            cash.minCash, cash.maxCash, `${direction} ${indicator}`);
        } else {
          this.optionsOrderBuilderService.currentTradeIdeas.puts.push(symbol);
        }
      }
    };
    await this.autopilotService.getNewTrades(buyIndicator, null, this.currentHoldings);
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
    await this.autopilotService.getNewTrades(buyWinner, null, this.currentHoldings);
  }

  async getMinMaxCashForOptions() {
    const cash = await this.cartService.getAvailableFunds(false);
    const maxCash = round(this.autopilotService.riskToleranceList[this.autopilotService.riskCounter] * cash, 2);
    const minCash = maxCash - 1000;
    return {
      maxCash,
      minCash
    };
  }

  async createTradingPairs() {
    const cash = await this.getMinMaxCashForOptions();
    await this.optionsOrderBuilderService.createTradingPair(this.currentHoldings, cash.minCash, cash.maxCash);
  }

  async buyCallsOrPuts(optionsType = 'calls') {
    const findCalls = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction > 0.7 &&
        (backtestData.recommendation === 'STRONGBUY' || backtestData.recommendation === 'BUY') &&
        (this.priceTargetService.isProfitable(backtestData.invested, backtestData.net))) {
        const cash = await this.getMinMaxCashForOptions();

        const option = await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings,
          [symbol], [symbol], cash.minCash, cash.maxCash, `Buy ${optionsType}`);
        this.optionsOrderBuilderService.addTradingPairs([option[0]]);
      }
    };

    const findPuts = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction < 0.3 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
        const cash = await this.getMinMaxCashForOptions();

        const option = await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings,
          [symbol], [symbol], cash.minCash, cash.maxCash, 'Buy puts');
        this.optionsOrderBuilderService.addTradingPairs([option[0]]);
      }
    };
    await this.autopilotService.getNewTrades(optionsType === 'calls' ? findCalls : findPuts, null, this.currentHoldings);
  }

  async addInverseDispersionTrade() {
    const findPuts = async (symbol: string, prediction: number, backtestData: any) => {
      if (prediction < 0.5 && (backtestData.recommendation === 'STRONGSELL' || backtestData.recommendation === 'SELL')) {
        const cash = await this.getMinMaxCashForOptions();
        await this.optionsOrderBuilderService.balanceTrades(this.currentHoldings,
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
    await this.autopilotService.getNewTrades(findPuts, null, this.currentHoldings);
  }

  async padOrders() {
    if (!this.autopilotService.hasReachedBuyLimit(this.autopilotService.addedOrdersCount)) {
      this.changeStrategy();
      await this.developStrategy();
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
    this.autopilotService.isMarketOpened().subscribe(async (isOpen) => {
      if (isOpen) {
        if (!this.lastOptionsCheckCheck || Math.abs(moment().diff(this.lastOptionsCheckCheck, 'minutes')) > 15) {
          this.lastOptionsCheckCheck = moment();
          const balance = await this.portfolioService.getTdBalance().toPromise();

          this.currentHoldings = await this.cartService.findCurrentPositions();
          await this.optionsOrderBuilderService.checkCurrentOptions(this.currentHoldings);
          const metTarget = await this.priceTargetService.checkProfitTarget(this.currentHoldings);
          if (metTarget) {
            this.decreaseRiskTolerance();
          }
          await this.checkIfOverBalance(balance);
          await this.autopilotService.balanceCallPutRatio(this.currentHoldings);
          await this.autopilotService.checkIntradayStrategies();
          this.hedge();
        } else {
          this.executeOrderList();
          if (this.strategyList[this.strategyCounter] === Strategy.Daytrade &&
            (this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length) < this.maxTradeCount && (!this.lastReceivedRecommendation || Math.abs(this.lastReceivedRecommendation.diff(moment(), 'minutes')) > 5)) {
            this.triggerDaytradeRefresh();
          }
        }
      } else {
        await this.backtestOneStock(false, false);
      }
    });
  }

  async placeInverseDispersionOrders() {
    await this.addInverseDispersionTrade();
    this.addTradingPairOrders();
  }

  async placePairOrders() {
    const cash = await this.getMinMaxCashForOptions();

    await this.optionsOrderBuilderService.createTradingPair(this.currentHoldings, cash.minCash, cash.maxCash);
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
    this.currentHoldings = await this.cartService.findCurrentPositions();
    await this.modifyCurrentHoldings();
    console.log(this.currentHoldings);
    await this.orderHandlingService.intradayStep('SPY');
  }

  ngOnDestroy() {
    this.cleanUp();
  }
}
