import { TestBed } from '@angular/core/testing';

import { ClientSmsService } from './client-sms.service';

xdescribe('ClientSmsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: ClientSmsService = TestBed.get(ClientSmsService);
    expect(service).toBeTruthy();
  });
});
