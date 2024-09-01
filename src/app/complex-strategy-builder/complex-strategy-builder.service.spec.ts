import { TestBed } from '@angular/core/testing';

import { ComplexStrategyBuilderService } from './complex-strategy-builder.service';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { SmartOrder } from '@shared/index';

describe('ComplexStrategyBuilderService', () => {
  let service: ComplexStrategyBuilderService;
  let mockStrategyBuilderService = {
    getComplexStrategy: () => {},
    addComplexStrategy: () => {},
    setComplexStrategy: () => {}
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService }
      ]
    });
    service = TestBed.inject(ComplexStrategyBuilderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should be mark for disassembly', () => {
    
    const testOrder1: SmartOrder = {
      holding: {
        instrument: 'https://api.robinhood.com/instruments/18226051-6bfa-4c56-bd9a-d7575f0245c1/',
        symbol: 'VTI',
        name: 'Vanguard Total Stock Market ETF',
        realtime_price: 125.46
      },
      quantity: 10,
      price: 28.24,
      submitted: false,
      pending: false,
      side: 'Buy',
      useTakeProfit: true,
      useStopLoss: true,
      lossThreshold: -0.002,
      profitTarget: 0.004,
      sellAtClose: true,
      primaryLegs: [
        { symbol: '12345', putCallInd: 'C' }
      ]
    };
    const testOrder2: SmartOrder = {
      holding: {
        instrument: 'https://api.robinhood.com/instruments/18226051-6bfa-4c56-bd9a-d7575f0245c1/',
        symbol: 'VTI',
        name: 'Vanguard Total Stock Market ETF',
        realtime_price: 125.46
      },
      quantity: 10,
      price: 28.24,
      submitted: false,
      pending: false,
      side: 'DayTrade',
      useTakeProfit: true,
      useStopLoss: true,
      lossThreshold: -0.002,
      profitTarget: 0.004,
      sellAtClose: true,
      primaryLegs: [
        { symbol: '9', putCallInd: 'C' }
      ]
    };
    spyOn(mockStrategyBuilderService, 'getComplexStrategy').and.returnValue([
      testOrder1,
      testOrder2
    ]);
    spyOn(mockStrategyBuilderService, 'setComplexStrategy');
    service.markStategyForDissassembly('9');
    expect(mockStrategyBuilderService.setComplexStrategy).toHaveBeenCalledWith([testOrder1]);
  });
});
