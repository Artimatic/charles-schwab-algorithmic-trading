import { TestBed } from '@angular/core/testing';

import { StrategyStoreService } from './strategy-store.service';

describe('StrategyStoreService', () => {
  let service: StrategyStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StrategyStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
