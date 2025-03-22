import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlgoEvaluationComponent } from './algo-evaluation.component';
import { AiPicksService } from '@shared/services';
import { OptionsOrderBuilderService } from 'src/app/strategies/options-order-builder.service';
import { of, Subject } from 'rxjs';
import { Stock } from '@shared/stock.interface';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';

const mockAiPicksService = {
  mlNeutralResults: of({})
};
describe('AlgoEvaluationComponent', () => {
  let component: AlgoEvaluationComponent;
  let fixture: ComponentFixture<AlgoEvaluationComponent>;
  let aiPicksServiceSpy: jasmine.SpyObj<AiPicksService>;
  let optionsOrderBuilderServiceSpy: jasmine.SpyObj<OptionsOrderBuilderService>;
  let mlNeutralResultsSubject: Subject<void>;

  beforeEach(() => {
    mlNeutralResultsSubject = new Subject<void>();
    const spyOptionsOrderBuilderService = jasmine.createSpyObj('OptionsOrderBuilderService', ['addCallToCurrentTrades', 'addPutToCurrentTrades']);

    TestBed.configureTestingModule({
      declarations: [AlgoEvaluationComponent],
      providers: [
        { provide: AiPicksService, useValue: mockAiPicksService },
        { provide: OptionsOrderBuilderService, useValue: spyOptionsOrderBuilderService },
        { provide: StrategyBuilderService, useValue: { bullishStocks: []} },
      ],
    });

    fixture = TestBed.createComponent(AlgoEvaluationComponent);
    component = fixture.componentInstance;
    aiPicksServiceSpy = TestBed.inject(AiPicksService) as jasmine.SpyObj<AiPicksService>;
    optionsOrderBuilderServiceSpy = TestBed.inject(OptionsOrderBuilderService) as jasmine.SpyObj<OptionsOrderBuilderService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize selectedColumns correctly', () => {
    expect(component.selectedColumns.length).toBe(6);
    expect(component.selectedColumns[0].field).toBe('stock');
    expect(component.selectedColumns[0].header).toBe('Stock');
    expect(component.selectedColumns[1].field).toBe('buySignals');
    expect(component.selectedColumns[1].header).toBe('Buy');
    expect(component.selectedColumns[2].field).toBe('sellSignals');
    expect(component.selectedColumns[2].header).toBe('Sell');
    expect(component.selectedColumns[3].field).toBe('recommendation');
    expect(component.selectedColumns[3].header).toBe('Recommendation');
    expect(component.selectedColumns[4].field).toBe('returns');
    expect(component.selectedColumns[4].header).toBe('Returns');
    expect(component.selectedColumns[5].field).toBe('impliedMovement');
    expect(component.selectedColumns[5].header).toBe('Implied Movement');
  });

  it('should call getBacktests on initialization', () => {
    spyOn(component, 'getBacktests');
    component.ngOnInit();
    expect(component.getBacktests).toHaveBeenCalled();
  });

  it('should call getBacktests when mlNeutralResults emits', () => {
    spyOn(component, 'getBacktests');
    component.ngOnInit();
    mlNeutralResultsSubject.next();
    expect(component.getBacktests).toHaveBeenCalledTimes(2);
  });

  it('should load stocks from localStorage', () => {
    const mockStockData = {
      'AAPL': { stock: 'AAPL', ml: 0.6, recommendation: 'buy', impliedMovement: 0.1 } as Stock,
      'MSFT': { stock: 'MSFT', ml: 0.7, recommendation: 'buy', impliedMovement: 0.05 } as Stock,
      'NVDA': { stock: 'NVDA', sellMl: 0.7, recommendation: 'sell', impliedMovement: 0.05 } as Stock
    };
    localStorage.setItem('backtest', JSON.stringify(mockStockData));

    component.getBacktests();

    expect(component.stockList.length).toBe(3);
    expect(component.stockList[0].stock).toEqual('AAPL');
    expect(component.stockList[1].stock).toEqual('MSFT');
    expect(component.stockList[2].stock).toEqual('NVDA');
  });

  it('should filter and transform stocks correctly', () => {
    const mockStockData = {
      'AAPL': { stock: 'AAPL', ml: 0.6, recommendation: 'Strongbuy', impliedMovement: 0.05 } as Stock,
      'MSFT': { stock: 'MSFT', ml: 0.4, recommendation: 'none', impliedMovement: 0.1 } as Stock,
      'GOOG': { stock: 'GOOG', sellMl: 0.7, recommendation: 'strongSell', impliedMovement: 0.06 } as Stock,
      'TSLA': { stock: 'TSLA', sellMl: 0.4, recommendation: 'none', impliedMovement: 0.1 } as Stock,
      'AMD': { stock: 'AMD', ml: 0.6, recommendation: 'none', impliedMovement: 0.15 } as Stock,
      'NVDA': { stock: 'NVDA', sellMl: 0.6, recommendation: 'none', impliedMovement: 0.15 } as Stock
    };
    localStorage.setItem('backtest', JSON.stringify(mockStockData));

    component.getBacktests();

    expect(component.currentList.length).toBe(2);
    expect(component.currentList[0].stock).toEqual('AAPL');
    expect(component.currentList[0].recommendation).toEqual('Strong buy');
    expect(component.currentList[1].stock).toEqual('GOOG');
    expect(component.currentList[1].recommendation).toEqual('Strong sell');
  });
  it('should add call to current trade if all conditions are met', () => {
    optionsOrderBuilderServiceSpy.addPutToCurrentTrades.calls.reset();
    const mockStockData = {
      'AAPL': { stock: 'AAPL', ml: 0.6, recommendation: 'buy', impliedMovement: 0.05 } as Stock,
    };
    localStorage.setItem('backtest', JSON.stringify(mockStockData));
    component.getBacktests();
    expect(optionsOrderBuilderServiceSpy.addCallToCurrentTrades).toHaveBeenCalledWith('AAPL');
    expect(optionsOrderBuilderServiceSpy.addPutToCurrentTrades).not.toHaveBeenCalled();
  });

    it('should add put to current trade if all conditions are met', () => {
      optionsOrderBuilderServiceSpy.addCallToCurrentTrades.calls.reset();
      const mockStockData = {
        'NVDA': { stock: 'NVDA', sellMl: 0.6, recommendation: 'sell', impliedMovement: 0.05 } as Stock
      };
      localStorage.setItem('backtest', JSON.stringify(mockStockData));
      component.getBacktests();
      expect(optionsOrderBuilderServiceSpy.addPutToCurrentTrades).toHaveBeenCalledWith('NVDA');
      expect(optionsOrderBuilderServiceSpy.addCallToCurrentTrades).not.toHaveBeenCalled();
    });
});
