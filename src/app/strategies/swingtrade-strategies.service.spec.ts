import { TestBed } from '@angular/core/testing';

import { SwingtradeStrategiesService } from './swingtrade-strategies.service';

describe('SwingtradeStrategiesService', () => {
  let service: SwingtradeStrategiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SwingtradeStrategiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
