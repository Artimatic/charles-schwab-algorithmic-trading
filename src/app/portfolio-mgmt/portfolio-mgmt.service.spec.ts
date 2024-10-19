import { TestBed } from '@angular/core/testing';

import { PortfolioMgmtService } from './portfolio-mgmt.service';
import { AuthenticationService, CartService, PortfolioService, TradeService } from '@shared/services';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { of } from 'rxjs';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';

describe('PortfolioMgmtService', () => {
  let service: PortfolioMgmtService;
  const optionsOrderBuilderServiceSpy = jasmine.createSpyObj('OptionsOrderBuilderService', ['createProtectivePutOrder']);

  const mockCartService = {
    addToCart: () => null,
    isStrangle: () => null,
    addOptionOrder: () => null,
    deleteDaytrade: () => null,
    removeCompletedOrders: () => null,
    findCurrentPositions: () => Promise.resolve(null),
    getAvailableFunds: () => Promise.resolve(null),
    otherOrders: [],
    buyOrders: [],
    sellOrders: []
  };

  const mockMachineDaytradingService = {
    getPortfolioBalance: () => of({ liquidationValue: 85000 })
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: MachineDaytradingService, useValue: mockMachineDaytradingService },
        { provide: OptionsOrderBuilderService, useValue: optionsOrderBuilderServiceSpy },
        { provide: StrategyBuilderService, useValue: {} },
        { provide: OrderHandlingService, useValue: {} },
        PortfolioService,
        AuthenticationService,
        DialogService,
        MessageService,
        TradeService
      ]
    });
    service = TestBed.inject(PortfolioMgmtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should buy protective put', async() => {
    const testHoldings = [
      {
        alloc: 0,
        buyConfidence: 0,
        buyReasons: "",
        name: "LULU",
        cost: 15493.77,
        netLiq: 15866.28,
        pl: 372.51,
        prediction: null,
        recommendation: null,
        sellConfidence: 0,
        sellReasons: "",
        shares: 59
      }
    ];

    await service.hedge(testHoldings, [], 0.02, 0.1);
    expect(optionsOrderBuilderServiceSpy.createProtectivePutOrder).toHaveBeenCalledWith(testHoldings[0]);
  });
});
