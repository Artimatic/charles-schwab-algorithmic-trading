import { TestBed, inject } from '@angular/core/testing';

import { IndicatorsService } from './indicators.service';

xdescribe('IndicatorsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IndicatorsService]
    });
  });

  it('should be created', inject([IndicatorsService], (service: IndicatorsService) => {
    expect(service).toBeTruthy();
  }));
});
