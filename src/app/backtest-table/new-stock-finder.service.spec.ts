import { TestBed } from '@angular/core/testing';

import { NewStockFinderService } from './new-stock-finder.service';

describe('NewStockFinderService', () => {
  let service: NewStockFinderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NewStockFinderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
