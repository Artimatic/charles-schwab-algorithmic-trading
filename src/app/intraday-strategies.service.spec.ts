import { TestBed } from '@angular/core/testing';

import { IntradayStrategiesService } from './intraday-strategies.service';

describe('IntradayStrategiesService', () => {
  let service: IntradayStrategiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntradayStrategiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
