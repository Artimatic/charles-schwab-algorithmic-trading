import { TestBed } from '@angular/core/testing';

import { PriceTargetService } from './price-target.service';

describe('PriceTargetService', () => {
  let service: PriceTargetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PriceTargetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
