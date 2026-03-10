import { TestBed } from '@angular/core/testing';

import { RebalancingService } from './rebalancing.service';

describe('RebalancingService', () => {
  let service: RebalancingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RebalancingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
