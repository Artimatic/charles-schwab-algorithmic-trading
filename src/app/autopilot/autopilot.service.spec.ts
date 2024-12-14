import { TestBed } from '@angular/core/testing';

import { AutopilotService } from './autopilot.service';

describe('AutopilotService', () => {
  let service: AutopilotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AutopilotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
