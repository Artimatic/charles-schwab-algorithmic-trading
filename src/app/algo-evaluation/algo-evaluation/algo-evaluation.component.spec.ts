import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlgoEvaluationComponent } from './algo-evaluation.component';
import { AiPicksService } from '@shared/services';
import { of } from 'rxjs';

describe('AlgoEvaluationComponent', () => {
  let component: AlgoEvaluationComponent;
  let fixture: ComponentFixture<AlgoEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AlgoEvaluationComponent ],
      providers: [
        { provide: AiPicksService, useValue: { mlNeutralResults: of([]) } },
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AlgoEvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
