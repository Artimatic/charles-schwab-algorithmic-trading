import { TestBed } from '@angular/core/testing';

import { LookBackStrategyService } from './look-back-strategy.service';

describe('LookBackStrategyService', () => {
  let service: LookBackStrategyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LookBackStrategyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
