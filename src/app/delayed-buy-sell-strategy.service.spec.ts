import { TestBed } from '@angular/core/testing';

import { DelayedBuySellStrategyService } from './delayed-buy-sell-strategy.service';

describe('DelayedBuySellStrategyService', () => {
  let service: DelayedBuySellStrategyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DelayedBuySellStrategyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
