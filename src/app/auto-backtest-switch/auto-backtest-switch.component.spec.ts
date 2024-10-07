import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AutoBacktestSwitchComponent } from './auto-backtest-switch.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AutoBacktestSwitchComponent', () => {
  let component: AutoBacktestSwitchComponent;
  let fixture: ComponentFixture<AutoBacktestSwitchComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AutoBacktestSwitchComponent ],
      imports: [ HttpClientTestingModule ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AutoBacktestSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
