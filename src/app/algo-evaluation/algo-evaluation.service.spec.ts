import { TestBed } from '@angular/core/testing';

import { AlgoEvaluationService } from './algo-evaluation.service';

describe('AlgoEvaluationService', () => {
  let service: AlgoEvaluationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlgoEvaluationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
