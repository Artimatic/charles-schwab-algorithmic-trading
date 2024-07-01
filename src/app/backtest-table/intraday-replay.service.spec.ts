import { TestBed } from '@angular/core/testing';

import { IntradayReplayService } from './intraday-replay.service';

describe('IntradayReplayService', () => {
  let service: IntradayReplayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IntradayReplayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
