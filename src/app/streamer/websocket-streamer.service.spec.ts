import { TestBed } from '@angular/core/testing';

import { WebsocketStreamerService } from './websocket-streamer.service';

xdescribe('WebsocketStreamerService', () => {
  let service: WebsocketStreamerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebsocketStreamerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
