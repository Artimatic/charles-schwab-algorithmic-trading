import { TestBed } from '@angular/core/testing';

import { LiveSimulationService } from './live-simulation.service';
import { DialogService } from 'primeng/dynamicdialog';

describe('LiveSimulationService', () => {
  let service: LiveSimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: { open: () => {}} }
      ]
    });
    service = TestBed.inject(LiveSimulationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
