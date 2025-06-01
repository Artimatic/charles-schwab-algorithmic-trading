import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AlgoEvaluationComponent } from './algo-evaluation.component';
import { AiPicksService, CartService } from '@shared/services';
import { OptionsOrderBuilderService } from 'src/app/strategies/options-order-builder.service';
import { of, Subject } from 'rxjs';
import { Stock } from '@shared/stock.interface';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockAiPicksService = {
  mlNeutralResults: of({})
};

const mockPortfolioHolding: any = {
  name: 'AAPL', pl: 100, netLiq: 5000, shares: 10, primaryLegs: null, secondaryLegs: null, assetType: 'EQUITY', cost: 4900, pnlPercentage: 0.02
};
xdescribe('AlgoEvaluationComponent', () => {
  let component: AlgoEvaluationComponent;
  let fixture: ComponentFixture<AlgoEvaluationComponent>;
  let optionsOrderBuilderServiceSpy: jasmine.SpyObj<OptionsOrderBuilderService>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let mlNeutralResultsSubject: Subject<void>;
  let mockStrategyBuilderService = { 
    bullishStocks: [], 
    addBullishStock: () => {}
  };
  beforeEach(() => {
    mlNeutralResultsSubject = new Subject<void>();
    const spyOptionsOrderBuilderService = jasmine.createSpyObj('OptionsOrderBuilderService', ['addCallToCurrentTrades', 'addPutToCurrentTrades']);
    const spyCartService = jasmine.createSpyObj('CartService', ['findCurrentPositions']);

    TestBed.configureTestingModule({
      declarations: [AlgoEvaluationComponent],
      imports: [
        CheckboxModule,
        FormsModule,
        TableModule,
        NoopAnimationsModule // Add NoopAnimationsModule
      ],
      providers: [
        { provide: AiPicksService, useValue: mockAiPicksService },
        { provide: OptionsOrderBuilderService, useValue: spyOptionsOrderBuilderService },
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
        { provide: CartService, useValue: spyCartService },
      ],
    });
    fixture = TestBed.createComponent(AlgoEvaluationComponent);
    component = fixture.componentInstance;
    optionsOrderBuilderServiceSpy = TestBed.inject(OptionsOrderBuilderService) as jasmine.SpyObj<OptionsOrderBuilderService>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize selectedColumns for recommendations by default', () => {
    spyOn(component, 'setColumnsForRecommendations');
    component.ngOnInit();
    expect(component.setColumnsForRecommendations).toHaveBeenCalled();
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
      'GOOGL': { stock: 'GOOGL', sellMl: 0.7, recommendation: 'strongSell', impliedMovement: 0.06 } as Stock,
      'TSLA': { stock: 'TSLA', sellMl: 0.4, recommendation: 'none', impliedMovement: 0.1 } as Stock,
      'AMD': { stock: 'AMD', ml: 0.6, recommendation: 'none', impliedMovement: 0.15 } as Stock,
      'NVDA': { stock: 'NVDA', sellMl: 0.6, recommendation: 'none', impliedMovement: 0.15 } as Stock
    };
    localStorage.setItem('backtest', JSON.stringify(mockStockData));

    component.getBacktests();

    expect(component.currentList.length).toBe(2);
    expect(component.currentList[0].stock).toEqual('AAPL');
    expect(component.currentList[0].recommendation).toEqual('Strong buy');
    expect(component.currentList[1].stock).toEqual('GOOGL');
    // Note: The recommendation transformation happens within the filter logic in getBacktests
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

  it('should set columns for recommendations', () => {
    component.setColumnsForRecommendations();
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

  it('should set columns for portfolio', () => {
    component.setColumnsForPortfolio();
    expect(component.selectedColumns.length).toBe(6);
    expect(component.selectedColumns[0].field).toBe('name');
    expect(component.selectedColumns[0].header).toBe('Stock');
    expect(component.selectedColumns[1].field).toBe('shares');
    expect(component.selectedColumns[1].header).toBe('Shares');
    expect(component.selectedColumns[2].field).toBe('primaryLegs');
    expect(component.selectedColumns[2].header).toBe('Primary Options');
    expect(component.selectedColumns[3].field).toBe('secondaryLegs');
    expect(component.selectedColumns[3].header).toBe('Secondary Options');
    expect(component.selectedColumns[4].field).toBe('pl');
    expect(component.selectedColumns[4].header).toBe('PnL');
    expect(component.selectedColumns[5].field).toBe('netLiq');
    expect(component.selectedColumns[5].header).toBe('NetLiq');
  });

  it('should set table to recommendations view', fakeAsync(() => {
    spyOn(component, 'setColumnsForRecommendations');
    spyOn(component, 'setColumnsForPortfolio');
    component.recommendations = [{ stock: 'XYZ' } as Stock]; // Add some mock data

    component.setTable({ checked: false });
    tick(); // Wait for async operations if any (though none in this branch)

    expect(component.showPortfolio).toBe(false);
    expect(component.setColumnsForRecommendations).toHaveBeenCalled();
    expect(component.setColumnsForPortfolio).not.toHaveBeenCalled();
    expect(component.currentList).toEqual(component.recommendations);
  }));

  it('should set table to portfolio view', fakeAsync(() => {
    spyOn(component, 'setColumnsForRecommendations');
    spyOn(component, 'setColumnsForPortfolio');
    cartServiceSpy.findCurrentPositions.and.returnValue(Promise.resolve([mockPortfolioHolding]));

    component.setTable({ checked: true });
    tick(); // Wait for the promise from findCurrentPositions to resolve

    expect(component.showPortfolio).toBe(true);
    expect(component.setColumnsForPortfolio).toHaveBeenCalled();
    expect(component.setColumnsForRecommendations).not.toHaveBeenCalled();
    expect(cartServiceSpy.findCurrentPositions).toHaveBeenCalled();
    expect(component.currentList.length).toBe(1);
    expect(component.currentList[0].name).toBe(mockPortfolioHolding.name);
    expect(component.currentList[0].pl).toBe(mockPortfolioHolding.pl);
    expect(component.currentList[0].netLiq).toBe(mockPortfolioHolding.netLiq);
    expect(component.currentList[0].shares).toBe(mockPortfolioHolding.shares);
    // Check transformed fields
    expect(component.currentList[0].primaryLegs).toBeNull();
    expect(component.currentList[0].secondaryLegs).toBeNull();
  }));
});
