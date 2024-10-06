import { TestBed } from '@angular/core/testing';

import { LocalPreferences } from './local-preferences.service';

xdescribe('LocalPreferences', () => {
  let service: LocalPreferences;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalPreferences);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
