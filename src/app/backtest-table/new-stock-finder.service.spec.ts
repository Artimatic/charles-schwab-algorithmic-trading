import { TestBed } from '@angular/core/testing';
import { NewStockFinderService } from './new-stock-finder.service';
import { StrategyBuilderService } from './strategy-builder.service';
import { FullList } from '../rh-table/backtest-stocks.constant';

describe('NewStockFinderService', () => {
  let service: NewStockFinderService;
  let mockStrategyBuilderService: jasmine.SpyObj<StrategyBuilderService>;

  beforeEach(() => {
    mockStrategyBuilderService = jasmine.createSpyObj('StrategyBuilderService', [
      'getRecentBacktest',
      'getCallStrangleTrade',
      'addToNewStocks',
    ]);

    TestBed.configureTestingModule({
      providers: [
        NewStockFinderService,
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
      ],
    });
    service = TestBed.inject(NewStockFinderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add old list to newStocks', () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    service.addOldList();
    expect(mockStrategyBuilderService.getRecentBacktest).toHaveBeenCalledTimes(FullList.length);
    expect(service.getNewStocks().length).toBe(FullList.length);
  });

  it('should add stock to newStocks if it does not exist', () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    service.addStock('AAPL');
    expect(service.getNewStocks()).toContain('AAPL');
    expect(mockStrategyBuilderService.getRecentBacktest).toHaveBeenCalledWith('AAPL', 100);
  });

  it('should not add stock to newStocks if it already exists', () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(true);
    service.addStock('AAPL');
    expect(service.getNewStocks().length).toBe(0);
    expect(mockStrategyBuilderService.getRecentBacktest).toHaveBeenCalledWith('AAPL', 100);
  });

  it('should get new stocks', () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    service.addStock('AAPL');
    service.addStock('MSFT');
    const newStocks = service.getNewStocks();
    expect(newStocks).toContain('AAPL');
    expect(newStocks).toContain('MSFT');
  });

  it('should process one stock and add it to new stocks if bullishStrangle is valid', async () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    mockStrategyBuilderService.getCallStrangleTrade.and.returnValue(
      Promise.resolve({ call: {}, put: {} })
    );
    service.addStock('AAPL');
    await service.processOneStock();
    expect(mockStrategyBuilderService.getCallStrangleTrade).toHaveBeenCalledWith('AAPL');
    expect(mockStrategyBuilderService.addToNewStocks).toHaveBeenCalledWith('AAPL');
    expect(service.getNewStocks().length).toBe(0);
  });

  it('should process one stock and not add to new stocks if bullishStrangle is not valid', async () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    mockStrategyBuilderService.getCallStrangleTrade.and.returnValue(
      Promise.resolve(null)
    );
    service.addStock('AAPL');
    await service.processOneStock();
    expect(mockStrategyBuilderService.getCallStrangleTrade).toHaveBeenCalledWith('AAPL');
    expect(mockStrategyBuilderService.addToNewStocks).not.toHaveBeenCalled();
    expect(service.getNewStocks().length).toBe(0);
  });

  it('should do nothing if there are no new stocks to process', async () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(false);
    await service.processOneStock();
    expect(mockStrategyBuilderService.getCallStrangleTrade).not.toHaveBeenCalled();
    expect(mockStrategyBuilderService.addToNewStocks).not.toHaveBeenCalled();
  });

  it('should not add stock if already present', async () => {
    mockStrategyBuilderService.getRecentBacktest.and.returnValue(true);
    service.addStock('AAPL');
    await service.processOneStock();
    expect(mockStrategyBuilderService.getCallStrangleTrade).not.toHaveBeenCalled();
    expect(mockStrategyBuilderService.addToNewStocks).not.toHaveBeenCalled();
    expect(service.getNewStocks().length).toBe(0);
  });
});
