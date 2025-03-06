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
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PortfolioMgmtService } from '../portfolio-mgmt/portfolio-mgmt.service';
import { PricingService } from '../pricing/pricing.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { StockListDialogComponent } from '../stock-list-dialog/stock-list-dialog.component';
import { FindPatternService } from '../strategies/find-pattern.service';
import { AddOptionsTradeComponent } from './add-options-trade/add-options-trade.component';
import { FindDaytradeService } from './find-daytrade.service';
import { PriceTargetService } from './price-target.service';
import { AutopilotService, RiskTolerance, Strategy, SwingtradeAlgorithms } from './autopilot.service';
import { BacktestAggregatorService } from '../backtest-table/backtest-aggregator.service';
import { OrderingService } from '@shared/ordering.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';

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
  defaultInterval = 121000;
  interval = 120000;
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
        label: 'Test',
        command: async () => {
          await this.optionsOrderBuilderService.balanceTrades(['GOOG'], ['AAPL'], 1000, 5000, 'Test');
          this.portfolioService.getStrategy().subscribe(strategies => console.log(strategies));
          this.portfolioService.getProfitLoss().subscribe(pl => console.log(pl));
          this.portfolioService.purgeStrategy().subscribe();
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
            await this.setProfitLoss();
            this.scoreKeeperService.resetTotal();
            this.resetCart();
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
        this.reportingService.addAuditLog(this.autopilotService.strategyList[this.autopilotService.strategyCounter], lastProfitMsg);
        const metTarget = await this.priceTargetService.hasMetPriceTarget(0.005);
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

    this.autopilotService.setLastSpyMl(backtestData.ml);
    // await this.autopilotService.buyRightAway(buySymbol, backtestData.ml);
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
        const buys = this.autopilotService.getBuyList()
        if (buys.length) {
          this.optionsOrderBuilderService.addCallToCurrentTrades(buys.pop());
        }
        break;
      case Strategy.InverseDispersion:
        await this.addInverseDispersionTrade();
        break;
      case Strategy.BuyWinners:
        await this.buyWinners();
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
      case Strategy.BuyMfiDiv2:
        if (this.autopilotService.isVolatilityHigh()) {
          await this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
        } else {
          await this.autopilotService.buyOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
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
        await this.autopilotService.findStocks();
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
    await this.optionsOrderBuilderService.createTradingPair(cash.minCash, cash.maxCash);
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
        await this.autopilotService.addBuy(stock, null, 'inverse dispersion reject');
      }
    };
    await this.autopilotService.getNewTrades(findPuts, null, this.autopilotService.currentHoldings);
  }

  async padOrders() {
    if (!this.autopilotService.hasReachedBuyLimit()) {
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
