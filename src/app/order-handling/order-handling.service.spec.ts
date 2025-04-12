import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import * as moment from 'moment-timezone';

import { OrderHandlingService } from './order-handling.service';
import {
  ReportingService,
  MachineLearningService,
  BacktestService,
  CartService,
  DaytradeService,
  PortfolioInfoHolding,
  PortfolioService,
  TradeService
} from '@shared/services';
import { PricingService } from '../pricing/pricing.service';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { DaytradeStrategiesService } from '../strategies/daytrade-strategies.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { Recommendation } from '@shared/stock-backtest.interface';
import { Options } from '@shared/models/options';

// Helper to create a mock SmartOrder
const createMockOrder = (overrides: Partial<any> = {}): any => ({
  holding: {
    symbol: 'AAPL',
    name: 'AAPL',
    shares: 0, // Default shares to 0 unless overridden
    // Add other necessary PortfolioInfoHolding properties if needed
    pl: 0,
    netLiq: 0,
    alloc: 0,
    recommendation: 'None',
    buyReasons: '',
    sellReasons: '',
    buyConfidence: 0,
    sellConfidence: 0,
    prediction: null,
    ...overrides.holding
  },
  quantity: 10,
  price: 150,
  submitted: false,
  pending: false,
  side: 'Buy', // Default side
  orderSize: 1,
  lossThreshold: -0.01,
  profitThreshold: 0.02,
  trailingStop: -0.005,
  useStopLoss: true,
  useTrailingStop: true,
  useTakeProfit: true,
  sellSignal: false,
  buySignal: false,
  buyCount: 0,
  sellCount: 0,
  positionCount: 0,
  createdTime: new Date().toISOString(),
  signalTime: new Date().toISOString(),
  stopped: false,
  type: null, // Default type
  primaryLegs: [],
  secondaryLegs: [],
  errors: [],
  warnings: [],
  previousOrders: [],
  ...overrides,
});

// Helper to create mock Options
const createMockOption = (symbol: string, putCall: 'P' | 'C', quantity: number, description: string): any => ({
  symbol: symbol,
  putCallInd: putCall,
  description: description,
  bid: 1.0,
  ask: 1.1,
  last: 1.05,
  mark: 1.05,
  bidSize: 10,
  askSize: 10,
  highPrice: 1.1,
  lowPrice: 1.0,
  openPrice: 1.0,
  closePrice: 1.0,
  totalVolume: 1000,
  tradeTimeInLong: Date.now(),
  quoteTimeInLong: Date.now(),
  netChange: 0.05,
  volatility: 30,
  delta: 0.5,
  gamma: 0.1,
  theta: -0.05,
  vega: 0.02,
  rho: 0.01,
  openInterest: 500,
  timeValue: 0.05,
  theoreticalOptionValue: 1.05,
  strikePrice: 150,
  expirationDate: moment().add(30, 'days').valueOf(),
  daysToExpiration: 30,
  expirationType: 'standard',
  lastTradingDay: moment().add(30, 'days').valueOf(),
  multiplier: 100,
  settlementType: 'standard',
  deliverableNote: '',
  isIndexOption: false,
  percentChange: 5,
  markChange: 0.05,
  markPercentChange: 5,
  inTheMoney: true,
  mini: false,
  nonStandard: false,
  quantity: quantity, // Added quantity
});


