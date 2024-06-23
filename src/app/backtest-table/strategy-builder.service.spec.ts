import { TestBed } from '@angular/core/testing';

import { StrategyBuilderService } from './strategy-builder.service';

describe('StrategyBuilderService', () => {
  let service: StrategyBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StrategyBuilderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
