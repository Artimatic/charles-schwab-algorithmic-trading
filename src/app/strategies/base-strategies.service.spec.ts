import { TestBed } from '@angular/core/testing';

import { BaseStrategiesService } from './base-strategies.service';

describe('BaseStrategiesService', () => {
  let service: BaseStrategiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BaseStrategiesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
