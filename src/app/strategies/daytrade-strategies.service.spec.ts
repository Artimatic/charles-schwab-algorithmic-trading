import { TestBed } from '@angular/core/testing';

import { DaytradeStrategiesService } from './daytrade-strategies.service';

describe('DaytradeStrategiesService', () => {
  let service: DaytradeStrategiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DaytradeStrategiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
