import { TestBed } from '@angular/core/testing';

import { PortfolioWeightsService } from './portfolio-weights.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { BacktestService, CartService, PortfolioService, ReportingService } from '@shared/services';
import { OptionsDataService } from '@shared/options-data.service';
import { MessageService } from 'primeng/api';
import { SchedulerService } from '@shared/service/scheduler.service';
import { StrategyStoreService } from '../backtest-table/strategy-store.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { PriceTargetService } from './price-target.service';
import { GlobalSettingsService } from '../settings/global-settings.service';

const mockPortfolioData = [
  {
    name: 'OKTA',
    netLiq: 14771.94,
  },
  {
    name: 'MSFT',
    netLiq: 1812.5,
  },
  {
    name: 'MO',
    netLiq: 149,
  },
  {
    name: 'MRNA',
    netLiq: 790
  }
];
describe('PortfolioWeightsService', () => {
  let service: PortfolioWeightsService;
  let strategyBuilderServiceSpy: jasmine.SpyObj<StrategyBuilderService>;
  const backtestServiceSpy = jasmine.createSpyObj('BacktestService', ['getBacktestData']);
  const optionsDataServiceSpy = jasmine.createSpyObj('OptionsDataService', ['getImpliedMove']);
  const portfolioServiceSpy = jasmine.createSpyObj('PortfolioService', ['addStrategy']);
  const messageServiceSpy = jasmine.createSpyObj('MessageService', ['add']);
  const schedulerServiceSpy = jasmine.createSpyObj('SchedulerService', ['schedule']);
  const reportingServiceSpy = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
  const strategyStoreServiceSpy = jasmine.createSpyObj('StrategyStoreService', ['getStorage', 'setStorage']);
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['getAvailableFunds', 'addToCart', 'createOptionOrder']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);
  const priceTargetServiceSpy = jasmine.createSpyObj('PriceTargetService', ['getDiff',]);
  const globalSettingsServiceSpy = jasmine.createSpyObj('GlobalSettingsService', ['get10YearYield']);

  beforeEach(() => {
    strategyBuilderServiceSpy = jasmine.createSpyObj('StrategyBuilderService', ['getBacktestData', 'getBuyList']);

    TestBed.configureTestingModule({
      providers: [
        PortfolioWeightsService,
        { provide: StrategyBuilderService, useValue: strategyBuilderServiceSpy },
        { provide: BacktestService, useValue: backtestServiceSpy },
        { provide: OptionsDataService, useValue: optionsDataServiceSpy },
        { provide: PortfolioService, useValue: portfolioServiceSpy },
        { provide: MessageService, useValue: messageServiceSpy },
        { provide: SchedulerService, useValue: schedulerServiceSpy },
        { provide: ReportingService, useValue: reportingServiceSpy },
        { provide: StrategyStoreService, useValue: strategyStoreServiceSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy },
        { provide: PriceTargetService, useValue: priceTargetServiceSpy },
        { provide: GlobalSettingsService, useValue: globalSettingsServiceSpy },
      ]
    });
    service = TestBed.inject(PortfolioWeightsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create holding weights', async () => {
    const mockBacktestDataOKTA = { impliedMovement: 0.1, stock: 'OKTA', recommendation: 'Buy' };
    const mockBacktestDataMSFT = { impliedMovement: 0.05, stock: 'MSFT', recommendation: 'Buy' };
    const mockBacktestDataMO = { impliedMovement: 0.08, stock: 'MO', recommendation: 'Buy' };
    const mockBacktestDataMRNA = { impliedMovement: 0.12, stock: 'MRNA', recommendation: 'Buy' };
    strategyBuilderServiceSpy.getBacktestData.and.callFake(async (symbol) => {
      if (symbol === 'OKTA') {
        return mockBacktestDataOKTA;
      } else if (symbol === 'MSFT') {
        return mockBacktestDataMSFT
      } else if (symbol === 'MO') {
        return mockBacktestDataMO
      } else if (symbol === 'MRNA') {
        return mockBacktestDataMRNA
      }
      return null;
    });
    const totalMarketValue = mockPortfolioData.reduce((sum, item) => sum + item.netLiq, 0);
    const expectedHoldings = [
      { name: 'OKTA', weight: 14771.94 / totalMarketValue, impliedVolatility: 0.1 },
      { name: 'MSFT', weight: 1812.5 / totalMarketValue, impliedVolatility: 0.05 },
      { name: 'MO', weight: 149 / totalMarketValue, impliedVolatility: 0.08 },
      { name: 'MRNA', weight: 790 / totalMarketValue, impliedVolatility: 0.12 },
    ];
    const holdings = await service.createHoldingWeights(mockPortfolioData as any);
    expect(strategyBuilderServiceSpy.getBacktestData).toHaveBeenCalledTimes(4);
    expect(holdings.length).toBe(4);
    expect(holdings[0].name).toEqual(expectedHoldings[0].name);
    expect(holdings[0].weight).toBeCloseTo(expectedHoldings[0].weight);
    expect(holdings[0].impliedVolatility).toEqual(expectedHoldings[0].impliedVolatility);
    expect(holdings[1].name).toEqual(expectedHoldings[1].name);
    expect(holdings[1].weight).toBeCloseTo(expectedHoldings[1].weight);
    expect(holdings[1].impliedVolatility).toEqual(expectedHoldings[1].impliedVolatility);
    expect(holdings[2].name).toEqual(expectedHoldings[2].name);
    expect(holdings[2].weight).toBeCloseTo(expectedHoldings[2].weight);
    expect(holdings[2].impliedVolatility).toEqual(expectedHoldings[2].impliedVolatility);
    expect(holdings[3].name).toEqual(expectedHoldings[3].name);
    expect(holdings[3].weight).toBeCloseTo(expectedHoldings[3].weight);
    expect(holdings[3].impliedVolatility).toEqual(expectedHoldings[3].impliedVolatility);
  });

  it('should calculate portfolio volatility', () => {
    const holdings = [
      { name: 'OKTA', weight: 0.5, impliedVolatility: 0.2 },
      { name: 'MSFT', weight: 0.3, impliedVolatility: 0.15 },
      { name: 'MO', weight: 0.2, impliedVolatility: 0.1 },
    ];
    const expectedVolatility = 0.16500000000000004;
    const portfolioVolatility = service.calculatePortfolioVolatility(holdings);
    expect(portfolioVolatility).toEqual(expectedVolatility);
  });

  it('should calculate portfolio volatility with stocks only', async () => {
    const mockBacktestDataOKTA = { impliedMovement: 0.1, stock: 'OKTA', recommendation: 'Buy' };
    const mockBacktestDataMSFT = { impliedMovement: 0.05, stock: 'MSFT', recommendation: 'Buy' };
    const mockBacktestDataMO = { impliedMovement: 0.08, stock: 'MO', recommendation: 'Buy' };
    const mockBacktestDataMRNA = { impliedMovement: 0.12, stock: 'MRNA', recommendation: 'Buy' };
    strategyBuilderServiceSpy.getBacktestData.and.callFake(async (symbol) => {
      if (symbol === 'OKTA') {
        return mockBacktestDataOKTA;
      } else if (symbol === 'MSFT') {
        return mockBacktestDataMSFT
      } else if (symbol === 'MO') {
        return mockBacktestDataMO
      } else if (symbol === 'MRNA') {
        return mockBacktestDataMRNA
      }
      return null;
    });

    const test1 = [
      {
        name: 'OKTA',
        netLiq: 14771.94,
      },
      {
        name: 'MSFT',
        netLiq: 1812.5,
      },
      {
        name: 'MO',
        netLiq: 149,
      },
      {
        name: 'MRNA',
        netLiq: 790
      }
    ];
    const expectedVolatility = 0.09555994713366782;
    
    const portfolioVolatility = await service.getPortfolioVolatility(test1 as any);
    expect(portfolioVolatility).toEqual(expectedVolatility);
  });
  it('should calculate portfolio volatility with options and stocks', async () => {
    const mockBacktestDataOKTA = { impliedMovement: 0.1, stock: 'OKTA', recommendation: 'Buy' };
    const mockBacktestDataMSFT = { impliedMovement: 0.05, stock: 'MSFT', recommendation: 'Buy' };
    const mockBacktestDataMO = { impliedMovement: 0.08, stock: 'MO', recommendation: 'Buy' };
    const mockBacktestDataMRNA = { impliedMovement: 0.12, stock: 'MRNA', recommendation: 'Buy' };
    strategyBuilderServiceSpy.getBacktestData.and.callFake(async (symbol) => {
      if (symbol === 'OKTA') {
        return mockBacktestDataOKTA;
      } else if (symbol === 'MSFT') {
        return mockBacktestDataMSFT
      } else if (symbol === 'MO') {
        return mockBacktestDataMO
      } else if (symbol === 'MRNA') {
        return mockBacktestDataMRNA
      }
      return null;
    });

    const test1 = [
      {
        name: 'OKTA',
        netLiq: 14771.94
      },
      {
        name: 'MSFT',
        netLiq: 1812.5,
      },
      {
        name: 'MO',
        netLiq: 149,
      },
      {
        name: 'MRNA',
        netLiq: 790,
        primaryLegs: [1]
      }
    ];
    const expectedVolatility = 0.11719953388147532;
    
    const portfolioVolatility = await service.getPortfolioVolatility(test1 as any);
    expect(portfolioVolatility).toEqual(expectedVolatility);
  });
  it('should calculate portfolio volatility with options only', async () => {
    const mockBacktestDataOKTA = { impliedMovement: 0.1, stock: 'OKTA', recommendation: 'Buy' };
    const mockBacktestDataMSFT = { impliedMovement: 0.05, stock: 'MSFT', recommendation: 'Buy' };
    const mockBacktestDataMO = { impliedMovement: 0.08, stock: 'MO', recommendation: 'Buy' };
    const mockBacktestDataMRNA = { impliedMovement: 0.12, stock: 'MRNA', recommendation: 'Buy' };
    strategyBuilderServiceSpy.getBacktestData.and.callFake(async (symbol) => {
      if (symbol === 'OKTA') {
        return mockBacktestDataOKTA;
      } else if (symbol === 'MSFT') {
        return mockBacktestDataMSFT
      } else if (symbol === 'MO') {
        return mockBacktestDataMO
      } else if (symbol === 'MRNA') {
        return mockBacktestDataMRNA
      }
      return null;
    });

    const test1 = [
      {
        name: 'OKTA',
        netLiq: 14771.94,
        primaryLegs: [1]
      },
      {
        name: 'MSFT',
        netLiq: 1812.5,
        primaryLegs: [1]
      },
      {
        name: 'MO',
        netLiq: 149,
        primaryLegs: [1]
      },
      {
        name: 'MRNA',
        netLiq: 790,
        primaryLegs: [1]
      }
    ];
    const expectedVolatility = 0.4777997356683391;
    
    const portfolioVolatility = await service.getPortfolioVolatility(test1 as any);
    expect(portfolioVolatility).toEqual(expectedVolatility);
  });
});
