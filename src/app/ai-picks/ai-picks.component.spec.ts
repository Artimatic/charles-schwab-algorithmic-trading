import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPicksComponent } from './ai-picks.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AiPicksComponent', () => {
  let component: AiPicksComponent;
  let fixture: ComponentFixture<AiPicksComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AiPicksComponent ],
      imports: [ HttpClientTestingModule ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AiPicksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
