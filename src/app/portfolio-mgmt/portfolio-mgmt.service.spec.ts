import { TestBed } from '@angular/core/testing';

import { PortfolioMgmtService } from './portfolio-mgmt.service';
import { AuthenticationService, CartService, PortfolioService, TradeService } from '@shared/services';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { of } from 'rxjs';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';

describe('PortfolioMgmtService', () => {
  let service: PortfolioMgmtService;
  const optionsOrderBuilderServiceSpy = jasmine.createSpyObj('OptionsOrderBuilderService', ['createProtectivePutOrder']);

  const mockCartService = {
    addToCart: () => null,
    isStrangle: () => null,
    addSingleLegOptionOrder: () => null,
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
});
