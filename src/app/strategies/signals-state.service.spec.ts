import { TestBed } from '@angular/core/testing';

import { SignalsStateService } from './signals-state.service';

describe('SignalsStateService', () => {
  let service: SignalsStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalsStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
