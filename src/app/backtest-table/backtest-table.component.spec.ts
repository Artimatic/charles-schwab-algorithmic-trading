import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BacktestTableComponent } from './backtest-table.component';
import { BacktestService } from '@shared/services';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';

xdescribe('BacktestTableComponent', () => {
  let component: BacktestTableComponent;
  let fixture: ComponentFixture<BacktestTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BacktestTableComponent],
      providers: [
        { provide: BacktestService, useValue: {} },
        { provide: DynamicDialogConfig, useValue: { data: { symbol: '' } } },
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BacktestTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