describe('OrderHandlingService', () => {
  let service: OrderHandlingService;
  let mockReportingService: jasmine.SpyObj<ReportingService>;
  let mockPricingService: jasmine.SpyObj<PricingService>;
  let mockMachineLearningService: jasmine.SpyObj<MachineLearningService>;
  let mockGlobalSettingsService: jasmine.SpyObj<GlobalSettingsService>;
  let mockCartService: jasmine.SpyObj<CartService>;
  let mockPortfolioService: jasmine.SpyObj<PortfolioService>;
  let mockTradeService: jasmine.SpyObj<TradeService>;
  let mockDaytradeStrategiesService: jasmine.SpyObj<DaytradeStrategiesService>;
  let mockBacktestService: jasmine.SpyObj<BacktestService>;
  let mockStrategyBuilderService: jasmine.SpyObj<StrategyBuilderService>;
  let mockDaytradeService: jasmine.SpyObj<DaytradeService>;
  let mockMachineDaytradingService: jasmine.SpyObj<MachineDaytradingService>;

  const mockHolding: PortfolioInfoHolding = {
    name: 'AAPL',
    pl: 0,
    netLiq: 1000,
    shares: 10,
    alloc: 0.1,
    recommendation: 'None',
    buyReasons: '',
    sellReasons: '',
    buyConfidence: 0,
    sellConfidence: 0,
    prediction: null
  };

  const mockBacktestSignal = {
    date: '2023-01-10',
    close: 150,
    low: 148,
    high: 152,
    mfiLeft: 50,
    mfiPrevious: 45,
    bband80: [[0, 0], [145, 155]],
    support: [146],
    // Add other required properties if any
  };

  const mockBacktestEval = {
    signals: [mockBacktestSignal],
    returns: 0.1,
    averageTrade: 0.01,
    averageHoldingPeriod: 5,
    profitableTrades: 10,
    totalTrades: 15,
    winRate: 0.66,
    recommendation: 'Buy',
    algo: 'daily-indicators',
    stock: 'AAPL',
    startDate: '2023-01-01',
    endDate: '2023-01-10'
  };

  const mockBalance = {
    cashBalance: 10000,
    availableFunds: 10000,
    buyingPower: 20000,
    liquidationValue: 15000
  };

  const mockPrice = (symbol: string, lastPrice: number, askPrice: number, bidPrice: number, closePrice: number) => ({
    [symbol]: {
      quote: {
        lastPrice: lastPrice,
        askPrice: askPrice,
        bidPrice: bidPrice,
        closePrice: closePrice,
        volume: 1000000 // Example volume
      }
    }
  });

  beforeEach(() => {
    mockReportingService = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
    mockPricingService = jasmine.createSpyObj('PricingService', ['getPricing']);
    mockMachineLearningService = jasmine.createSpyObj('MachineLearningService', ['trainDaytrade']);
    mockGlobalSettingsService = jasmine.createSpyObj('GlobalSettingsService', ['daytradeAlgo']);
    mockCartService = jasmine.createSpyObj('CartService', ['portfolioBuy', 'getBuyOrders', 'getOtherOrders', 'getMaxTradeCount', 'updateOrder', 'deleteDaytrade']);
    mockPortfolioService = jasmine.createSpyObj('PortfolioService', ['getTdPortfolio', 'sendMultiOrderSell', 'sendOptionBuy']);
    mockDaytradeStrategiesService = jasmine.createSpyObj('DaytradeStrategiesService', ['shouldSkip', 'isPotentialBuy', 'isPotentialSell']);
    mockBacktestService = jasmine.createSpyObj('BacktestService', ['getBacktestEvaluation', 'getLastPriceTiingo', 'getDaytradeRecommendation']);
    mockStrategyBuilderService = jasmine.createSpyObj('StrategyBuilderService', ['findOptionsPrice']);
    mockDaytradeService = jasmine.createSpyObj('DaytradeService', ['sendSell', 'sendBuy', 'sendOptionSell']);
    mockMachineDaytradingService = jasmine.createSpyObj('MachineDaytradingService', ['getPortfolioBalance']);

    TestBed.configureTestingModule({
      providers: [
        OrderHandlingService,
        { provide: ReportingService, useValue: mockReportingService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: MachineLearningService, useValue: mockMachineLearningService },
        { provide: GlobalSettingsService, useValue: mockGlobalSettingsService },
        { provide: CartService, useValue: mockCartService },
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: DaytradeStrategiesService, useValue: mockDaytradeStrategiesService },
        { provide: BacktestService, useValue: mockBacktestService },
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
        { provide: DaytradeService, useValue: mockDaytradeService },
        { provide: MachineDaytradingService, useValue: mockMachineDaytradingService },
      ]
    });
    service = TestBed.inject(OrderHandlingService);

    // Default mock implementations
    mockCartService.getBuyOrders.and.returnValue([]);
    mockCartService.getOtherOrders.and.returnValue([]);
    mockCartService.getMaxTradeCount.and.returnValue(10);
    mockBacktestService.getBacktestEvaluation.and.returnValue(of(mockBacktestEval));
    mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('AAPL', 150, 150.1, 150, 149)));
    mockBacktestService.getDaytradeRecommendation.and.returnValue({ recommendation: 'Buy' } as Recommendation); // Use returnValue for Promises
    mockPortfolioService.getTdPortfolio.and.returnValue(of([]));
    mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of(mockBalance));
    mockStrategyBuilderService.findOptionsPrice.and.callFake((bid, ask) => (bid + ask) / 2); // Simple average for testing
    mockDaytradeService.sendSell.and.callFake((order, type, resolve, reject, handleNotFound) => resolve());
    mockDaytradeService.sendBuy.and.callFake((order, type, resolve, reject) => resolve());
    mockDaytradeService.sendOptionSell.and.callFake((symbol, quantity, price, resolve, reject, handleNotFound) => resolve());
    mockPortfolioService.sendOptionBuy.and.returnValue(of({})); // Mock successful option buy
    mockPortfolioService.sendMultiOrderSell.and.returnValue(of({})); // Mock successful multi-leg sell
    mockPricingService.getPricing.and.returnValue({ callsTotalPrice: 100, putsTotalPrice: 90 }); // Mock pricing result
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getStopLoss', () => {
    it('should calculate profit taking and stop loss thresholds', () => {
      const result = service.getStopLoss(100, 110); // 10% gain potential
      expect(result.profitTakingThreshold).toBe(0.05); // Half of the potential gain
      expect(result.stopLoss).toBe(-0.05); // Negative of profit taking
    });

    it('should handle zero low value gracefully (avoid division by zero)', () => {
      // Although unlikely in real data, test edge case
      const result = service.getStopLoss(0, 10);
      // Expect NaN or Infinity depending on how division by zero is handled, or a default/error state
      // Let's assume it results in 0 for safety, or check specific implementation if needed
      expect(result.profitTakingThreshold).toBe(10000); // Or Infinity, or 0 based on implementation
      expect(result.stopLoss).toBe(-10000); // Or -Infinity, or 0
    });
  });

  describe('getTechnicalIndicators', () => {
    it('should call backtestService.getBacktestEvaluation with correct parameters', () => {
      const stock = 'MSFT';
      const startDate = '2023-01-01';
      const currentDate = '2023-10-10';
      service.getTechnicalIndicators(stock, startDate, currentDate);
      expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalledWith(stock, startDate, currentDate, 'daily-indicators');
    });
  });

  describe('addBuy', () => {
    it('should call getTechnicalIndicators and cartService.portfolioBuy if trade limit not reached', async () => {
      mockCartService.getBuyOrders.and.returnValue([]); // 0 buy orders
      mockCartService.getOtherOrders.and.returnValue([]); // 0 other orders
      mockCartService.getMaxTradeCount.and.returnValue(5); // Limit is 5

      await service.addBuy(mockHolding, 0.1, 'Test Buy');

      expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalledWith(mockHolding.name, jasmine.any(String), jasmine.any(String), 'daily-indicators');
      expect(mockCartService.portfolioBuy).toHaveBeenCalledWith(mockHolding, 0.1, 0.0135, -0.0135, 'Test Buy'); // Calculated thresholds based on mockBacktestSignal
    });

    it('should NOT call cartService.portfolioBuy if trade limit is reached', async () => {
      mockCartService.getBuyOrders.and.returnValue([{}, {}, {}]); // 3 buy orders
      mockCartService.getOtherOrders.and.returnValue([{}, {}]); // 2 other orders
      mockCartService.getMaxTradeCount.and.returnValue(5); // Limit is 5

      await service.addBuy(mockHolding, 0.1, 'Test Buy');

      expect(mockBacktestService.getBacktestEvaluation).not.toHaveBeenCalled();
      expect(mockCartService.portfolioBuy).not.toHaveBeenCalled();
    });

    it('should handle errors from getTechnicalIndicators gracefully', async () => {
      mockBacktestService.getBacktestEvaluation.and.returnValue(throwError(() => new Error('API Error')));

      await service.addBuy(mockHolding, 0.1, 'Test Buy');

      expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalled();
      expect(mockCartService.portfolioBuy).not.toHaveBeenCalled();
      // Optionally check console.log or reportingService if error logging is implemented
    });
  });

  describe('hasPositions', () => {
    it('should return true if a position exists in the portfolio', async () => {
      mockPortfolioService.getTdPortfolio.and.returnValue(of([{ instrument: { symbol: 'AAPL' } } as any]));
      const result = await service.hasPositions(['AAPL', 'MSFT']);
      expect(result).toBeTruthy();
      expect(mockPortfolioService.getTdPortfolio).toHaveBeenCalled();
    });

    it('should return false if no position exists in the portfolio', async () => {
      mockPortfolioService.getTdPortfolio.and.returnValue(of([{ instrument: { symbol: 'GOOG' } } as any]));
      const result = await service.hasPositions(['AAPL', 'MSFT']);
      expect(result).toBeFalsy();
      expect(mockPortfolioService.getTdPortfolio).toHaveBeenCalled();
    });

    it('should return false if portfolio is empty', async () => {
      mockPortfolioService.getTdPortfolio.and.returnValue(of([]));
      const result = await service.hasPositions(['AAPL', 'MSFT']);
      expect(result).toBeFalsy();
      expect(mockPortfolioService.getTdPortfolio).toHaveBeenCalled();
    });
  });

  describe('initializeOrder', () => {
    it('should initialize order properties', () => {
      const order = createMockOrder({
        previousOrders: [{ /* some previous order */ } as any],
        errors: ['some error'],
        warnings: ['some warning']
      });
      const initializedOrder = service.initializeOrder(order);
      expect(initializedOrder.previousOrders).toEqual([]);
      expect(initializedOrder.errors).toEqual([]);
      expect(initializedOrder.warnings).toEqual([]);
    });
  });

  describe('sendSell', () => {
    let order: SmartOrder;
    let lastPrice: number;

    beforeEach(() => {
      order = createMockOrder({ side: 'Sell', quantity: 5 });
      lastPrice = 155;
      // Reset spy calls for each test in this describe block if needed
      mockDaytradeService.sendSell.calls.reset();
      mockReportingService.addAuditLog.calls.reset();
    });

    it('should set order price, call incrementSell, and daytradeService.sendSell', () => {
      const returnedOrder = service.sendSell(order, lastPrice);
      expect(returnedOrder.price).toBe(155);
      expect(mockCartService.updateOrder).toHaveBeenCalled(); // Check incrementSell side effect
      expect(mockDaytradeService.sendSell).toHaveBeenCalledWith(order, 'limit', jasmine.any(Function), jasmine.any(Function), jasmine.any(Function));
      expect(returnedOrder).toBe(order); // Should return the modified order
    });

    it('should handle resolve callback correctly', () => {
      let resolveFn;
      mockDaytradeService.sendSell.and.callFake((o, t, resolve, reject, notFound) => {
        resolveFn = resolve;
      });
      service.sendSell(order, lastPrice);
      resolveFn(); // Manually trigger the resolve callback
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(order.holding.symbol, `SELL ORDER SENT ${order.side} ${order.quantity} ${order.holding.symbol}@${order.price}`);
    });

    it('should handle reject callback correctly', () => {
      let rejectFn;
      const error = { _body: 'Insufficient shares' };
      mockDaytradeService.sendSell.and.callFake((o, t, resolve, reject, notFound) => {
        rejectFn = reject;
      });
      const returnedOrder = service.sendSell(order, lastPrice);
      rejectFn(error); // Manually trigger the reject callback
      expect(returnedOrder.stopped).toBeTruthy();
      expect(returnedOrder.errors).toContain(error._body);
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(order.holding.symbol, JSON.stringify(error._body));
    });

    it('should handle notFound callback correctly', () => {
      let notFoundFn;
      mockDaytradeService.sendSell.and.callFake((o, t, resolve, reject, notFound) => {
        notFoundFn = notFound;
      });
      const returnedOrder = service.sendSell(order, lastPrice);
      notFoundFn(); // Manually trigger the notFound callback
      const expectedWarning = `Trying to sell position that doesn\'t exists ${order.holding.name}`;
      expect(returnedOrder.stopped).toBeTruthy();
      expect(returnedOrder.warnings).toContain(expectedWarning);
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(order.holding.symbol, expectedWarning);
    });

    it('should return the original order if input order is null/undefined', () => {
      const result = service.sendSell(null, lastPrice);
      expect(result).toBeNull();
      expect(mockDaytradeService.sendSell).not.toHaveBeenCalled();
    });
  });

  describe('hasReachedOrderLimit', () => {
    it('should return true for daytrade when buy and sell counts meet quantity', () => {
      const order = createMockOrder({ side: 'Daytrade', quantity: 10, buyCount: 10, sellCount: 10 });
      expect(service.hasReachedOrderLimit(order)).toBeTruthy();
    });

    it('should return false for daytrade when counts dont meet quantity', () => {
      const order = createMockOrder({ side: 'Daytrade', quantity: 10, buyCount: 9, sellCount: 10 });
      expect(service.hasReachedOrderLimit(order)).toBeFalsy();
    });

    it('should return true for buy when buy count meets quantity', () => {
      const order = createMockOrder({ side: 'Buy', quantity: 5, buyCount: 5 });
      expect(service.hasReachedOrderLimit(order)).toBeTruthy();
    });

    it('should return false for buy when buy count is less than quantity', () => {
      const order = createMockOrder({ side: 'Buy', quantity: 5, buyCount: 4 });
      expect(service.hasReachedOrderLimit(order)).toBeFalsy();
    });

    it('should return true for sell when sell count meets quantity', () => {
      const order = createMockOrder({ side: 'Sell', quantity: 8, sellCount: 8 });
      expect(service.hasReachedOrderLimit(order)).toBeTruthy();
    });

    it('should return false for sell when sell count is less than quantity', () => {
      const order = createMockOrder({ side: 'Sell', quantity: 8, sellCount: 7 });
      expect(service.hasReachedOrderLimit(order)).toBeFalsy();
    });
  });

  describe('buyOptions', () => {
    let callOption: Options;
    let putOption: Options;
    let singleLegOrder: SmartOrder;
    let multiLegOrder: SmartOrder;

    beforeEach(() => {
      callOption = createMockOption('AAPL_C', 'C', 1, 'AAPL 2024/01/01 150 C');
      putOption = createMockOption('AAPL_P', 'P', 1, 'AAPL 2024/01/01 140 P');
      singleLegOrder = createMockOrder({
        type: OrderTypes.call,
        side: 'Buy',
        primaryLegs: [callOption],
        quantity: 1 // Ensure quantity matches leg quantity for single leg
      });
      multiLegOrder = createMockOrder({
        type: OrderTypes.strangle, // Example multi-leg type
        side: 'Buy', // Assuming buying a strangle (though usually sold)
        primaryLegs: [callOption],
        secondaryLegs: [putOption],
        quantity: 1 // Represents number of contracts for each leg
      });

      // Mock getEstimatedPrice for options
      mockBacktestService.getLastPriceTiingo.and.callFake((arg) => {
              if (arg.symbol === callOption.symbol ) {
                return of(mockPrice(callOption.symbol, 1.05, 1.1, 1.0, 1.0));
              } else if (arg.symbol === putOption.symbol) {
                return of(mockPrice(putOption.symbol, 0.95, 1.0, 0.9, 0.9));
              }
              return undefined;
            });
      mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of({ ...mockBalance, cashBalance: 500 })); // Sufficient balance
    });

    it('should buy single leg option if balance is sufficient', async () => {
      const returnedOrder = await service.buyOptions(singleLegOrder);
      const expectedPrice = 1.05; // (1.0 + 1.1) / 2
      expect(mockMachineDaytradingService.getPortfolioBalance).toHaveBeenCalled();
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: callOption.symbol });
      expect(mockPortfolioService.sendOptionBuy).toHaveBeenCalledWith(callOption.symbol, 1, expectedPrice, false);
      expect(mockCartService.updateOrder).toHaveBeenCalled(); // incrementBuy called
      expect(returnedOrder.buyCount).toBe(1);
    });

    it('should buy multi-leg option if balance is sufficient', async () => {
      const returnedOrder = await service.buyOptions(multiLegOrder);
      const callPrice = 1.05;
      const putPrice = 0.95;
      const totalPrice = (callPrice * 1) + (putPrice * 1);
      expect(mockMachineDaytradingService.getPortfolioBalance).toHaveBeenCalled();
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: callOption.symbol });
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: putOption.symbol });
      expect(mockPortfolioService.sendOptionBuy).toHaveBeenCalledWith(callOption.symbol, 1, callPrice, false);
      expect(mockPortfolioService.sendOptionBuy).toHaveBeenCalledWith(putOption.symbol, 1, putPrice, false);
      expect(mockCartService.updateOrder).toHaveBeenCalled(); // incrementBuy called
      expect(returnedOrder.buyCount).toBe(1); // incrementBuy is called once per buyOptions call
    });

    it('should NOT buy single leg option if balance is insufficient', async () => {
      mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of({ ...mockBalance, cashBalance: 1 })); // Insufficient balance (option price * 100 multiplier)
      const returnedOrder = await service.buyOptions(singleLegOrder);
      expect(mockPortfolioService.sendOptionBuy).not.toHaveBeenCalled();
      expect(mockCartService.updateOrder).not.toHaveBeenCalled(); // incrementBuy not called
      expect(returnedOrder.buyCount).toBe(0);
    });

     it('should NOT buy multi-leg option if balance is insufficient', async () => {
      mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of({ ...mockBalance, cashBalance: 150 })); // Insufficient balance (call + put) * 100
      const returnedOrder = await service.buyOptions(multiLegOrder);
      const callPrice = 1.05;
      const putPrice = 0.95;
      const totalPrice = (callPrice * 1) + (putPrice * 1);
      expect(mockPortfolioService.sendOptionBuy).not.toHaveBeenCalled();
      expect(mockCartService.updateOrder).not.toHaveBeenCalled(); // incrementBuy not called
      expect(returnedOrder.buyCount).toBe(0);
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(multiLegOrder.holding.symbol, `Total Price with secondary leg ${totalPrice}, balance: 150`); // Log still happens
    });
  });

  describe('sellOptions', () => {
    let callOption: Options;
    let order: SmartOrder;

    beforeEach(() => {
      callOption = createMockOption('AAPL_C', 'C', 1, 'AAPL 2024/01/01 150 C');
      order = createMockOrder({
        type: OrderTypes.call,
        side: 'Sell',
        primaryLegs: [callOption],
        quantity: 1
      });
      mockBacktestService.getLastPriceTiingo.and.callFake((arg) => {
        if (arg.symbol === callOption.symbol  ) {
          return of(mockPrice(callOption.symbol, 1.05, 1.1, 1.0, 1.0));
        }
        return undefined;
      });

      mockDaytradeService.sendOptionSell.calls.reset();
      mockReportingService.addAuditLog.calls.reset();
    });

    it('should call incrementSell, getEstimatedPrice, and daytradeService.sendOptionSell', async () => {
      const returnedOrder = await service.sellOptions(order);
      const expectedPrice = 1.05; // (1.0 + 1.1) / 2
      expect(mockCartService.updateOrder).toHaveBeenCalled(); // incrementSell called
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: callOption.symbol });
      expect(mockDaytradeService.sendOptionSell).toHaveBeenCalledWith(callOption.symbol, 1, expectedPrice, jasmine.any(Function), jasmine.any(Function), jasmine.any(Function));
      expect(returnedOrder.sellCount).toBe(1);
    });

    it('should handle resolve callback correctly', async () => {
      let resolveFn;
      mockDaytradeService.sendOptionSell.and.callFake((sym, qty, price, resolve, reject, notFound) => {
        resolveFn = resolve;
      });
      await service.sellOptions(order);
      resolveFn(); // Manually trigger resolve
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(callOption.symbol, `Sell option sent ${order.quantity} ${callOption.symbol}`);
    });

     it('should handle reject callback correctly', async () => {
      let rejectFn;
      const error = { _body: 'Order rejected' };
      mockDaytradeService.sendOptionSell.and.callFake((sym, qty, price, resolve, reject, notFound) => {
        rejectFn = reject;
      });
      const returnedOrder = await service.sellOptions(order);
      rejectFn(error); // Manually trigger reject
      expect(returnedOrder.stopped).toBeTruthy();
      expect(returnedOrder.errors).toContain(error._body);
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(callOption.symbol, JSON.stringify(error._body));
    });

    it('should handle notFound callback correctly', async () => {
      let notFoundFn;
      mockDaytradeService.sendOptionSell.and.callFake((sym, qty, price, resolve, reject, notFound) => {
        notFoundFn = notFound;
      });
      const returnedOrder = await service.sellOptions(order);
      notFoundFn(); // Manually trigger notFound
      const expectedError = `Trying to sell position that doesn\'t exists ${callOption.symbol}`;
      expect(returnedOrder.stopped).toBeTruthy();
      expect(returnedOrder.errors).toContain(expectedError); // Should be errors, not warnings based on code
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(callOption.symbol, expectedError);
    });
  });

  describe('handleIntradayRecommendation', () => {
    let buyOrderStock: SmartOrder;
    let sellOrderStock: SmartOrder;
    let buyOrderCall: SmartOrder;
    let sellOrderCall: SmartOrder;
    let buyOrderPut: SmartOrder;
    let sellOrderPut: SmartOrder;
    let sellOrderStrangle: SmartOrder;
    let buyAnalysis: Recommendation;
    let sellAnalysis: Recommendation;
    let noneAnalysis: Recommendation;

    beforeEach(() => {
      buyOrderStock = createMockOrder({ side: 'Buy', holding: { symbol: 'MSFT' } });
      sellOrderStock = createMockOrder({ side: 'Sell', holding: { symbol: 'MSFT' } });
      const callOption = createMockOption('MSFT_C', 'C', 1, 'MSFT C');
      const putOption = createMockOption('MSFT_P', 'P', 1, 'MSFT P');
      buyOrderCall = createMockOrder({ side: 'Buy', type: OrderTypes.call, primaryLegs: [callOption], holding: { symbol: 'MSFT' } });
      sellOrderCall = createMockOrder({ side: 'Sell', type: OrderTypes.call, primaryLegs: [callOption], holding: { symbol: 'MSFT' } });
      buyOrderPut = createMockOrder({ side: 'Buy', type: OrderTypes.put, primaryLegs: [putOption], holding: { symbol: 'MSFT' } });
      sellOrderPut = createMockOrder({ side: 'Sell', type: OrderTypes.put, primaryLegs: [putOption], holding: { symbol: 'MSFT' } });
      sellOrderStrangle = createMockOrder({ side: 'Sell', type: OrderTypes.strangle, primaryLegs: [callOption], secondaryLegs: [putOption], holding: { symbol: 'MSFT' } });

      buyAnalysis = { recommendation: 'Buy' } as Recommendation;
      sellAnalysis = { recommendation: 'Sell' } as Recommendation;
      noneAnalysis = { recommendation: 'None' } as Recommendation;

      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199)));
      mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of({ ...mockBalance, cashBalance: 3000 })); // Sufficient balance for stock
      spyOn(service, 'buyOptions').and.callThrough();
      spyOn(service, 'sellOptions').and.callThrough();
      spyOn(service, 'sendSell').and.callThrough();
      spyOn(service, 'sellStrangle').and.callThrough();
    });

    it('should return immediately if order is stopped', async () => {
      buyOrderStock.stopped = true;
      const result = await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(mockBacktestService.getLastPriceTiingo).not.toHaveBeenCalled();
      expect(result).toBe(buyOrderStock);
    });

    it('should return immediately if analysis is None', async () => {
      const result = await service.handleIntradayRecommendation(buyOrderStock, noneAnalysis);
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalled(); // Price is still fetched
      expect(service.buyOptions).not.toHaveBeenCalled();
      expect(service.sellOptions).not.toHaveBeenCalled();
      expect(service.sendSell).not.toHaveBeenCalled();
      expect(result).toBe(buyOrderStock);
    });

    it('should stop order if limit is reached', async () => {
      buyOrderStock.buyCount = buyOrderStock.quantity; // Limit reached
      const result = await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(result.stopped).toBeTruthy();
    });

    // --- Stock Orders ---
    it('should set priceLowerBound for stock buy on first call', async () => {
      const result = await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(result.priceLowerBound).toBe(200);
      expect(mockDaytradeService.sendBuy).not.toHaveBeenCalled();
    });

    it('should send stock buy if recommendation is Buy and price > lowerBound', async () => {
      buyOrderStock.priceLowerBound = 199; // Set lower bound
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199))); // Current price > lower bound
      const result = await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(mockMachineDaytradingService.getPortfolioBalance).toHaveBeenCalled();
      expect(mockDaytradeService.sendBuy).toHaveBeenCalledWith(buyOrderStock, 'limit', jasmine.any(Function), jasmine.any(Function));
      expect(result.buyCount).toBe(buyOrderStock.quantity);
    });

    it('should NOT send stock buy if price <= lowerBound', async () => {
      buyOrderStock.priceLowerBound = 201; // Set lower bound
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199))); // Current price <= lower bound
      await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(mockDaytradeService.sendBuy).not.toHaveBeenCalled();
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith('MSFT', 'Price too low. Current:200 Expected:201');
    });

     it('should NOT send stock buy if balance is insufficient', async () => {
      buyOrderStock.priceLowerBound = 199;
      mockMachineDaytradingService.getPortfolioBalance.and.returnValue(of({ ...mockBalance, cashBalance: 100 })); // Insufficient (10 * 200 = 2000 needed)
      await service.handleIntradayRecommendation(buyOrderStock, buyAnalysis);
      expect(mockDaytradeService.sendBuy).not.toHaveBeenCalled();
    });

    it('should send stock sell if recommendation is Sell', async () => {
      const result = await service.handleIntradayRecommendation(sellOrderStock, sellAnalysis);
      expect(service.sendSell).toHaveBeenCalledWith(sellOrderStock, 200);
      expect(result.sellCount).toBe(sellOrderStock.quantity);
    });

    // --- Call Option Orders ---
    it('should set priceLowerBound for call buy on first call', async () => {
      const result = await service.handleIntradayRecommendation(buyOrderCall, buyAnalysis);
      expect(result.priceLowerBound).toBe(200); // Using stock price for now, might need adjustment if option price is used
      expect(service.buyOptions).not.toHaveBeenCalled();
    });

    it('should buy call option if recommendation is Buy and price > lowerBound', async () => {
      buyOrderCall.priceLowerBound = 199;
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199)));
      await service.handleIntradayRecommendation(buyOrderCall, buyAnalysis);
      expect(service.buyOptions).toHaveBeenCalledWith(buyOrderCall);
    });

     it('should NOT buy call option if price <= lowerBound', async () => {
      buyOrderCall.priceLowerBound = 201;
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199)));
      await service.handleIntradayRecommendation(buyOrderCall, buyAnalysis);
      expect(service.buyOptions).not.toHaveBeenCalled();
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith('MSFT', 'Price too low. Current:200 Expected:201');
    });

    it('should sell call option if recommendation is Sell', async () => {
      await service.handleIntradayRecommendation(sellOrderCall, sellAnalysis);
      expect(service.sellOptions).toHaveBeenCalledWith(sellOrderCall);
    });

    // --- Put Option Orders ---
     it('should set priceLowerBound for put buy on first call', async () => {
      const result = await service.handleIntradayRecommendation(buyOrderPut, sellAnalysis); // Buy put on sell recommendation
      expect(result.priceLowerBound).toBe(200);
      expect(service.buyOptions).not.toHaveBeenCalled();
    });

    it('should buy put option if recommendation is Sell and price < lowerBound', async () => {
      buyOrderPut.priceLowerBound = 201; // Buy if price drops below
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199)));
      await service.handleIntradayRecommendation(buyOrderPut, sellAnalysis);
      expect(service.buyOptions).toHaveBeenCalledWith(buyOrderPut);
    });

     it('should NOT buy put option if price >= lowerBound', async () => {
      buyOrderPut.priceLowerBound = 199;
      mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockPrice('MSFT', 200, 200.1, 200, 199)));
      await service.handleIntradayRecommendation(buyOrderPut, sellAnalysis);
      expect(service.buyOptions).not.toHaveBeenCalled();
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith('MSFT', 'Price too low. Current:200 Expected199'); // Log message seems reversed in code
    });

    it('should sell put option if recommendation is Buy', async () => {
      await service.handleIntradayRecommendation(sellOrderPut, buyAnalysis);
      expect(service.sellOptions).toHaveBeenCalledWith(sellOrderPut);
    });

    // --- Strangle Orders ---
    it('should sell strangle if type is Strangle and side is Sell', async () => {
      // Test relies on sellStrangle internal logic, just check if it's called
      await service.handleIntradayRecommendation(sellOrderStrangle, buyAnalysis); // Example analysis
      expect(service.sellStrangle).toHaveBeenCalledWith(sellOrderStrangle, buyAnalysis);
    });
  });

  describe('incrementSell', () => {
    it('should increment sellCount, decrement positionCount, and update order', () => {
      const order = createMockOrder({ quantity: 5, sellCount: 2, positionCount: 10 });
      const returnedOrder = service.incrementSell(order);
      expect(returnedOrder.sellCount).toBe(7); // 2 + 5
      expect(returnedOrder.positionCount).toBe(5); // 10 - 5
      expect(mockCartService.updateOrder).toHaveBeenCalledWith(returnedOrder);
    });
  });

  describe('incrementBuy', () => {
    it('should increment buyCount, increment positionCount, and update order', () => {
      const order = createMockOrder({ quantity: 3, buyCount: 1, positionCount: -2 });
      const returnedOrder = service.incrementBuy(order);
      expect(returnedOrder.buyCount).toBe(4); // 1 + 3
      expect(returnedOrder.positionCount).toBe(1); // -2 + 3
      expect(mockCartService.updateOrder).toHaveBeenCalledWith(returnedOrder);
    });
  });

  describe('sendSellStrangle', () => {
    let order: SmartOrder;
    let calls: Options[];
    let puts: Options[];

    beforeEach(() => {
      calls = [createMockOption('MSFT_C1', 'C', 1, 'MSFT C1')];
      puts = [createMockOption('MSFT_P1', 'P', 1, 'MSFT P1')];
      order = createMockOrder({ type: OrderTypes.strangle, side: 'Sell', primaryLegs: calls, secondaryLegs: puts });
      spyOn(service, 'hasPositions').and.returnValue(true); // Assume position exists by default
    });

    it('should call hasPositions, sendMultiOrderSell, and incrementSell if position exists', async () => {
      const returnedOrder = await service.sendSellStrangle(order, calls, puts, 100, 90);
      expect(service.hasPositions).toHaveBeenCalledWith(['MSFT_C1', 'MSFT_P1']);
      expect(mockPortfolioService.sendMultiOrderSell).toHaveBeenCalledWith(calls, puts, 190);
      expect(mockCartService.updateOrder).toHaveBeenCalled(); // incrementSell called
      expect(returnedOrder.sellCount).toBe(order.quantity);
    });

    it('should NOT call sendMultiOrderSell or incrementSell if position does not exist', async () => {
      (service.hasPositions as jasmine.Spy).and.returnValue(false);
      const returnedOrder = await service.sendSellStrangle(order, calls, puts, 100, 90);
      expect(service.hasPositions).toHaveBeenCalledWith(['MSFT_C1', 'MSFT_P1']);
      expect(mockPortfolioService.sendMultiOrderSell).not.toHaveBeenCalled();
      expect(mockCartService.updateOrder).not.toHaveBeenCalled(); // incrementSell not called
      expect(returnedOrder.sellCount).toBe(0);
    });
  });

  describe('sellStrangle', () => {
    let order: SmartOrder;
    let calls: Options[];
    let puts: Options[];
    let buyAnalysis: Recommendation;
    let sellAnalysis: Recommendation;

     beforeEach(() => {
      calls = [createMockOption('MSFT_C1', 'C', 1, 'MSFT C1')];
      puts = [createMockOption('MSFT_P1', 'P', 1, 'MSFT P1')];
      order = createMockOrder({ type: OrderTypes.strangle, side: 'Sell', primaryLegs: calls, secondaryLegs: puts });
      buyAnalysis = { recommendation: 'Buy' } as Recommendation;
      sellAnalysis = { recommendation: 'Sell' } as Recommendation;
      spyOn(service, 'sendSellStrangle').and.callThrough();
    });

    it('should call pricingService.getPricing', async () => {
      await service.sellStrangle(order, buyAnalysis);
      expect(mockPricingService.getPricing).toHaveBeenCalledWith(calls, puts);
    });

    it('should call sendSellStrangle if calls > puts and recommendation is Sell', async () => {
      mockPricingService.getPricing.and.returnValue({ callsTotalPrice: 100, putsTotalPrice: 50 });
      await service.sellStrangle(order, sellAnalysis);
      expect(service.sendSellStrangle).toHaveBeenCalledWith(order, calls, puts, 100, 50);
    });

    it('should NOT call sendSellStrangle if calls > puts and recommendation is Buy', async () => {
      mockPricingService.getPricing.and.returnValue({ callsTotalPrice: 100, putsTotalPrice: 50 });
      await service.sellStrangle(order, buyAnalysis);
      expect(service.sendSellStrangle).not.toHaveBeenCalled();
    });

     it('should call sendSellStrangle if puts >= calls and recommendation is Buy', async () => {
      mockPricingService.getPricing.and.returnValue({ callsTotalPrice: 50, putsTotalPrice: 100 });
      await service.sellStrangle(order, buyAnalysis);
      expect(service.sendSellStrangle).toHaveBeenCalledWith(order, calls, puts, 50, 100);
    });

     it('should NOT call sendSellStrangle if puts >= calls and recommendation is Sell', async () => {
      mockPricingService.getPricing.and.returnValue({ callsTotalPrice: 50, putsTotalPrice: 100 });
      await service.sellStrangle(order, sellAnalysis);
      expect(service.sendSellStrangle).not.toHaveBeenCalled();
    });
  });

  describe('intradayStep', () => {
    let order: SmartOrder;

    beforeEach(() => {
      order = createMockOrder({ holding: { symbol: 'GOOG' } });
      mockDaytradeStrategiesService.shouldSkip.and.returnValue(false);
      mockBacktestService.getDaytradeRecommendation.and.returnValue({ recommendation: 'Buy' } as Recommendation);
      mockDaytradeStrategiesService.isPotentialBuy.and.returnValue(true);
      mockDaytradeStrategiesService.isPotentialSell.and.returnValue(false);
      spyOn(service, 'handleIntradayRecommendation').and.returnValue(order); // Use returnValue for async spy
      // spyOn(service, 'trainIntradayModel').and.returnValue(); // Spy on train model
      service.skipMl = true; // Ensure ML training is skipped by default in tests
    });

    it('should not proceed if shouldSkip returns true', async () => {
      mockDaytradeStrategiesService.shouldSkip.and.returnValue(true);
      await service.intradayStep(order);
      expect(mockBacktestService.getDaytradeRecommendation).not.toHaveBeenCalled();
    });

    it('should call getDaytradeRecommendation if not skipped', async () => {
      await service.intradayStep(order);
      expect(mockBacktestService.getDaytradeRecommendation).toHaveBeenCalledWith('GOOG', null, null, { minQuotes: 81 });
    });

    it('should call handleIntradayRecommendation if potential buy/sell exists', async () => {
      const analysis = { recommendation: 'Buy' } as Recommendation;
      mockBacktestService.getDaytradeRecommendation.and.returnValue(analysis);
      mockDaytradeStrategiesService.isPotentialBuy.and.returnValue(true);
      await service.intradayStep(order);
      expect(mockDaytradeStrategiesService.isPotentialBuy).toHaveBeenCalledWith(analysis);
      expect(mockDaytradeStrategiesService.isPotentialSell).toHaveBeenCalledWith(analysis);
      expect(service.handleIntradayRecommendation).toHaveBeenCalledWith(order, analysis);
    });

    it('should NOT call handleIntradayRecommendation if no potential buy/sell exists', async () => {
      mockDaytradeStrategiesService.isPotentialBuy.and.returnValue(false);
      mockDaytradeStrategiesService.isPotentialSell.and.returnValue(false);
      await service.intradayStep(order);
      expect(service.handleIntradayRecommendation).not.toHaveBeenCalled();
    });

    // Skipping ML training test for now due to complexity and skipMl flag
  });

  describe('getEstimatedPrice', () => {
    const symbol = 'TSLA';
    const mockTslaPrice = mockPrice(symbol, 700, 700.2, 700, 698);

    beforeEach(() => {
      mockBacktestService.getLastPriceTiingo.and.callFake((arg) => {
        if (arg.symbol === symbol ) {
          return of(mockTslaPrice);
        }
        return undefined;
      });
       mockStrategyBuilderService.findOptionsPrice.and.callFake((bid, ask) => (bid + ask) / 2);
    });

    it('should call getLastPriceTiingo and findOptionsPrice', async () => {
      await service.getEstimatedPrice(symbol);
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: symbol });
      expect(mockStrategyBuilderService.findOptionsPrice).toHaveBeenCalledWith(700, 700.2);
    });

    it('should return the calculated price', async () => {
      const price = await service.getEstimatedPrice(symbol);
      expect(price).toBe(700.1); // (700 + 700.2) / 2
    });
  });

  describe('buyOption', () => {
    const symbol = 'AMZN_C';
    const quantity = 2;

    beforeEach(() => {
      spyOn(service, 'getEstimatedPrice').and.returnValue(5.5);
      mockPortfolioService.sendOptionBuy.and.returnValue(of({ success: true }));
      mockPortfolioService.sendOptionBuy.calls.reset();
    });

    it('should call getEstimatedPrice if price is not provided', async () => {
      await service.buyOption(symbol, quantity);
      expect(service.getEstimatedPrice).toHaveBeenCalledWith(symbol);
      expect(mockPortfolioService.sendOptionBuy).toHaveBeenCalledWith(symbol, quantity, 5.5, false);
    });

    it('should use provided estimatedPrice', async () => {
      const providedPrice = 6.0;
      await service.buyOption(symbol, quantity, providedPrice);
      expect(service.getEstimatedPrice).not.toHaveBeenCalled();
      expect(mockPortfolioService.sendOptionBuy).toHaveBeenCalledWith(symbol, quantity, providedPrice, false);
    });

    it('should call the callback function on success', async () => {
      const callbackSpy = jasmine.createSpy('callback');
      await service.buyOption(symbol, quantity, null, callbackSpy);
      // Need to ensure the observable completes for the callback to be called
      // In a real scenario, might need fakeAsync/tick or handle the async nature appropriately
      // For this mock, assuming sendOptionBuy completes synchronously for the test
      expect(callbackSpy).toHaveBeenCalled();
    });

    it('should log success message', async () => {
       spyOn(console, 'log');
       await service.buyOption(symbol, quantity);
       expect(console.log).toHaveBeenCalledWith('Bought option', symbol, { success: true });
    });
  });

});
