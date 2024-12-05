import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlgoEvaluationComponent } from './algo-evaluation.component';

describe('AlgoEvaluationComponent', () => {
  let component: AlgoEvaluationComponent;
  let fixture: ComponentFixture<AlgoEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AlgoEvaluationComponent ]
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
