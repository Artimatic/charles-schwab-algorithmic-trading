import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment-timezone';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { SmartOrder } from '@shared/index';
import { Options } from '@shared/models/options';
import { OrderTypes } from '@shared/models/smart-order';
import { Trade } from '@shared/models/trade';
import { CartService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { AiPicksPredictionData, AiPicksService } from '@shared/services/ai-picks.service';
import { ScoringIndex } from '@shared/services/score-keeper.service';
import { divide, round } from 'lodash';
import { MenuItem, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, Subscription } from 'rxjs';
import { TimerObservable } from 'rxjs-compat/observable/TimerObservable';
import { takeUntil } from 'rxjs/operators';
import { PotentialTrade } from '../backtest-table/potential-trade.constant';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PricingService } from '../pricing/pricing.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { PriceTargetService } from './price-target.service';
import { AutopilotService, RiskTolerance } from './autopilot.service';
import { BacktestAggregatorService } from '../backtest-table/backtest-aggregator.service';
import { OrderingService } from '@shared/ordering.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';
import { OrderType } from '@shared/stock-backtest.interface';

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

@Component({
  selector: 'app-autopilot',
  templateUrl: './autopilot.component.html',
  styleUrls: ['./autopilot.component.scss']
})
export class AutopilotComponent implements OnInit, OnDestroy {
  display = false;
  isLoading = true;
  defaultInterval = 160000;
  interval = 160000;
  oneDayInterval;
  timer: Subscription;
  alive = false;
  destroy$ = new Subject();
  maxHoldings = 100;
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
  otherOptions: MenuItem[];
  startButtonOptions: MenuItem[];
  tradingPairs: SmartOrder[][] = [];
  manualStart = false;
  daytradeMode = false;
  isLive = false;
  tradeObserverSub;
  lastProfitCheck = moment();

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
    public priceTargetService: PriceTargetService,
    public autopilotService: AutopilotService,
    private backtestAggregatorService: BacktestAggregatorService,
    private aiPicksService: AiPicksService,
    private orderingService: OrderingService,
    private newStockFinderService: NewStockFinderService
  ) { }

  ngOnInit(): void {
    this.autopilotService.checkCredentials();
    this.autopilotService.setPreferencesFromDB();
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
          await this.startInterval();
          this.interval = this.defaultInterval;
          this.messageService.add({
            severity: 'success',
            summary: 'Trading started'
          });
          this.newStockFinderService.addOldList();
        }
      }
    ];

    this.otherOptions = [
      {
        label: 'Update stock list',
        command: () => this.updateStockList()
      },
      {
        label: 'Change strategy',
        command: () => this.changeStrategy(true)
      },
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
        label: 'Test handle strategy',
        command: async () => {
          await this.autopilotService.handleStrategy();
        }
      },
      {
        label: 'Test add options strategies',
        command: async () => {
          await this.optionsOrderBuilderService.addOptionsStrategiesToCart();
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
          const buys = this.autopilotService.getBuyList()
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

  async startInterval() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
    await this.setupStrategy();
    await this.autopilotService.handleStrategy();
    this.timer = TimerObservable.create(1000, this.interval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        if (!this.lastCredentialCheck || Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 25) {
          await this.autopilotService.isMarketOpened().toPromise();
          this.lastCredentialCheck = moment();
          await this.backtestOneStock(true, false);
        } else if (moment().isAfter(moment(this.autopilotService.sessionEnd).subtract(25, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd).subtract(20, 'minutes'))) {
          console.log('Buy on close');
          if (!this.boughtAtClose) {
            await this.buySellAtCloseOrOpen();
          }

          this.boughtAtClose = true;
        } else if (moment().isAfter(moment(this.autopilotService.sessionEnd)) &&
          moment().isBefore(moment(this.autopilotService.sessionEnd).add(5, 'minute'))) {
          if (this.reportingService.logs.length > 6) {
            const profitLog = `Profit ${this.scoreKeeperService.total}`;
            this.reportingService.addAuditLog(null, profitLog);
            this.reportingService.exportAuditHistory();
            await this.setProfitLoss();
            this.scoreKeeperService.resetTotal();
            this.resetCart();
            setTimeout(() => {
              this.autopilotService.handleStrategy();
            }, 10800000);
          }
        } else if (this.autopilotService.handleIntraday()) {
          if (moment().diff(this.lastProfitCheck, 'minutes') > 5) {
            this.lastProfitCheck = moment();
            const metTarget = await this.priceTargetService.checkProfitTarget(this.autopilotService.currentHoldings);
            if (metTarget) {
              this.decreaseRiskTolerance();
            }
            await this.padOrders();
          }
        } else if (!this.developedStrategy && moment().isAfter(moment(this.autopilotService.sessionStart).subtract(this.interval * 2, 'minutes')) &&
          moment().isBefore(moment(this.autopilotService.sessionStart))) {
          await this.setupStrategy();
        } else {
          if (Math.abs(this.lastCredentialCheck.diff(moment(), 'minutes')) > 50) {
            this.aiPicksService.mlNeutralResults.next(null);
          }
          await this.backtestOneStock(false, false);
          // await this.newStockFinderService.processOneStock();
        }
      });
  }

  private async padOrders() {
    if ((this.cartService.getSellOrders().length + this.cartService.getBuyOrders().length) < 1 + ((1 - this.autopilotService.getVolatilityMl()) * 5)) {
      this.changeStrategy();
      await this.autopilotService.handleStrategy();
    }
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

  async setProfitLoss() {
    await this.modifyRisk();

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
      const accountId = sessionStorage.getItem('accountId');
      this.portfolioService.updatePortfolioProfitLoss(accountId || null, profitObj.date,
        profitObj.lastRiskTolerance,
        profitObj.lastStrategy,
        profitObj.profit).subscribe();
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

    this.reportingService.addAuditLog(null, msg);

    if (this.autopilotService.strategyList[this.autopilotService.strategyCounter] === 'Daytrade') {
      this.daytradeMode = true;
    }

    if (saveOption) {
      this.saveRisk();
    }
  }

  async setupStrategy() {
    console.log('Setting up strategy')
    this.developedStrategy = true;

    const backtestData = await this.strategyBuilderService.getBacktestData('SPY');

    this.autopilotService.setLastSpyMl(backtestData.ml);
    this.autopilotService.updateVolatility();
    await this.priceTargetService.setTargetDiff();
    this.backtestAggregatorService.clearTimeLine();

    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));

    this.autopilotService.currentHoldings = await this.cartService.findCurrentPositions();

    await this.modifyCurrentHoldings();
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
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.cartService.maxTradeCount) {
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
    this.autopilotService.strategies = this.autopilotService.strategies.filter(s => s.key !== item.key || s.name !== item.name || s.date !== item.date);
    this.strategyBuilderService.removeTradingStrategy(item);
  }

  addOptions() {
    this.dialogService.open(AddOptionsTradeComponent, {
      header: 'Add options trade',
      contentStyle: { 'overflow-y': 'unset' }
    });
  }

  async modifyRisk() {
    const metTarget = await this.priceTargetService.hasMetPriceTarget(0);
    if (!metTarget) {
      this.decreaseDayTradeRiskTolerance();
      this.increaseRiskTolerance();
    } else {
      this.increaseDayTradeRiskTolerance();
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

    this.autopilotService.setLastSpyMl(backtestData.ml);
    // await this.autopilotService.buyRightAway(buySymbol, backtestData.ml);
  }

  updateStockList() {
    this.dialogService.open(StockListDialogComponent, {
      header: 'Stock list',
      contentStyle: { 'overflow-y': 'auto' }
    });
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
    return this.cartService.otherOrders.length + this.cartService.buyOrders.length + this.cartService.sellOrders.length < this.cartService.maxTradeCount;
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

  async testPut() {
    const sell = 'WMT';
    const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
    const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
    const currentPut = {
      put: bearishStrangle.put,
      price: putPrice,
      quantity: 1,
      underlying: sell
    };

    const putOption = this.cartService.createOptionOrder(currentPut.underlying, [currentPut.put],
      currentPut.price, currentPut.quantity,
      OrderTypes.put, 'Testing buy put',
      'Buy', currentPut.quantity);
    this.cartService.addToCart(putOption, true, 'Testing buy put');
  }

  async testCall() {
    const buy = 'AMZN';
    const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(buy);
    const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;

    const currentCall = {
      call: bullishStrangle.call,
      price: callPrice,
      quantity: 1,
      underlying: buy
    };
    const option1 = this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call],
      currentCall.price, currentCall.quantity,
      OrderTypes.call, 'Testing buy call',
      'Buy', currentCall.quantity);
    this.cartService.addToCart(option1, true, 'Testing buy put');
  }

  async testAddTradingPairsToCart() {
    await this.optionsOrderBuilderService.addOptionsStrategiesToCart();
  }
  async test() {
    this.cartService.deleteCart();
    this.cartService.removeCompletedOrders();
    this.autopilotService.currentHoldings = await this.cartService.findCurrentPositions();
    await this.modifyCurrentHoldings();
    console.log(this.autopilotService.currentHoldings);
    //await this.orderHandlingService.intradayStep('SPY');
    await this.optionsOrderBuilderService.balanceTrades(['GOOG'], ['AAPL'], 1000, 5000, 'Test');
    if (!this.tradingPairs.length) {
      console.error('TRADING PAIR NOT ADDED');
    }
    this.portfolioService.purgeStrategy().subscribe();

    // Sell all
    this.autopilotService.currentHoldings.forEach(async (portItem: PortfolioInfoHolding) => {
      if (portItem.primaryLegs) {
        let orderType = null;
        if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'c') {
          orderType = OrderTypes.call;
        } else if (portItem.primaryLegs[0].putCallInd.toLowerCase() === 'p') {
          orderType = OrderTypes.put;
        }
        const estPrice = await this.orderHandlingService.getEstimatedPrice(portItem.primaryLegs[0].symbol);
        this.cartService.addSingleLegOptionOrder(portItem.name, [portItem.primaryLegs[0]], estPrice, portItem.primaryLegs[0].quantity, orderType, 'Sell', 'Testing sell', true);
      } else {
        await this.cartService.portfolioSell(portItem, 'Testing sell', true);
      }
    });

    // Testing buy stock
    await this.autopilotService.addBuy(this.autopilotService.createHoldingObj('GOOG'), null, 'Testing buy stock');

    // Testing buy put
    await this.testPut();
    // Testing buy call
    await this.testCall();
    // Testing buy pair
    const buy = 'META';
    const bullishStrangle = await this.strategyBuilderService.getCallStrangleTrade(buy);
    const callPrice = this.strategyBuilderService.findOptionsPrice(bullishStrangle.call.bid, bullishStrangle.call.ask) * 100;

    const currentCall = {
      call: bullishStrangle.call,
      price: callPrice,
      quantity: 1,
      underlying: buy
    };
    const option1 = this.cartService.createOptionOrder(currentCall.underlying, [currentCall.call],
      currentCall.price, currentCall.quantity,
      OrderTypes.call, 'Testing buy pair',
      'Buy', currentCall.quantity);

    const sell = 'ADBE';
    const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
    const putPrice = this.strategyBuilderService.findOptionsPrice(bearishStrangle.put.bid, bearishStrangle.put.ask) * 100;
    const currentPut = {
      put: bearishStrangle.put,
      price: putPrice,
      quantity: 1,
      underlying: sell
    };

    const option2 = this.cartService.createOptionOrder(currentPut.underlying, [currentPut.put],
      currentPut.price, currentPut.quantity,
      OrderTypes.put, 'Testing buy pair',
      'Buy', currentPut.quantity);
    const trade = [option1, option2];
    this.optionsOrderBuilderService.addTradingPair(trade, trade[0].reason ? trade[0].reason : 'Testing pair trading');

    setTimeout(async () => {
      const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
      const orders = buyAndSellList.concat(this.cartService.otherOrders);
      for (let i = 0; i < orders.length; i++) {
        await this.orderHandlingService.handleIntradayRecommendation(orders[i], { recommendation: OrderType.Buy } as any);
        await this.orderHandlingService.handleIntradayRecommendation(orders[i], { recommendation: OrderType.Sell } as any);
      }
      this.testAddTradingPairsToCart()
    }, 30000);

  }

  ngOnDestroy() {
    this.cleanUp();
  }
}
