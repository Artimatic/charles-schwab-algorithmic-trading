import { TestBed } from '@angular/core/testing';

import { BalanceCallPutService } from './balance-call-put.service';

describe('BalanceCallPutService', () => {
  let service: BalanceCallPutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BalanceCallPutService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
