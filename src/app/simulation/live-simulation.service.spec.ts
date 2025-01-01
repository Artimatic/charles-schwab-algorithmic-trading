import { TestBed } from '@angular/core/testing';

import { LiveSimulationService } from './live-simulation.service';

describe('LiveSimulationService', () => {
  let service: LiveSimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LiveSimulationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
