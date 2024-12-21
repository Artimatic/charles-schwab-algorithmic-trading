import { TestBed } from '@angular/core/testing';

import { BetSizeService } from './bet-size.service';

describe('BetSizeService', () => {
  let service: BetSizeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BetSizeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
