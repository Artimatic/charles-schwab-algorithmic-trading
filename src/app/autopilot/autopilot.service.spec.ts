import { TestBed } from '@angular/core/testing';
import { AutopilotService, RiskTolerance, Strategy, SwingtradeAlgorithms } from './autopilot.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { BacktestService, CartService, PortfolioService, ReportingService, AuthenticationService, DaytradeService, MachineLearningService } from '@shared/services';
import { PriceTargetService } from './price-target.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { of } from 'rxjs';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { PortfolioInfoHolding } from '@shared/services';

describe('AutopilotService', () => {
  let service: AutopilotService;
  let mockStrategyBuilderService: jasmine.SpyObj<StrategyBuilderService>;
  let mockMachineDaytradingService: jasmine.SpyObj<MachineDaytradingService>;
  let mockOptionsOrderBuilderService: jasmine.SpyObj<OptionsOrderBuilderService>;
  let mockCartService: jasmine.SpyObj<CartService>;
  let mockBacktestService: jasmine.SpyObj<BacktestService>;
  let mockPriceTargetService: jasmine.SpyObj<PriceTargetService>;
  let mockOrderHandlingService: jasmine.SpyObj<OrderHandlingService>;
  let mockReportingService: jasmine.SpyObj<ReportingService>;
  let mockPortfolioService: jasmine.SpyObj<PortfolioService>;
  let mockGlobalSettingsService: jasmine.SpyObj<GlobalSettingsService>;
  let mockAuthenticationService: jasmine.SpyObj<AuthenticationService>;
  let mockDaytradeService: jasmine.SpyObj<DaytradeService>;
  let mockDaytradeStrategiesService: jasmine.SpyObj<DaytradeStrategiesService>;
  let mockMachineLearningService: jasmine.SpyObj<MachineLearningService>;
  beforeEach(() => {
    mockStrategyBuilderService = jasmine.createSpyObj('StrategyBuilderService', ['getBacktestData', 'addAndRemoveOldStrategies', 'createStrategy', 'getCallStrangleTrade', 'findOptionsPrice', 'getRecentBacktest', 'getQuantity']);
    mockMachineDaytradingService = jasmine.createSpyObj('MachineDaytradingService', ['getNextStock', 'getCurrentStockList', 'setCurrentStockList']);
    mockOptionsOrderBuilderService = jasmine.createSpyObj('OptionsOrderBuilderService', ['getImpliedMove', 'balanceTrades', 'addPutToCurrentTrades', 'addOptionByBalance', 'sellStrangle', 'addOptionsStrategiesToCart', 'checkCurrentOptions', 'getTradingPairs', 'getTradingPairs', 'clearTradingPairs', 'getCurrentTradeIdeas']);
    mockCartService = jasmine.createSpyObj('CartService', ['getAvailableFunds', 'portfolioBuy', 'portfolioSell', 'addSingleLegOptionOrder', 'isStrangle', 'findCurrentPositions', 'buildOrderWithAllocation', 'sellOrders', 'buyOrders', 'otherOrders']);
    mockBacktestService = jasmine.createSpyObj('BacktestService', ['getBacktestEvaluation']);
    mockPriceTargetService = jasmine.createSpyObj('PriceTargetService', ['isDownDay', 'isProfitable', 'notProfitable', 'getDiff', 'getCallPutBalance']);
    mockOrderHandlingService = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice', 'intradayStep']);
    mockReportingService = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
    mockPortfolioService = jasmine.createSpyObj('PortfolioService', ['getEquityMarketHours', 'getProfitLoss', 'getStrategy', 'getTdBalance', 'getPrice']);
    mockGlobalSettingsService = jasmine.createSpyObj('GlobalSettingsService', ['getStartStopTime']);
    mockAuthenticationService = jasmine.createSpyObj('AuthenticationService', ['checkCredentials']);
    mockDaytradeService = jasmine.createSpyObj('DaytradeService', ['sendBuy', 'sendSell']);
    mockDaytradeStrategiesService = jasmine.createSpyObj('DaytradeStrategiesService', ['shouldSkip']);
    mockMachineLearningService = jasmine.createSpyObj('MachineLearningService', ['trainVolatility']);

    mockPortfolioService.getEquityMarketHours.and.returnValue(of({ equity: { EQ: { isOpen: true, sessionHours: { regularMarket: [{ start: '2023-11-08T09:30:00', end: '2023-11-08T16:00:00' }] } } } }));
    mockGlobalSettingsService.getStartStopTime.and.returnValue({ startDateTime: new Date(), endDateTime: new Date() });
    mockPortfolioService.getProfitLoss.and.returnValue(of([{ date: 'test', lastStrategy: 'Default', lastRiskTolerance: 0 }]));
    mockPortfolioService.getStrategy.and.returnValue(of([]));
    mockPortfolioService.getTdBalance.and.returnValue(of({ cashBalance: 100000, liquidationValue: 100000, availableFunds: 100000 }));
    mockPortfolioService.getPrice.and.returnValue(100);
    mockBacktestService.getBacktestEvaluation.and.returnValue(of({ signals: [{ low: 1, high: 10 }] }));
    mockMachineLearningService.trainVolatility.and.returnValue(of([{ nextOutput: 0.1 }]));
    mockOptionsOrderBuilderService.getImpliedMove.and.returnValue(0.1);
    mockStrategyBuilderService.getBacktestData.and.returnValue({ impliedMovement: 0.1, net: 10, invested: 100, recommendation: 'BUY', ml: 0.5, averageMove: 0.1 });
    mockCartService.getAvailableFunds.and.returnValue(100000);
    mockDaytradeStrategiesService.shouldSkip.and.returnValue(false);
    mockStrategyBuilderService.getRecentBacktest.and.returnValue({ ml: 0.8, recommendation: 'STRONGBUY', sellMl: 0.3 });

    TestBed.configureTestingModule({
      providers: [
        AutopilotService,
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
        { provide: MachineDaytradingService, useValue: mockMachineDaytradingService },
        { provide: OptionsOrderBuilderService, useValue: mockOptionsOrderBuilderService },
        { provide: CartService, useValue: mockCartService },
        { provide: BacktestService, useValue: mockBacktestService },
        { provide: PriceTargetService, useValue: mockPriceTargetService },
        { provide: OrderHandlingService, useValue: mockOrderHandlingService },
        { provide: ReportingService, useValue: mockReportingService },
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: GlobalSettingsService, useValue: mockGlobalSettingsService },
        { provide: AuthenticationService, useValue: mockAuthenticationService },
        { provide: DaytradeService, useValue: mockDaytradeService },
        { provide: DaytradeStrategiesService, useValue: mockDaytradeStrategiesService },
        { provide: MachineLearningService, useValue: mockMachineLearningService },
      ]
    });
    service = TestBed.inject(AutopilotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set preferences from DB and set strategy', () => {
    service.setPreferencesFromDB();
    expect(mockPortfolioService.getProfitLoss).toHaveBeenCalled();
    expect(mockPortfolioService.getStrategy).toHaveBeenCalled();
    expect(mockStrategyBuilderService.addAndRemoveOldStrategies).toHaveBeenCalled();
    expect(service.strategyCounter).toEqual(0);
    expect(service.riskCounter).toEqual(0);
    expect(service.sessionStart).toEqual(jasmine.any(Date));
    expect(service.sessionEnd).toEqual(jasmine.any(Date));
  });

  it('should get min and max cash for options', async () => {
    service.riskCounter = 1;
    mockCartService.getAvailableFunds.and.returnValue(10000);
    const result = await service.getMinMaxCashForOptions();
    expect(result.maxCash).toBe(250);
    expect(result.minCash).toBe(200);
    expect(mockCartService.getAvailableFunds).toHaveBeenCalled();
  });

  it('should get min and max cash for options with modifier', async () => {
    service.riskCounter = 1;
    mockCartService.getAvailableFunds.and.returnValue(10000);
    const result = await service.getMinMaxCashForOptions(0.1);
    expect(result.maxCash).toBe(250);
    expect(result.minCash).toBe(245);
    expect(mockCartService.getAvailableFunds).toHaveBeenCalled();
  });

  it('should add pairs from hash map', async () => {
    const MlBuys = { 'key1': ['AAPL'], 'key2': ['MSFT'] };
    const MlSells = { 'key1': ['TSLA'], 'key2': ['GOOG'] };
    await service.addPairsFromHashMap(MlBuys, MlSells, 'Test Reason');
    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalledTimes(2);
    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalledWith('Test Reason Pair trade', 'Test Reason', ['AAPL'], ['TSLA'], 'Test Reason');
  });

  it('should handle volatility pairs', async () => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ 
      test0: { stock: 'AAPL', ml: 0.6, recommendation: 'STRONGBUY', impliedMovement: 0.1, sellMl: 0.2 },
      test1: { stock: 'GOOG', ml: 0.1, recommendation: 'STRONGSELL', impliedMovement: 0.1, sellMl: 0.6 } 
    }));
    await service.addVolatilityPairs();
    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalled();
    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalledWith('Volatility pairs Pair trade', 'Volatility pairs', ['AAPL'], ['GOOG'], 'Volatility pairs');
  });

  it('should handle perfect pair', async () => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ 
      test0: { stock: 'AAPL', ml: 0.6, recommendation: 'STRONgsell', impliedMovement: 0.1, sellMl: 0.6, sellSignals: ['macd', 'bband'], buySignals: ['mfi'] },
      test1: { stock: 'GOOG', ml: 0.6, recommendation: 'STRONGbuy', impliedMovement: 0.1, sellMl: 0.6, sellSignals: ['bband', 'macd'], buySignals: ['mfi'] }
    }));
    spyOn(service, 'addPairsFromHashMap').and.callThrough();
    await service.addPerfectPair();
    expect(service.addPairsFromHashMap).toHaveBeenCalledWith({ 'bband,macd-mfi10': [ 'GOOG' ] }, { 'bband,macd-mfi10': [ 'AAPL' ] }, 'Perfect pair');

    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalledWith('Perfect pair Pair trade', 'Perfect pair', ['GOOG'], ['AAPL'], 'Perfect pair');
  });

  xit('should handle ML pairs', async () => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ 
      test0: { stock: 'AAPL', ml: 0.6, recommendation: 'STRONGBUY', impliedMovement: 0.1, sellMl: 0.2 },
      test1: { stock: 'GOOG', ml: 0.1, recommendation: 'STRONGSELL', impliedMovement: 0.1, sellMl: 0.6 } 
    }));

    spyOn(service, 'addPairsFromHashMap').and.callThrough();

    await service.addMLPairs();
    expect(service.addPairsFromHashMap).toHaveBeenCalledWith({ 'key': [ 'GOOG' ] }, { 'key': [ 'AAPL' ] }, 'ML pair');

    expect(mockStrategyBuilderService.createStrategy).toHaveBeenCalledWith('ML pairs Pair trade', 'ML pairs', ['GOOG'], ['AAPL'], 'ML pairs');
  });

  xit('should check intraday strategies', async () => {
    mockPriceTargetService.isDownDay.and.returnValue(true);
    mockStrategyBuilderService.getCallStrangleTrade.and.returnValue({ call: { bid: 1, ask: 2 } });
    mockStrategyBuilderService.findOptionsPrice.and.returnValue(1);
    await service.checkIntradayStrategies();
    expect(mockPriceTargetService.isDownDay).toHaveBeenCalled();
    expect(mockCartService.addSingleLegOptionOrder).toHaveBeenCalled();
  });

  it('should get technical indicators', async () => {
    await service.getTechnicalIndicators('AAPL', '2023-01-01', '2023-10-10');
    expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalledWith('AAPL', '2023-01-01', '2023-10-10', 'daily-indicators');
  });

  it('should get stop loss', () => {
    const result = service.getStopLoss(1, 10);
    expect(result.profitTakingThreshold).toEqual(4.5);
    expect(result.stopLoss).toEqual(-4.5);
  });
  it('should add buy', async () => {
    mockCartService.portfolioBuy.and.callFake(() => { });;
    await service.addBuy({ name: 'AAPL' } as PortfolioInfoHolding, 0.1, 'reason');
    expect(mockStrategyBuilderService.getBacktestData).toHaveBeenCalled();
    expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalled();
    expect(mockCartService.portfolioBuy).toHaveBeenCalled();
  });
  it('should handle error add buy', async () => {
    mockBacktestService.getBacktestEvaluation.and.returnValue(of(null));
    mockCartService.portfolioBuy.and.callFake(() => { });;
    await service.addBuy({ name: 'AAPL' } as PortfolioInfoHolding, 0.1, 'reason');
    expect(mockStrategyBuilderService.getBacktestData).toHaveBeenCalled();
    expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalled();
    expect(mockCartService.portfolioBuy).not.toHaveBeenCalled();
  });

  it('should create holding obj', () => {
    const holding = service.createHoldingObj('AAPL');
    expect(holding.name).toEqual('AAPL');
    expect(holding.symbol).toEqual('AAPL');
  });

  it('should call find swing stock callback buy', async () => {
    mockCartService.portfolioBuy.and.callFake(() => { });
    await service.findSwingStockCallback('AAPL', 0.8, { recommendation: 'STRONGBUY', impliedMovement: 0.1, net: 10, invested: 100 });
    expect(mockCartService.portfolioBuy).toHaveBeenCalled();
  });
  it('should call find swing stock callback sell', async () => {
    mockCartService.portfolioBuy.and.callFake(() => { });
    await service.findSwingStockCallback('AAPL', 0.3, { recommendation: 'STRONGBUY', impliedMovement: 0.1, net: 10, invested: 100 });
    expect(mockCartService.portfolioBuy).not.toHaveBeenCalled();
  });

  it('should get buy list', async () => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ test: { stock: 'AAPL', ml: 0.6, recommendation: 'STRONGBUY', sellMl: 0.6, sellRecommendation: 'STRONGSELL', net: 10, invested: 100 } }));
    const result = service.getBuyList();
    expect(result).toEqual(['AAPL']);
  });

  it('should get buy list no filter', async () => {
    spyOn(localStorage, 'getItem').and.returnValue(JSON.stringify({ test: { stock: 'AAPL', ml: 0.6, recommendation: 'STRONGBUY', sellMl: 0.6, sellRecommendation: 'STRONGSELL', net: 10, invested: 100 } }));
    const result = service.getBuyList(() => true);
    expect(result).toEqual(['AAPL']);
  });
});
