import { TestBed } from '@angular/core/testing';

import { IntradayStrategyScannerService } from './intraday-strategy-scanner.service';

describe('IntradayStrategyScannerService', () => {
  let service: IntradayStrategyScannerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntradayStrategyScannerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
