import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import * as moment from 'moment-timezone';

import { IntradayStrategyService } from './intraday-strategy.service';
import { PriceTargetService } from '../autopilot/price-target.service';
import { BacktestService, ReportingService } from '@shared/services';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PortfolioInfoHolding } from '@shared/services';

// Mock data for BacktestService
const mockSpySignal = {
  date: '2023-11-09',
  close: 435,
  mfiLeft: 60,
  mfiPrevious: 50,
  bband80: [[0, 0], [430, 440]], // Example: [lower, upper] for the last point
  support: [432], // Example support level
  low: 433,
  high: 437
};

const mockVxxSignal = {
  date: '2023-11-09',
  close: 25,
  mfiLeft: 60,
  mfiPrevious: 50,
  bband80: [[0, 0], [24, 26]],
  support: [24.5],
  low: 24,
  high: 26
};

const mockSpyBacktest = {
  signals: [mockSpySignal],
  returns: 0,
  averageTrade: 0,
  averageHoldingPeriod: 0,
  profitableTrades: 0,
  totalTrades: 0,
  winRate: 0,
  recommendation: 'None',
  algo: 'daily-indicators',
  stock: 'SPY',
  startDate: '2023-01-01',
  endDate: '2023-11-09'
};

const mockVxxBacktest = {
  signals: [mockVxxSignal],
  returns: 0,
  averageTrade: 0,
  averageHoldingPeriod: 0,
  profitableTrades: 0,
  totalTrades: 0,
  winRate: 0,
  recommendation: 'None',
  algo: 'daily-indicators',
  stock: 'VXX',
  startDate: '2023-01-01',
  endDate: '2023-11-09'
};

const mockSpyPrice = {
  SPY: {
    quote: {
      lastPrice: 436,
      closePrice: 435,
      totalVolume: 50000000,
      askPrice: 436.1,
      bidPrice: 436.0
    }
  }
};


