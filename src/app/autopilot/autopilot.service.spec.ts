import { TestBed } from '@angular/core/testing';
import { AutopilotService } from './autopilot.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { BacktestService, CartService, PortfolioService } from '@shared/services';
import { ReportingService } from '@shared/services';
import { PriceTargetService } from './price-target.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';

describe('AutopilotService', () => {
  let service: AutopilotService;

  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      { provide: StrategyBuilderService, useValue: {} },
      { provide: MachineDaytradingService, useValue: {} },
      { provide: OptionsOrderBuilderService, useValue: {} },
      { provide: CartService, useValue: {} },
      { provide: BacktestService, useValue: {} },
      { provide: PriceTargetService, useValue: {} },
      { provide: OrderHandlingService, useValue: {} },
      { provide: ReportingService, useValue: {} },
      { provide: PortfolioService, useValue: {} }
    ]});
    service = TestBed.inject(AutopilotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
