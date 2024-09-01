import { TestBed, inject } from '@angular/core/testing';

import { ExcelService } from './excel-service.service';

xdescribe('ExcelServiceService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {provide: ExcelService, useValue: {} }]
    });
  });

  xit('createshould be created', inject([ExcelService], (service: ExcelService) => {
    expect(service).toBeTruthy();
  }));
});