describe('IntradayStrategyService', () => {
  let service: IntradayStrategyService;
  let mockPriceTargetService: jasmine.SpyObj<PriceTargetService>;
  let mockBacktestService: jasmine.SpyObj<BacktestService>;
  let mockReportingService: jasmine.SpyObj<ReportingService>;
  let mockOrderHandlingService: jasmine.SpyObj<OrderHandlingService>;

  const tqqqHolding: PortfolioInfoHolding = {
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

  beforeEach(() => {
    mockPriceTargetService = jasmine.createSpyObj('PriceTargetService', ['isDownDay']);
    mockBacktestService = jasmine.createSpyObj('BacktestService', ['getBacktestEvaluation', 'getLastPriceTiingo']);
    mockReportingService = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
    mockOrderHandlingService = jasmine.createSpyObj('OrderHandlingService', ['addBuy']);

    TestBed.configureTestingModule({
      providers: [
        IntradayStrategyService,
        { provide: PriceTargetService, useValue: mockPriceTargetService },
        { provide: BacktestService, useValue: mockBacktestService },
        { provide: ReportingService, useValue: mockReportingService },
        { provide: OrderHandlingService, useValue: mockOrderHandlingService },
      ]
    });
    service = TestBed.inject(IntradayStrategyService);

    // Reset state before each test
    service.intradayStrategyTriggered = false;
    service.lastVolume = 0;
    mockOrderHandlingService.addBuy.and.returnValue(null); // Default mock for addBuy

    // Setup default mocks for backtest service
    mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
      if (arg === 'SPY') {
        return of(mockSpyBacktest);
      } else if (arg === 'VXX') {
        return of(mockVxxBacktest);
      }
      // You might want to handle other cases or throw an error if unexpected arguments are received
      return undefined;
    });

    mockBacktestService.getLastPriceTiingo.and.returnValue(of(mockSpyPrice));

    // Setup default mock for price target service
    mockPriceTargetService.isDownDay.and.returnValue(true); // Assume down day by default for relevant tests

    // Install Jasmine clock
    jasmine.clock().install();
  });

  afterEach(() => {
    // Uninstall Jasmine clock
    jasmine.clock().uninstall();
  });

  const setMockTime = (hour: number, minute: number) => {
    const baseTime = moment.tz('2023-11-09', 'America/New_York').set({ hour, minute, second: 0, millisecond: 0 });
    jasmine.clock().mockDate(baseTime.toDate());
  };

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('buyTqqq', () => {
    it('should call reportingService.addAuditLog with the reason', async () => {
      await service.buyTqqq(0.1, 'Test Reason');
      expect(mockReportingService.addAuditLog).toHaveBeenCalledWith(null, 'Test Reason');
    });

    it('should call orderHandlingService.addBuy with UPRO, allocation, and reason', async () => {
      const allocation = 0.15;
      const reason = 'Another Test Reason';
      await service.buyTqqq(allocation, reason);
      expect(mockOrderHandlingService.addBuy).toHaveBeenCalledWith(tqqqHolding, allocation, reason);
    });
  });

  describe('buyDip', () => {
    it('should not call backtestService or buyTqqq if priceTargetService.isDownDay returns false', async () => {
      mockPriceTargetService.isDownDay.and.returnValue(false);
      await service.buyDip(0.1);
      expect(mockBacktestService.getBacktestEvaluation).not.toHaveBeenCalled();
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.intradayStrategyTriggered).toBeFalsy();
    });

    it('should call backtestService for SPY and VXX if priceTargetService.isDownDay returns true', async () => {
      mockPriceTargetService.isDownDay.and.returnValue(true);
      await service.buyDip(0.1);
      expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalledWith('SPY', jasmine.any(String), jasmine.any(String), 'daily-indicators');
      expect(mockBacktestService.getBacktestEvaluation).toHaveBeenCalledWith('VXX', jasmine.any(String), jasmine.any(String), 'daily-indicators');
    });

    it('should not call buyTqqq or set trigger if SPY MFI condition is not met', async () => {
      const modifiedSpyBacktest = { ...mockSpyBacktest, signals: [{ ...mockSpySignal, mfiPrevious: 70, mfiLeft: 60 }] }; // mfiPrevious > mfiLeft

      mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
        if (arg === 'SPY') {
          return of(modifiedSpyBacktest);
        } else if (arg === 'VXX') {
          return of(mockVxxBacktest);
        }
        return undefined;
      });
      await service.buyDip(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.intradayStrategyTriggered).toBeFalsy();
    });

    it('should not call buyTqqq or set trigger if SPY BBand condition is not met', async () => {
      const modifiedSpyBacktest = { ...mockSpyBacktest, signals: [{ ...mockSpySignal, bband80: [[0, 0], [436, 440]] }] }; // bband lower > close
      mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
        if (arg === 'SPY') {
          return of(modifiedSpyBacktest);
        } else if (arg === 'VXX') {
          return of(mockVxxBacktest);
        }
        return undefined;
      });
      await service.buyDip(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.intradayStrategyTriggered).toBeFalsy();
    });

    it('should not call buyTqqq or set trigger if SPY Support condition is not met', async () => {
      const modifiedSpyBacktest = { ...mockSpyBacktest, signals: [{ ...mockSpySignal, support: [436] }] }; // support > close
      mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
        if (arg === 'SPY') {
          return of(modifiedSpyBacktest);
        } else if (arg === 'VXX') {
          return of(mockVxxBacktest);
        }
        return undefined;
      });
      await service.buyDip(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.intradayStrategyTriggered).toBeFalsy();
    });

    it('should not call buyTqqq or set trigger if VXX MFI condition is not met', async () => {
      const modifiedVxxBacktest = { ...mockVxxBacktest, signals: [{ ...mockVxxSignal, mfiPrevious: 70, mfiLeft: 60 }] }; // mfiPrevious > mfiLeft
      mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
        if (arg === 'SPY') {
          return of(mockSpyBacktest);
        } else if (arg === 'VXX') {
          return of(modifiedVxxBacktest);
        }
        return undefined;
      });
      await service.buyDip(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.intradayStrategyTriggered).toBeFalsy();
    });

    // Add similar tests for VXX BBand and Support conditions...

    it('should call buyTqqq and set trigger if all conditions are met', async () => {
      // Default mocks already satisfy the conditions
      await service.buyDip(0.1);
      expect(mockOrderHandlingService.addBuy).toHaveBeenCalledWith(tqqqHolding, 0.1, 'Buy the dip');
      expect(service.intradayStrategyTriggered).toBeTruthy();
    });
  });

  describe('buyOnVolume', () => {
    it('should call backtestService.getLastPriceTiingo for SPY', async () => {
      await service.buyOnVolume(0.1);
      expect(mockBacktestService.getLastPriceTiingo).toHaveBeenCalledWith({ symbol: 'SPY' });
    });

    it('should not call buyTqqq if volume ratio <= 10 (initial call)', async () => {
      service.lastVolume = 0; // Initial state
      await service.buyOnVolume(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      // lastVolume should be updated
      expect(service.lastVolume).toBe(mockSpyPrice.SPY.quote.totalVolume);
    });

    it('should not call buyTqqq if volume ratio <= 10 (subsequent call)', async () => {
      service.lastVolume = mockSpyPrice.SPY.quote.totalVolume / 5; // Set last volume so ratio is 5
      await service.buyOnVolume(0.1);
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      // lastVolume should be updated
      expect(service.lastVolume).toBe(mockSpyPrice.SPY.quote.totalVolume);
    });

    it('should call buyTqqq if volume ratio > 10', async () => {
      const modifiedSpyBacktest = { ...mockSpyBacktest, signals: [{ ...mockSpySignal, mfiPrevious: 50, mfiLeft: 60 }] }; // mfiPrevious < mfiLeft

      mockBacktestService.getBacktestEvaluation.and.callFake((arg) => {
        if (arg === 'SPY') {
          return of(modifiedSpyBacktest);
        } else if (arg === 'VXX') {
          return of(mockVxxBacktest);
        }
        return undefined;
      });
      service.lastVolume = mockSpyPrice.SPY.quote.totalVolume / 11; // Set last volume so ratio is 11
      await service.buyOnVolume(0.1);
      expect(mockOrderHandlingService.addBuy).toHaveBeenCalledWith(tqqqHolding, 0.1, 'Buy on volume');
      // lastVolume should be updated
      expect(service.lastVolume).toBe(mockSpyPrice.SPY.quote.totalVolume);
    });

    it('should handle lastVolume being 0 without dividing by zero', async () => {
      service.lastVolume = 0;
      await service.buyOnVolume(0.1);
      // Should not throw error and should not buy
      expect(mockOrderHandlingService.addBuy).not.toHaveBeenCalled();
      expect(service.lastVolume).toBe(mockSpyPrice.SPY.quote.totalVolume);
    });
  });

  describe('checkIntradayStrategies', () => {
    it('should return immediately if intradayStrategyTriggered is true', async () => {
      service.intradayStrategyTriggered = true;
      setMockTime(10, 40); // Time within buyDip window
      spyOn(service, 'buyDip'); // Spy on internal method
      spyOn(service, 'buyOnVolume'); // Spy on internal method

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).not.toHaveBeenCalled();
    });

    it('should call buyDip when time is 10:40 AM NY', async () => {
      setMockTime(10, 40);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).toHaveBeenCalledWith(0.1);
      expect(service.buyOnVolume).not.toHaveBeenCalled();
    });

    it('should call buyDip when time is 11:14 AM NY', async () => {
      setMockTime(11, 14);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).toHaveBeenCalledWith(0.1);
      expect(service.buyOnVolume).not.toHaveBeenCalled();
    });

    it('should not call buyDip when time is 11:15 AM NY', async () => {
      setMockTime(11, 15);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume'); // buyOnVolume should be called now

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).toHaveBeenCalledWith(0.1); // Falls into the general window
    });

    it('should not call buyDip when time is 10:34 AM NY', async () => {
      setMockTime(10, 34);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume'); // buyOnVolume should be called now

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).toHaveBeenCalledWith(0.1); // Falls into the general window
    });

    it('should set intradayStrategyTriggered to false when time is 14:50 PM NY', async () => {
      setMockTime(14, 50);
      service.intradayStrategyTriggered = true; // Set to true to see if it gets reset
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.intradayStrategyTriggered).toBeFalsy();
      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).not.toHaveBeenCalled(); // This window takes precedence
    });

    it('should call buyOnVolume when time is 14:00 PM NY', async () => {
      setMockTime(14, 0);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).toHaveBeenCalledWith(0.1);
    });

    it('should call buyOnVolume when time is 10:01 AM NY', async () => {
      setMockTime(10, 1);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).toHaveBeenCalledWith(0.1);
    });

    it('should not call buyDip or buyOnVolume when time is 09:59 AM NY', async () => {
      setMockTime(9, 59);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).not.toHaveBeenCalled();
    });

    it('should not call buyDip or buyOnVolume when time is 16:00 PM NY', async () => {
      setMockTime(16, 0);
      spyOn(service, 'buyDip');
      spyOn(service, 'buyOnVolume');

      await service.checkIntradayStrategies(0.1);

      expect(service.buyDip).not.toHaveBeenCalled();
      expect(service.buyOnVolume).not.toHaveBeenCalled();
    });
  });
});
