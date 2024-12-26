import { TestBed } from '@angular/core/testing';

import { BacktestAggregatorService } from './backtest-aggregator.service';

describe('BacktestAggregatorService', () => {
  let service: BacktestAggregatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BacktestAggregatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
