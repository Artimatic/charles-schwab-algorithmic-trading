import { TestBed } from '@angular/core/testing';
import { round } from 'lodash-es';
import { OptionsDataService } from '@shared/options-data.service';
import { BacktestService, CartService, PortfolioService, ReportingService } from '@shared/services';
import { Stock } from '@shared/stock.interface';
import { PotentialTrade } from './potential-trade.constant';
import * as moment from 'moment-timezone';
import { Strangle } from '@shared/models/options';
import { OrderTypes, SmartOrder } from '@shared/models/smart-order';
import { Indicators } from '@shared/stock-backtest.interface';
import { MessageService } from 'primeng/api';
import { AlwaysBuy } from '../rh-table/backtest-stocks.constant';
import { StrategyStoreService } from './strategy-store.service';
import { AllocationService } from '../allocation/allocation.service';
import { StrategyBuilderService } from './strategy-builder.service'; // Import the service itself

// Mocks for dependencies (adjust as needed if other methods are tested later)
class MockBacktestService { }
class MockOptionsDataService { }
class MockPortfolioService { }
class MockMessageService { }
class MockReportingService { }
class MockStrategyStoreService {
  getStorage(name: string) { return {}; }
}
class MockCartService { }
class MockAllocationService { }


describe('StrategyBuilderService', () => {
  let service: StrategyBuilderService;
  let mockBacktestService: MockBacktestService;
  let mockOptionsDataService: MockOptionsDataService;
  let mockPortfolioService: MockPortfolioService;
  let mockMessageService: MockMessageService;
  let mockReportingService: MockReportingService;
  let mockStrategyStoreService: MockStrategyStoreService;
  let mockCartService: MockCartService;
  let mockAllocationService: MockAllocationService;


  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StrategyBuilderService,
        { provide: BacktestService, useClass: MockBacktestService },
        { provide: OptionsDataService, useClass: MockOptionsDataService },
        { provide: PortfolioService, useClass: MockPortfolioService },
        { provide: MessageService, useClass: MockMessageService },
        { provide: ReportingService, useClass: MockReportingService },
        { provide: StrategyStoreService, useClass: MockStrategyStoreService },
        { provide: CartService, useClass: MockCartService },
        { provide: AllocationService, useClass: MockAllocationService }
      ]
    });
    service = TestBed.inject(StrategyBuilderService);
    mockBacktestService = TestBed.inject(BacktestService);
    mockOptionsDataService = TestBed.inject(OptionsDataService);
    mockPortfolioService = TestBed.inject(PortfolioService);
    mockMessageService = TestBed.inject(MessageService);
    mockReportingService = TestBed.inject(ReportingService);
    mockStrategyStoreService = TestBed.inject(StrategyStoreService);
    mockCartService = TestBed.inject(CartService);
    mockAllocationService = TestBed.inject(AllocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- Tests for findOptionsPrice ---
  describe('findOptionsPrice', () => {
    it('should calculate the average, round to one decimal, append zero, and convert to number', () => {
      const bid = 1.23;
      const ask = 1.27;
      // avg = 1.25 -> toFixed(1) = '1.3' -> '1.30' -> 1.3
      expect(service.findOptionsPrice(bid, ask)).toBe(1.3);
    });

    it('should handle prices needing rounding up', () => {
      const bid = 10.56;
      const ask = 10.58;
      // avg = 10.57 -> toFixed(1) = '10.6' -> '10.60' -> 10.6
      expect(service.findOptionsPrice(bid, ask)).toBe(10.6);
    });

    it('should handle prices needing rounding down', () => {
      const bid = 5.11;
      const ask = 5.13;
      // avg = 5.12 -> toFixed(1) = '5.1' -> '5.10' -> 5.1
      expect(service.findOptionsPrice(bid, ask)).toBe(5.1);
    });

    it('should handle cases where bid equals ask', () => {
      const bid = 2.5;
      const ask = 2.5;
      // avg = 2.5 -> toFixed(1) = '2.5' -> '2.50' -> 2.5
      expect(service.findOptionsPrice(bid, ask)).toBe(2.5);
    });

    it('should handle small numbers correctly', () => {
      const bid = 0.04;
      const ask = 0.08;
      // avg = 0.06 -> toFixed(1) = '0.1' -> '0.10' -> 0.1
      expect(service.findOptionsPrice(bid, ask)).toBe(0.1);
    });

    it('should handle large numbers correctly', () => {
      const bid = 1500.42;
      const ask = 1500.84;
      // avg = 1500.63 -> toFixed(1) = '1500.6' -> '1500.60' -> 1500.6
      expect(service.findOptionsPrice(bid, ask)).toBe(1500.6);
    });

    it('should return the bid price if the calculated price is 0', () => {
      const bid = 0;
      const ask = 0;
      // avg = 0 -> toFixed(1) = '0.0' -> '0.00' -> 0. Since 0 is falsy, return bid (0).
      expect(service.findOptionsPrice(bid, ask)).toBe(0); // Returns bid
    });

    it('should return the bid price if the calculated price is somehow NaN (though unlikely with number inputs)', () => {
      // Simulate a scenario where the calculation might lead to NaN, although direct inputs won't.
      // We can spy and force the intermediate calculation if needed, but testing the fallback is key.
      // Let's test with 0 again, as it's the most likely falsy outcome.
      const bid = 0;
      const ask = 0.001; // Very small ask
      // avg = 0.0005 -> toFixed(1) = '0.0' -> '0.00' -> 0. Return bid (0).
      expect(service.findOptionsPrice(bid, ask)).toBe(0); // Returns bid
    });

    it('should handle rounding near .05 correctly (rounding up)', () => {
      const bid = 1.95;
      const ask = 1.97;
      // avg = 1.96 -> toFixed(1) = '2.0' -> '2.00' -> 2.0
      expect(service.findOptionsPrice(bid, ask)).toBe(2.0);
    });

    it('should handle rounding near .05 correctly (rounding down)', () => {
      const bid = 1.91;
      const ask = 1.93;
      // avg = 1.92 -> toFixed(1) = '1.9' -> '1.90' -> 1.9
      expect(service.findOptionsPrice(bid, ask)).toBe(1.9);
    });
  });

  // --- Add other describe blocks for other methods as needed ---

});
