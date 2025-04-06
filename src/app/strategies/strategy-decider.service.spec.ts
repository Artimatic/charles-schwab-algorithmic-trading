import { TestBed } from '@angular/core/testing';

import { StrategyDeciderService } from './strategy-decider.service';

describe('StrategyDeciderService', () => {
  let service: StrategyDeciderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StrategyDeciderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
