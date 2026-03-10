import { TestBed } from '@angular/core/testing';

import { IntradayStrategyScannerService } from './intraday-strategy-scanner.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OptionsOrderBuilderService } from './options-order-builder.service';

describe('IntradayStrategyScannerService', () => {
  let service: IntradayStrategyScannerService;

  beforeEach(() => {
    const strategyBuilderSpy = jasmine.createSpyObj('StrategyBuilderService', ['getBullishStocks', 'getBearishStocks']);
    const optionsOrderBuilderSpy = jasmine.createSpyObj('OptionsOrderBuilderService', ['shouldBuyCallOption', 'shouldBuyPutOption']);

    // Provide simple defaults so the scanner can run without pulling in other services
    strategyBuilderSpy.getBullishStocks.and.returnValue(['AAPL']);
    strategyBuilderSpy.getBearishStocks.and.returnValue(['TSLA']);
    optionsOrderBuilderSpy.shouldBuyCallOption.and.returnValue(false);
    optionsOrderBuilderSpy.shouldBuyPutOption.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        IntradayStrategyScannerService,
        { provide: StrategyBuilderService, useValue: strategyBuilderSpy },
        { provide: OptionsOrderBuilderService, useValue: optionsOrderBuilderSpy }
      ]
    });
    service = TestBed.inject(IntradayStrategyScannerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
