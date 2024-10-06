import { TestBed } from '@angular/core/testing';

import { StrategyBuilderService } from './strategy-builder.service';
import { AiPicksService, BacktestService, CartService, PortfolioService } from '@shared/services';
import { OptionsDataService } from '@shared/options-data.service';
import { MessageService } from 'primeng/api';

describe('StrategyBuilderService', () => {
  let service: StrategyBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: BacktestService, useValue: {} },
        { provide: AiPicksService, useValue: {} },
        { provide: OptionsDataService, useValue: {} },
        { provide: PortfolioService, useValue: {} },
        { provide: CartService, useValue: {} },
      ]
    });
    service = TestBed.inject(StrategyBuilderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
