import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DaytradeActiveSearchComponent } from './daytrade-active-search.component';

describe('DaytradeActiveSearchComponent', () => {
  let component: DaytradeActiveSearchComponent;
  let fixture: ComponentFixture<DaytradeActiveSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DaytradeActiveSearchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DaytradeActiveSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
