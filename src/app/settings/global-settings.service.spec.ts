import { TestBed } from '@angular/core/testing';

import { GlobalSettingsService } from './global-settings.service';

xdescribe('GlobalSettingsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: GlobalSettingsService = TestBed.get(GlobalSettingsService);
    expect(service).toBeTruthy();
  });
});
