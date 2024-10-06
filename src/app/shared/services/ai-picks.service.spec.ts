import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AiPicksService } from './ai-picks.service';

describe('AiPicksService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ HttpClientTestingModule ]
    });
  });
  it('should be created', () => {
    const service: AiPicksService = TestBed.get(AiPicksService);
    expect(service).toBeTruthy();
  });
});
