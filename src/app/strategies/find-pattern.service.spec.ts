import { TestBed } from '@angular/core/testing';

import { FindPatternService } from './find-pattern.service';

xdescribe('MlBuyAtCloseService', () => {
  let service: FindPatternService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FindPatternService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
