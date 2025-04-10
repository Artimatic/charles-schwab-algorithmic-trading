import { TestBed } from '@angular/core/testing';

import { AllocationService } from './allocation.service';

describe('AllocationService', () => {
  let service: AllocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AllocationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
