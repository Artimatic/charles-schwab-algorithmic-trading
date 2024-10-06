import { TestBed } from '@angular/core/testing';

import { OptionsOrderBuilderService } from './options-order-builder.service';

xdescribe('OptionsOrderBuilderService', () => {
  let service: OptionsOrderBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OptionsOrderBuilderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
