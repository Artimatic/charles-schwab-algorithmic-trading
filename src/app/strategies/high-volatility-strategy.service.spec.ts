import { TestBed } from '@angular/core/testing';

import { HighVolatilityStrategyService } from './high-volatility-strategy.service';

describe('HighVolatilityStrategyService', () => {
  let service: HighVolatilityStrategyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HighVolatilityStrategyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
