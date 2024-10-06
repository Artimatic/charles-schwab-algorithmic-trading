import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddOptionsTradeComponent } from './add-options-trade.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';

describe('AddOptionsTradeComponent', () => {
  let component: AddOptionsTradeComponent;
  let fixture: ComponentFixture<AddOptionsTradeComponent>;
  const mockStrategyBuilderService = {
    getStorage: () => null,
    addToStorage: () => null,
    addStrangle: () => null,
    getBacktestData: () => null,
    getCallStrangleTrade: () => null,
    getPutStrangleTrade: () => null,
    findOptionsPrice: () => null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddOptionsTradeComponent],
      imports: [HttpClientTestingModule],
      providers: [
        DialogService,
        DynamicDialogRef,
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService }]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddOptionsTradeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
