import { TestBed, inject } from '@angular/core/testing';

import { CartService } from './cart.service';
import { PortfolioService } from './portfolio.service';
import { TradeService } from './trade.service';
import { ReportingService } from './reporting.service';
import { MachineLearningService } from './machine-learning/machine-learning.service';
import { GlobalSettingsService } from 'src/app/settings/global-settings.service';
import { MessageService } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { SmartOrder } from '@shared/models/smart-order';

describe('CartService', () => {
  let service: CartService;
  let mockTradeService: jasmine.SpyObj<TradeService>;
  let mockMessageService: jasmine.SpyObj<MessageService>;
  let mockReportingService: jasmine.SpyObj<ReportingService>;
  let mockMachineLearningService: jasmine.SpyObj<MachineLearningService>;
  let mockGlobalSettingsService: jasmine.SpyObj<GlobalSettingsService>;

  const portfolioServiceSpy = jasmine.createSpyObj('PortfolioService', ['getTdPortfolio', 'findOptionsPrice', 'getTradingStrategies', 'getPutStrangleTrade']);
  const mockPortfolioArr = [{
    "shortQuantity": 0,
    "averagePrice": 1.6051,
    "currentDayProfitLoss": 106.5,
    "currentDayProfitLossPercentage": 71,
    "longQuantity": 1,
    "settledLongQuantity": 1,
    "settledShortQuantity": 0,
    "instrument": {
      "assetType": "OPTION",
      "cusip": "0BAC..LK40041000",
      "symbol": "BAC   241220C00041000",
      "description": "BANK OF AMERICA CORP 12/20/2024 $41 Call",
      "netChange": 1.1,
      "type": "VANILLA",
      "putCall": "CALL",
      "underlyingSymbol": "BAC"
    },
    "marketValue": 256.5,
    "maintenanceRequirement": 0,
    "averageLongPrice": 1.6,
    "taxLotAverageLongPrice": 1.6051,
    "longOpenProfitLoss": 95.99,
    "previousSessionLongQuantity": 1,
    "currentDayCost": 0
  },
  {
    "shortQuantity": 0,
    "averagePrice": 40.5,
    "currentDayProfitLoss": -112.690000000001,
    "currentDayProfitLossPercentage": -0.76,
    "longQuantity": 191,
    "settledLongQuantity": 191,
    "settledShortQuantity": 0,
    "instrument": {
      "assetType": "EQUITY",
      "cusip": "679295105",
      "symbol": "BAC",
      "netChange": 0.07
    },
    "marketValue": 7000,
    "maintenanceRequirement": 4431.58,
    "averageLongPrice": 40.5,
    "taxLotAverageLongPrice": 40.5,
    "longOpenProfitLoss": -735.5,
    "previousSessionLongQuantity": 191,
    "currentDayCost": 0
  }];

  beforeEach(() => {
    mockTradeService = jasmine.createSpyObj('TradeService', ['']);
    mockMessageService = jasmine.createSpyObj('MessageService', ['add']);
    mockReportingService = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
    mockMachineLearningService = jasmine.createSpyObj('MachineLearningService', ['']);
    mockGlobalSettingsService = jasmine.createSpyObj('GlobalSettingsService', ['']);
    
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        CartService,
        { provide: PortfolioService, useValue: portfolioServiceSpy },
        { provide: TradeService, useValue: mockTradeService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: ReportingService, useValue: mockReportingService },
        { provide: MachineLearningService, useValue: mockMachineLearningService },
        { provide: GlobalSettingsService, useValue: mockGlobalSettingsService },
      ]
    });
    service = TestBed.inject(CartService);
  });

  it('should be created', inject([CartService], (service: CartService) => {
    expect(service).toBeTruthy();
  }));

  it('should process current positions', inject([CartService], async (service: CartService) => {
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(mockPortfolioArr));
    const testHoldings1 = await service.findCurrentPositions();
    expect(testHoldings1.length).toBe(1);
    expect(testHoldings1[0].pl).toBe(-639.51);
    expect(testHoldings1[0].cost).toBe(7896.01);

    portfolioServiceSpy.getTdPortfolio.and.returnValue(of([mockPortfolioArr[0]]));
    const testHoldings2 = await service.findCurrentPositions();
    expect(testHoldings2.length).toBe(1);
    expect(testHoldings2[0].pl).toBe(95.99);
    expect(testHoldings2[0].cost).toBe(160.51);
  }));
  it('should calculate correct pnl', inject([CartService], async (service: CartService) => {
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(mockPortfolioArr));
    const testHoldings1 = await service.findCurrentPositions();
    expect(testHoldings1.length).toBe(1);
    expect(Number(testHoldings1[0].pnlPercentage.toFixed(2))).toBe(-0.08);

    portfolioServiceSpy.getTdPortfolio.and.returnValue(of([mockPortfolioArr[0]]));
    const testHoldings2 = await service.findCurrentPositions();
    expect(testHoldings2.length).toBe(1);
    expect(Number(testHoldings2[0].pnlPercentage.toFixed(2))).toBe(0.60);
  }));
  it('should get buy orders', () => {
    service.buyOrders = [{ holding: { symbol: 'AAPL' } } as SmartOrder];
    expect(service.getBuyOrders()).toEqual([{ holding: { symbol: 'AAPL' } } as SmartOrder]);
  });

  it('should get sell orders', () => {
    service.sellOrders = [{ holding: { symbol: 'TSLA' } } as SmartOrder];
    expect(service.getSellOrders()).toEqual([{ holding: { symbol: 'TSLA' } } as SmartOrder]);
  });

  it('should get other orders', () => {
    service.otherOrders = [{ holding: { symbol: 'SPY' } } as SmartOrder];
    expect(service.getOtherOrders()).toEqual([{ holding: { symbol: 'SPY' } } as SmartOrder]);
  });
});
