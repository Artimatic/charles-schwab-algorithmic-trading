import { TestBed } from '@angular/core/testing';

import { OrderingService } from './ordering.service';

xdescribe('OrderingService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: OrderingService = TestBed.get(OrderingService);
    expect(service).toBeTruthy();
  });
});
