import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AutopilotComponent, PositionHoldings, ProfitLossRecord } from './autopilot.component';
import { BacktestAggregatorService } from '../backtest-table/backtest-aggregator.service';
import { CartService, MachineLearningService, PortfolioInfoHolding, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { DailyBacktestService } from '@shared/daily-backtest.service';
import { MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { FindPatternService } from '../strategies/find-pattern.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { FindDaytradeService } from './find-daytrade.service';
import { PricingService } from '../pricing/pricing.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { PortfolioMgmtService } from '../portfolio-mgmt/portfolio-mgmt.service';
import { PriceTargetService } from './price-target.service';
import { AutopilotService, RiskTolerance, Strategy } from './autopilot.service';
import { of, Subject, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AiPicksService } from '@shared/services/ai-picks.service';
import * as moment from 'moment-timezone';
import { OrderingService } from '@shared/ordering.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';

xdescribe('AutopilotComponent', () => {
  let component: AutopilotComponent;
  let fixture: ComponentFixture<AutopilotComponent>;
  let mockPortfolioService: jasmine.SpyObj<PortfolioService>;
  let mockStrategyBuilderService: jasmine.SpyObj<StrategyBuilderService>;
  let mockCartService: jasmine.SpyObj<CartService>;
  let mockDailyBacktestService: jasmine.SpyObj<DailyBacktestService>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockScoreKeeperService: jasmine.SpyObj<ScoreKeeperService>;
  let mockReportingService: jasmine.SpyObj<ReportingService>;
  let mockMachineDaytradingService: jasmine.SpyObj<MachineDaytradingService>;
  let mockFindPatternService: jasmine.SpyObj<FindPatternService>;
  let mockMachineLearningService: jasmine.SpyObj<MachineLearningService>;
  let mockGlobalSettingsService: jasmine.SpyObj<GlobalSettingsService>;
  let mockDialogService: jasmine.SpyObj<DialogService>;
  let mockFindDaytradeService: jasmine.SpyObj<FindDaytradeService>;
  let mockPricingService: jasmine.SpyObj<PricingService>;
  let mockOrderHandlingService: jasmine.SpyObj<OrderHandlingService>;
  let mockOptionsOrderBuilderService: jasmine.SpyObj<OptionsOrderBuilderService>;
  let mockPortfolioMgmtService: jasmine.SpyObj<PortfolioMgmtService>;
  let mockPriceTargetService: jasmine.SpyObj<PriceTargetService>;
  let mockAutopilotService: jasmine.SpyObj<AutopilotService>;
  let mockBacktestAggregatorService: jasmine.SpyObj<BacktestAggregatorService>;
  let mockAiPicksService: jasmine.SpyObj<AiPicksService>;
  let mockOrderingService: jasmine.SpyObj<OrderingService>;
  let mockNewStockFinderService: jasmine.SpyObj<NewStockFinderService>;

  const mockHolding: PortfolioInfoHolding = {
    name: 'TEST',
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

  beforeEach(async () => {
    mockPortfolioService = jasmine.createSpyObj('PortfolioService', ['getPrice', 'getUserPreferences', 'sendMultiOrderSell', 'updatePortfolioProfitLoss', 'purgeStrategy']);
    mockStrategyBuilderService = jasmine.createSpyObj('StrategyBuilderService', ['getBacktestData', 'removeTradingStrategy', 'getTradingStrategies', 'getRecentBacktest', 'sanitizeData']);
    mockCartService = jasmine.createSpyObj('CartService', ['findCurrentPositions', 'portfolioSell', 'isStrangle', 'addSellStrangleOrder', 'addSingleLegOptionOrder', 'removeCompletedOrders', 'deleteDaytrade', 'portfolioDaytrade', 'buildOrderWithAllocation', 'getAvailableFunds']);
    mockDailyBacktestService = jasmine.createSpyObj('DailyBacktestService', ['getSignalScores']);
    mockMessageService = jasmine.createSpyObj('MessageService', ['add']);
    mockScoreKeeperService = jasmine.createSpyObj('ScoreKeeperService', ['resetTotal', 'setProfitLoss', 'profitLossHash', 'total']);
    mockReportingService = jasmine.createSpyObj('ReportingService', ['addAuditLog', 'exportAuditHistory', 'logs']);
    mockMachineDaytradingService = jasmine.createSpyObj('MachineDaytradingService', ['getNextStock', 'getPortfolioBalance']);
    mockFindPatternService = jasmine.createSpyObj('FindPatternService', ['developPattern']);
    mockMachineLearningService = jasmine.createSpyObj('MachineLearningService', ['getFoundPatterns', 'trainBuy', 'activateBuy']);
    mockGlobalSettingsService = jasmine.createSpyObj('GlobalSettingsService', ['getLastTradeDate']);
    mockDialogService = jasmine.createSpyObj('DialogService', ['open']);
    mockFindDaytradeService = jasmine.createSpyObj('FindDaytradeService', ['getTradeObserver', 'getRefreshObserver']);
    mockPricingService = jasmine.createSpyObj('PricingService', ['getPricing']);
    mockOrderHandlingService = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice', 'intradayStep']);
    mockOptionsOrderBuilderService = jasmine.createSpyObj('OptionsOrderBuilderService', ['createTradingPair', 'sellStrangle', 'hedgeTrade', 'addCallToCurrentTrades', 'balanceTrades', 'getTradingPairs', 'addTradingPair', 'clearTradingPairs']);
    mockPortfolioMgmtService = jasmine.createSpyObj('PortfolioMgmtService', ['hedge']);
    mockPriceTargetService = jasmine.createSpyObj('PriceTargetService', ['checkProfitTarget', 'setTargetDiff', 'hasMetPriceTarget', 'isProfitable']);
    mockAutopilotService = jasmine.createSpyObj('AutopilotService', ['checkCredentials', 'setPreferencesFromDB', 'isMarketOpened', 'handleIntraday', 'updateVolatility', 'getStopLoss', 'addBuy', 'createHoldingObj', 'checkStopLoss', 'setLastSpyMl', 'handleBalanceUtilization', 'getTechnicalIndicators', 'findTopBuy', 'findStocks', 'getNewTrades', 'isVolatilityHigh', 'addPairOnSignal', 'buyOnSignal', 'getBuyList', 'hasReachedBuyLimit', 'sellLoser', 'addShort', 'addPerfectPair', 'addMLPairs', 'addVolatilityPairs', 'sessionEnd', 'sessionStart']);
    mockBacktestAggregatorService = jasmine.createSpyObj('BacktestAggregatorService', ['clearTimeLine']);
    mockAiPicksService = jasmine.createSpyObj('AiPicksService', ['mlNeutralResults']);
    mockOrderingService = jasmine.createSpyObj('OrderingService', ['getRecommendationAndProcess']);
    mockNewStockFinderService = jasmine.createSpyObj('NewStockFinderService', ['addOldList', 'processOneStock']);

    mockPortfolioService.getUserPreferences.and.returnValue(of({}));
    mockCartService.findCurrentPositions.and.returnValue([]);
    mockMachineLearningService.getFoundPatterns.and.returnValue(of([]));
    mockMachineDaytradingService.getPortfolioBalance.and.returnValue({ liquidationValue: 50000 });
    mockStrategyBuilderService.getBacktestData.and.returnValue({});
    mockAutopilotService.isMarketOpened.and.returnValue(of(true));
    mockAutopilotService.handleIntraday.and.returnValue(true);
    mockGlobalSettingsService.getLastTradeDate.and.returnValue(moment().subtract(2, 'days').format('YYYY-MM-DD'));
    mockFindDaytradeService.getTradeObserver.and.returnValue(new Subject());
    mockFindDaytradeService.getRefreshObserver.and.returnValue(new Subject());
    mockAutopilotService.handleBalanceUtilization.and.returnValue(false);
    mockAutopilotService.getTechnicalIndicators.and.returnValue({ low: 1, high: 10 });
    mockAutopilotService.getStopLoss.and.returnValue({ profitTakingThreshold: 0.1, stopLoss: 0.05 });
    mockCartService.getAvailableFunds.and.returnValue(100000);
    mockAutopilotService.getBuyList.and.returnValue(['AAPL']);
    mockAutopilotService.isVolatilityHigh.and.returnValue(false);
    mockPricingService.getPricing.and.returnValue({ putsTotalPrice: 100, callsTotalPrice: 100 });
    mockAutopilotService.sessionEnd = moment().add(1, 'days');
    mockAutopilotService.sessionStart = moment().add(1, 'days');
    mockAutopilotService.hasReachedBuyLimit.and.returnValue(false);
    mockOrderingService.getRecommendationAndProcess.and.returnValue({ recommendation: 'BUY' });
    mockPortfolioService.getPrice.and.returnValue(100);
    mockNewStockFinderService.processOneStock.and.returnValue({});
    mockAutopilotService.getNewTrades.and.returnValue({});


    await TestBed.configureTestingModule({
      declarations: [AutopilotComponent],
      imports: [HttpClientTestingModule],
      providers: [
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
        { provide: CartService, useValue: mockCartService },
        { provide: DailyBacktestService, useValue: mockDailyBacktestService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: ScoreKeeperService, useValue: mockScoreKeeperService },
        { provide: ReportingService, useValue: mockReportingService },
        { provide: MachineDaytradingService, useValue: mockMachineDaytradingService },
        { provide: FindPatternService, useValue: mockFindPatternService },
        { provide: MachineLearningService, useValue: mockMachineLearningService },
        { provide: GlobalSettingsService, useValue: mockGlobalSettingsService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: FindDaytradeService, useValue: mockFindDaytradeService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: OrderHandlingService, useValue: mockOrderHandlingService },
        { provide: OptionsOrderBuilderService, useValue: mockOptionsOrderBuilderService },
        { provide: PortfolioMgmtService, useValue: mockPortfolioMgmtService },
        { provide: PriceTargetService, useValue: mockPriceTargetService },
        { provide: AutopilotService, useValue: mockAutopilotService },
        { provide: BacktestAggregatorService, useValue: mockBacktestAggregatorService },
        { provide: AiPicksService, useValue: mockAiPicksService },
        { provide: OrderingService, useValue: mockOrderingService },
        { provide: NewStockFinderService, useValue: mockNewStockFinderService },
        TradeService
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutopilotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize correctly', () => {
    expect(mockAutopilotService.checkCredentials).toHaveBeenCalled();
    expect(mockAutopilotService.setPreferencesFromDB).toHaveBeenCalled();
    expect(component.startButtonOptions.length).toBe(1);
    expect(component.multibuttonOptions.length).toBe(7);
  });

  it('should open and start interval', fakeAsync(() => {
    component.open();
    expect(component.display).toBe(true);
    expect(mockAutopilotService.updateVolatility).toHaveBeenCalled();
    expect(mockPriceTargetService.setTargetDiff).toHaveBeenCalled();
    expect(mockBacktestAggregatorService.clearTimeLine).toHaveBeenCalled();
    expect(mockMachineLearningService.getFoundPatterns).toHaveBeenCalled();
    tick(1001);
    expect(mockAutopilotService.isMarketOpened).toHaveBeenCalled();
    expect(mockStrategyBuilderService.getBacktestData).toHaveBeenCalled();
    tick(120000);
    expect(mockAutopilotService.isMarketOpened).toHaveBeenCalledTimes(2);
  }));

  it('should start manually and start interval', fakeAsync(() => {
    component.startButtonOptions[0].command();
    expect(component.display).toBe(true);
    expect(component.manualStart).toBe(true);
    expect(mockAutopilotService.updateVolatility).toHaveBeenCalled();
    expect(mockPriceTargetService.setTargetDiff).toHaveBeenCalled();
    expect(mockBacktestAggregatorService.clearTimeLine).toHaveBeenCalled();
    expect(mockMachineLearningService.getFoundPatterns).toHaveBeenCalled();
    tick(1001);
    expect(mockAutopilotService.isMarketOpened).toHaveBeenCalled();
    expect(mockStrategyBuilderService.getBacktestData).toHaveBeenCalled();
    expect(mockNewStockFinderService.addOldList).toHaveBeenCalled();
    tick(120000);
    expect(mockAutopilotService.isMarketOpened).toHaveBeenCalledTimes(2);
  }));

  it('should stop correctly', () => {
    component.open();
    component.stop();
    expect(component.display).toBe(false);
    expect(mockMessageService.add).toHaveBeenCalled();
  });

  it('should reset the cart correctly', () => {
    component.resetCart();
    expect(mockOptionsOrderBuilderService.clearTradingPairs).toHaveBeenCalled();
    expect(mockCartService.removeCompletedOrders).toHaveBeenCalled();
    expect(mockStrategyBuilderService.sanitizeData).toHaveBeenCalled();
    expect(component.developedStrategy).toBe(false);
  });

  it('should decrease risk tolerance', () => {
    component.decreaseRiskTolerance();
    expect(component.autopilotService.riskCounter).toBe(0);
    expect(mockReportingService.addAuditLog).toHaveBeenCalled();
  });

  it('should decrease day trade risk tolerance', () => {
    component.dayTradeRiskCounter = 1;
    component.decreaseDayTradeRiskTolerance();
    expect(component.dayTradeRiskCounter).toBe(0);
  });

  it('should increase risk tolerance', () => {
    component.autopilotService.riskCounter = 0;
    component.increaseRiskTolerance();
    expect(component.autopilotService.riskCounter).toBe(1);
    expect(mockReportingService.addAuditLog).toHaveBeenCalled();
  });

  it('should increase day trade risk tolerance', () => {
    component.dayTradeRiskCounter = 0;
    component.increaseDayTradeRiskTolerance();
    expect(component.dayTradeRiskCounter).toBe(1);
  });
  it('should change strategy', () => {
    component.autopilotService.strategyCounter = 0;
    component.autopilotService.strategyList = [Strategy.BuyCalls, Strategy.Daytrade];
    component.changeStrategy();
    expect(component.autopilotService.strategyCounter).toBe(1);
    expect(component.daytradeMode).toBe(true);
    expect(mockMessageService.add).toHaveBeenCalled();
    expect(mockReportingService.addAuditLog).toHaveBeenCalled();
  });

  it('should call setupStrategy', fakeAsync(() => {
    component.setupStrategy();
    tick();
    expect(mockAutopilotService.updateVolatility).toHaveBeenCalled();
    expect(mockPriceTargetService.setTargetDiff).toHaveBeenCalled();
    expect(mockBacktestAggregatorService.clearTimeLine).toHaveBeenCalled();
    expect(mockMachineLearningService.getFoundPatterns).toHaveBeenCalled();
    expect(mockCartService.findCurrentPositions).toHaveBeenCalled();
    expect(mockAutopilotService.checkStopLoss).toHaveBeenCalledTimes(0);
  }));

  it('should call backtestOneStock', fakeAsync(() => {
    mockMachineDaytradingService.getNextStock.and.returnValue('AAPL');
    component.backtestOneStock();
    tick();
    expect(mockMachineDaytradingService.getNextStock).toHaveBeenCalled();
    expect(mockStrategyBuilderService.getBacktestData).toHaveBeenCalledWith('AAPL', false);
  }));
});
