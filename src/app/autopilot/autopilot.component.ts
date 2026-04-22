import { Component, OnDestroy, OnInit } from '@angular/core';
import * as moment from 'moment-timezone';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { SmartOrder } from '@shared/index';
import { Options } from '@shared/models/options';
import { SignalsStateService } from '../strategies/signals-state.service';
import { OrderTypes } from '@shared/models/smart-order';
import { Trade } from '@shared/models/trade';
import { CartService, MachineLearningService, PortfolioInfoHolding, PortfolioService, TradeService } from '@shared/services';
import { AiPicksPredictionData, AiPicksService } from '@shared/services/ai-picks.service';
import { divide, round } from 'lodash';
import { MenuItem, MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject, Subscription } from 'rxjs';
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
import { AutopilotService } from './autopilot.service';
import { StrategyFinderDialogComponent } from './strategy-finder-dialog/strategy-finder-dialog.component';
import { OrderingService } from '@shared/ordering.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';
import { OrderType } from '@shared/stock-backtest.interface';
import { RiskTolerance } from './risk-tolerance.enum';
import { StrategyManagementService } from './strategy-management.service';
import { RiskManagementService } from './risk-management.service';
import { AutopilotOrchestrationService, IAutopilotOrchestrationContext } from './autopilot-orchestration.service';
import { AutopilotMenuService, IAutopilotMenuContext } from './autopilot-menu.service';
import { AutopilotSessionReportingService, ISessionReportingContext } from './autopilot-session-reporting.service';

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

@Component({
  selector: 'app-autopilot',
  templateUrl: './autopilot.component.html',
  styleUrls: ['./autopilot.component.scss']
})
export class AutopilotComponent implements OnInit, OnDestroy {
  display = false;
  isLoading = true;
  defaultInterval = 60000;
  interval = 60000;
  oneDayInterval;
  timer: Subscription;
  alive = false;
  destroy$ = new Subject<void>();
  maxHoldings = 100;
  developedStrategy = false;
  tradingPairsCounter = 0;

  backtestBuffer$;

  lastInterval = null;

  lastMarketHourCheck = null;
  lastCredentialCheck;

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
  isOpenMarket = false;
  // Track the last time printFinalResults ran so we can re-run if it's older than 24 hours
  lastPrintFinalResults: moment.Moment | null = null;
  constructor(
    private portfolioService: PortfolioService,
    private strategyBuilderService: StrategyBuilderService,
    private cartService: CartService,
    private dailyBacktestService: DailyBacktestService,
    private messageService: MessageService,
    private machineLearningService: MachineLearningService,
    private globalSettingsService: GlobalSettingsService,
    public dialogService: DialogService,
    private findDaytradeService: FindDaytradeService,
    private orderHandlingService: OrderHandlingService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    public priceTargetService: PriceTargetService,
    public autopilotService: AutopilotService,
    private signalsStateService: SignalsStateService,
    private strategyManagementService: StrategyManagementService,
    private riskManagementService: RiskManagementService,
    private orchestrationService: AutopilotOrchestrationService,
    private menuService: AutopilotMenuService,
    private sessionReportingService: AutopilotSessionReportingService
  ) { }

