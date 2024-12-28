import { TestBed } from '@angular/core/testing';

import { AlgoEvaluationService } from './algo-evaluation.service';
import { DialogService } from 'primeng/dynamicdialog';

xdescribe('AlgoEvaluationService', () => {
  let service: AlgoEvaluationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: DialogService, useValue: {} },
      ]
    });
    service = TestBed.inject(AlgoEvaluationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
