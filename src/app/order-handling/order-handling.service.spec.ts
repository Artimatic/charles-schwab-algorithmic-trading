import { TestBed } from '@angular/core/testing';

import { OrderHandlingService } from './order-handling.service';

xdescribe('OrderHandlingService', () => {
  let service: OrderHandlingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderHandlingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