  ngOnInit(): void {
    this.autopilotService.checkCredentials();
    this.autopilotService.setPreferencesFromDB();

    // Initialize last printFinalResults timestamp from local storage if available
    const lastPrint = localStorage.getItem('lastPrintFinalResults');
    this.lastPrintFinalResults = lastPrint ? moment(lastPrint) : null;

    // Subscribe to signal state changes
    this.signalsStateService.select('lastCredentialCheck')
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        lastCheck => this.lastCredentialCheck = lastCheck ? moment(lastCheck) : null
      );
    this.signalsStateService.select('developedStrategy')
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        developed => this.developedStrategy = developed
      );
    this.signalsStateService.select('boughtAtClose')
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        bought => this.boughtAtClose = bought
      );
    this.signalsStateService.select('lastProfitCheck')
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        lastCheck => this.lastProfitCheck = moment(lastCheck)
      );

    // Subscribe to intraday check updates
    this.signalsStateService.select('lastIntradayCheck')
      .pipe(takeUntil(this.destroy$))
      .subscribe(async () => {
        if (this.autopilotService.isIntradayTrading()) {
          await this.autopilotService.handleIntraday();
        }
      });
    const menuContext: IAutopilotMenuContext = {
      startManualTrading: () => this.startManualTrading(),
      updateStockList: () => this.updateStockList(),
      sellAll: () => this.sellAll()
    };
    this.startButtonOptions = this.menuService.getStartButtonOptions(menuContext);
    this.otherOptions = this.menuService.getOtherOptions(menuContext);
    this.multibuttonOptions = this.menuService.getMultibuttonOptions(menuContext);
  }

  open() {
    this.manualStart = false;

    this.destroy$ = new Subject<void>();
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

  /** Used by menu "Start orders without auto manage". Message and addOldList are handled by AutopilotMenuService. */
  async startManualTrading(): Promise<void> {
    this.manualStart = true;
    this.destroy$ = new Subject<void>();
    if (this.backtestBuffer$) {
      this.backtestBuffer$.unsubscribe();
    }
    this.backtestBuffer$ = new Subject();

    this.display = true;
    await this.startInterval();
    this.interval = this.defaultInterval;
  }

  async startInterval() {
    if (this.timer) {
      this.timer.unsubscribe();
    }

    // Initialize strategy and state
    await this.setupStrategy();
    await this.autopilotService.handleStrategy();
    this.signalsStateService.reset();

    const context: IAutopilotOrchestrationContext = {
      getLastPrintFinalResults: () => this.lastPrintFinalResults,
      setLastPrintFinalResults: (v) => { this.lastPrintFinalResults = v; },
      getIsOpenMarket: () => this.isOpenMarket,
      setIsOpenMarket: (v) => { this.isOpenMarket = v; },
      printFinalResults: () => this.printFinalResults(),
      setupStrategy: () => this.setupStrategy(),
      backtestOneStock: (overwrite, addTrade) => this.backtestOneStock(overwrite, addTrade),
      buySellAtCloseOrOpen: () => this.buySellAtCloseOrOpen(),
      addCurrentHoldingsToAuditLog: () => this.addCurrentHoldingsToAuditLog(),
      decreaseRiskTolerance: () => this.decreaseRiskTolerance()
    };

    this.timer = this.orchestrationService.start(context, this.interval, this.destroy$);
  }

  async printFinalResults(): Promise<void> {
    const context: ISessionReportingContext = {
      getLastPrintFinalResults: () => this.lastPrintFinalResults,
      setLastPrintFinalResults: (v) => { this.lastPrintFinalResults = v; }
    };
    await this.sessionReportingService.printFinalResults(context);
  }

  stop() {
    this.display = false;
    this.orchestrationService.stop();
    if (this.timer) {
      this.timer.unsubscribe();
    }
    this.cleanUp();
    this.messageService.add({
      severity: 'danger',
      summary: 'Autopilot stopped'
    });
  }

  async setupStrategy(): Promise<void> {
    await this.strategyManagementService.setupStrategy();
    this.developedStrategy = true;
    this.boughtAtClose = false;
    this.machineLearningService.getFoundPatterns()
      .pipe(takeUntil(this.destroy$))
      .subscribe(patternsResponse => console.log('found patterns ', patternsResponse));
  }

  isBuyPrediction(prediction: { label: string, value: AiPicksPredictionData[] }) {
    return this.strategyManagementService.isBuyPrediction(prediction);
  }

  async backtestOneStock(overwrite = false, addTrade = true) {
    await this.strategyManagementService.backtestOneStock(overwrite, addTrade);
  }

  triggerBacktestNext() {
    this.backtestBuffer$.next();
  }

  async addDaytrade(stock: string) {
    if ((this.cartService.buyOrders.length + this.cartService.otherOrders.length) < this.cartService.maxTradeCount) {
      const currentDate = moment().format('YYYY-MM-DD');
      const startDate = moment().subtract(100, 'days').format('YYYY-MM-DD');
      try {
        const indicators = await this.orderHandlingService.getTechnicalIndicators(stock, startDate, currentDate).toPromise();
        const thresholds = this.orderHandlingService.getStopLoss(indicators.low, indicators.high);
        await this.portfolioDaytrade(stock,
          round(this.getDayTradeRiskTolerance(), 2),
          thresholds.profitTakingThreshold,
          thresholds.stopLoss);
      } catch (error) {
        console.log('Error getting backtest data for daytrade', stock, error);
        await this.portfolioDaytrade(stock,
          round(this.getDayTradeRiskTolerance(), 2),
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
    const rec = (holding?.recommendation ?? '').toString().toLowerCase();
    const isBuy = rec === 'buy' || rec === 'bullish' || rec.includes('buy') || rec.includes('bullish');
    const isSell = rec === 'sell' || rec === 'bearish' || rec.includes('sell') || rec.includes('bearish');

    if (isBuy) {
      await this.orderHandlingService.addBuy(holding, this.autopilotService.riskLevel * 2, 'Recommended buy');
    } else if (isSell) {
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
      allocation || this.autopilotService.riskLevel,
      profitThreshold,
      stopLossThreshold);
  }

  getRecommendationReason(recommendation: { [key: string]: string }) {
    const buyReasons: string[] = [];
    const sellReasons: string[] = [];

    Object.entries(recommendation).forEach(([rec, value]) => {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'bullish') {
        buyReasons.push(rec);
      } else if (lowerValue === 'bearish') {
        sellReasons.push(rec);
      }
    });

    return {
      buyReasons: buyReasons.join(','),
      sellReasons: sellReasons.join(',')
    };
  }

  scroll() {
    const el = document.getElementById('autopilot-toolbar');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  runFindPattern() {
    this.strategyManagementService.runFindPattern();
  }

  removeStrategy(item) {
    this.strategyManagementService.removeStrategy(item);
  }

  addOptions() {
    this.dialogService.open(AddOptionsTradeComponent, {
      header: 'Add options trade',
      contentStyle: { 'overflow-y': 'unset' }
    });
  }

  async modifyRisk(hasMetTarget?: boolean) {
    if (hasMetTarget === undefined) {
      hasMetTarget = await this.priceTargetService.hasMetPriceTarget(0.001);
    }
    await this.riskManagementService.modifyRisk(hasMetTarget);
  }

  decreaseRiskTolerance(): void {
    this.riskManagementService.decreaseRiskTolerance();
  }

  async increaseRiskTolerance(): Promise<void> {
    await this.riskManagementService.increaseRiskTolerance();
  }

  increaseDayTradeRiskTolerance(): void {
    this.riskManagementService.increaseDayTradeRiskTolerance();
  }

  decreaseDayTradeRiskTolerance(): void {
    this.riskManagementService.decreaseDayTradeRiskTolerance();
  }

  getDayTradeRiskTolerance(): RiskTolerance {
    return this.riskManagementService.getDayTradeRiskTolerance();
  }

  getDayTradeRiskCounter(): number {
    return this.riskManagementService.getDayTradeRiskCounter();
  }

  getVolatilityChipColor(volatility: number): string {
    if (volatility > 0.3) {
      return 'warn';
    } else if (volatility > 0.15) {
      return 'accent';
    }
    return 'primary';
  }

  addCurrentHoldingsToAuditLog(): void {
    this.strategyManagementService.addCurrentHoldingsToAuditLog();
  }

  resetCart(): void {
    this.strategyManagementService.resetCart();
  }

  async modifyCurrentHoldings(): Promise<void> {
    await this.strategyManagementService.modifyCurrentHoldings();
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
    if (this.boughtAtClose || this.manualStart) {
      return;
    }
    this.boughtAtClose = true;
    await this.strategyManagementService.buySellAtCloseOrOpen();
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

  getPreferences() {
    this.portfolioService.getUserPreferences().subscribe(pref => {
      console.log('pref', pref);
    });
  }

  async sellAll() {
    await this.strategyManagementService.sellAll();
  }

  showStrategies() {
    this.tradingPairs = this.optionsOrderBuilderService.getTradingPairs();
    console.log(this.tradingPairs);
    this.dialogRef = this.dialogService.open(StrategyFinderDialogComponent, {
      header: 'Strategy finder',
      width: '800px',
      contentStyle: {'max-height': '600px', 'overflow': 'auto'},
      data: { tradingPairs: this.tradingPairs }
    });
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
    // Clean up test timeouts if they exist
    const testTimeouts = (this as any)._testTimeouts as ReturnType<typeof setTimeout>[];
    if (testTimeouts && Array.isArray(testTimeouts)) {
      testTimeouts.forEach(timeout => clearTimeout(timeout));
    }
  }

  async testPut() {
    const sell = 'WMT';
    const bearishStrangle = await this.strategyBuilderService.getPutStrangleTrade(sell);
    if (!bearishStrangle.put) {
      return;
    }
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
    if (!bullishStrangle.call) {
      return;
    }
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
    await this.autopilotService.setCurrentHoldings();
    await this.modifyCurrentHoldings();
    console.log(this.autopilotService.getCurrentHoldings());
    //await this.orderHandlingService.intradayStep('SPY');
    const result = await this.optionsOrderBuilderService.balanceTrades(['GOOGL'], ['AAPL'], 1000, 5000, 'Test');
    console.log('test balanceTrades result', result);
    if (!this.tradingPairs.length) {
      console.error('TRADING PAIR NOT ADDED');
    }
    this.portfolioService.purgeStrategy().subscribe();

    // Sell all
    this.autopilotService.getCurrentHoldings().forEach(async (portItem: PortfolioInfoHolding) => {
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
    await this.orderHandlingService.addBuy(this.autopilotService.createHoldingObj('GOOGL'), 0.01, 'Testing buy stock');

    // Testing buy put
    await this.testPut();
    // Testing buy call
    await this.testCall();
    // Testing buy pair
    const buy = 'CSCO';
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

    // Track timeouts for proper cleanup
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    
    timeouts.push(setTimeout(async () => {
      await this.autopilotService.executeOrderList();
    }, 10000));

    timeouts.push(setTimeout(async () => {
      const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
      const orders = buyAndSellList.concat(this.cartService.otherOrders);
      for (let i = 0; i < orders.length; i++) {
        orders[i].priceLowerBound = 0.01
        const buyOrder = orders[i];
        // Test sending buy order
        await this.orderHandlingService.handleIntradayRecommendation(buyOrder, { recommendation: OrderType.Buy } as any);
      }
      this.testAddTradingPairsToCart()
    }, 20000));

    timeouts.push(setTimeout(async () => {
      const buyAndSellList = this.cartService.sellOrders.concat(this.cartService.buyOrders);
      const orders = buyAndSellList.concat(this.cartService.otherOrders);
      for (let i = 0; i < orders.length; i++) {
        orders[i].priceLowerBound = 100000
        const buyOrder = orders[i];
        // Test sending sell order
        await this.orderHandlingService.handleIntradayRecommendation(buyOrder, { recommendation: OrderType.Sell } as any);
      }
      this.testAddTradingPairsToCart()
    }, 25000));
    
    // Store timeouts reference for cleanup if component is destroyed
    (this as any)._testTimeouts = timeouts;

  }

  ngOnDestroy() {
    this.cleanUp();
  }
}
