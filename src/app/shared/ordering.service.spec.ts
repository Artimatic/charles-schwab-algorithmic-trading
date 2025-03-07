import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { OrderingService } from './ordering.service';

describe('OrderingService', () => {
  let service: OrderingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(OrderingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
