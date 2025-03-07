import { TestBed } from '@angular/core/testing';

import { OptionsOrderBuilderService } from './options-order-builder.service';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { BacktestService, CartService, ReportingService } from '@shared/services';
import { OptionsDataService } from '@shared/options-data.service';
import { OrderTypes } from '@shared/models/smart-order';
import { of } from 'rxjs';
import { OrderHandlingService } from './order-handling/order-handling.service';
import { PriceTargetService } from './autopilot/price-target.service';

describe('OptionsOrderBuilderService', () => {
  let service: OptionsOrderBuilderService;
  const strategyBuilderServiceSpy = jasmine.createSpyObj('StrategyBuilderService', ['getCallStrangleTrade', 'findOptionsPrice', 'getTradingStrategies', 'getPutStrangleTrade']);
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addSingleLegOptionOrder', 'getAvailableFunds', 'createOptionOrder']);
  const optionsDataServiceSpy = jasmine.createSpyObj('OptionsDataService', ['getImpliedMove']);
  const reportingServiceSpy = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);
  const priceTargetServiceSpy = jasmine.createSpyObj('PriceTargetService', ['getDiff', ]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: StrategyBuilderService, useValue: strategyBuilderServiceSpy },
        { provide: BacktestService, useValue: {} },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: OptionsDataService, useValue: optionsDataServiceSpy },
        { provide: ReportingService, useValue: reportingServiceSpy },
        { provide: PriceTargetService, useValue: priceTargetServiceSpy },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy }
      ]
    });
    service = TestBed.inject(OptionsOrderBuilderService);
  });

  afterEach(() => {
    cartServiceSpy.addSingleLegOptionOrder.calls.reset();
    cartServiceSpy.createOptionOrder.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not create protective put', async () => {
    const testHoldings = [
      {
        "name": "GOOG",
        "pl": -55.50999999999999,
        "netLiq": 0,
        "shares": 0,
        "alloc": 0,
        "cost": 0,
        "recommendation": "Sell",
        "buyReasons": "mfiTrade",
        "sellReasons": "vwma,mfiDivergence",
        "buyConfidence": 0,
        "sellConfidence": 0.5208745611778292,
        "prediction": null,
        "primaryLegs": [
          {
            "symbol": "GOOG  241220C00170000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 1,
            "description": "ALPHABET INC 12/20/2024 $170 Call",
            "averagePrice": 860.51,
            "underlyingSymbol": "GOOG"
          }
        ],
        "assetType": "option"
      }
    ];

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      put: {
        bid: 4.45,
        ask: 4.60
      }
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(4.5);

    await service.createProtectivePutOrder(testHoldings[0]);
    expect(cartServiceSpy.addSingleLegOptionOrder).not.toHaveBeenCalled();
  });

  it('should not create protective put if options price too low', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 191,
        "cost": 0,
        "alloc": 0,
        "recommendation": "None",
        "buyReasons": "mfi",
        "sellReasons": "vwma",
        "buyConfidence": 0.3562896241371037,
        "sellConfidence": -1.260551525157594,
        "prediction": null
      }
    ];
    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      put: {
        bid: 0.45,
        ask: 0.60
      }
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(0.5);

    await service.createProtectivePutOrder(testHoldings[0]);
    expect(cartServiceSpy.addSingleLegOptionOrder).not.toHaveBeenCalled();
  });

  it('should add 1 protective put', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 191,
        "alloc": 0,
        "cost": 0,
        "recommendation": "None",
        "buyReasons": "mfi",
        "sellReasons": "vwma",
        "buyConfidence": 0.3562896241371037,
        "sellConfidence": -1.260551525157594,
        "prediction": null
      }
    ];

    const testStrangleObj = {
      put: {
        symbol: 'Test123',
        bid: 4.45,
        ask: 4.60
      }
    };
    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue(testStrangleObj);

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(4.5);

    await service.createProtectivePutOrder(testHoldings[0]);
    expect(cartServiceSpy.addSingleLegOptionOrder).toHaveBeenCalledWith('OKTA', [testStrangleObj.put], 4.5, 1, OrderTypes.protectivePut, 'Buy', 'Adding protective put');
  });
  it('should add 3 protective put', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 300,
        "alloc": 0,
        "cost": 0,
        "recommendation": "None",
        "buyReasons": "mfi",
        "sellReasons": "vwma",
        "buyConfidence": 0.3562896241371037,
        "sellConfidence": -1.260551525157594,
        "prediction": null
      }
    ];

    const testStrangleObj = {
      put: {
        symbol: 'Test123',
        bid: 4.45,
        ask: 4.60
      }
    };
    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue(testStrangleObj);

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(4.5);

    await service.createProtectivePutOrder(testHoldings[0]);
    expect(cartServiceSpy.addSingleLegOptionOrder).toHaveBeenCalledWith('OKTA', [testStrangleObj.put], 4.5, 3, OrderTypes.protectivePut, 'Buy', 'Adding protective put');
  });

  it('should add balanced trades', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.01
        });
      }
      return of({
        move: 0.05
      });
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        underlying: 'BAC',
        bid: 2.80,
        ask: 2.90
      }
    });

    strategyBuilderServiceSpy.getPutStrangleTrade.and.callFake((symbol: string) => {
      if (symbol === 'MO') {
        return {
          put: {
            symbol: 'MO put 1',
            underlying: 'MO',
            bid: 5.50,
            ask: 5.70
          }
        }
      }
      return {
        put: {
          symbol: 'test put 1',
          underlying: 'TEST',
          bid: 0.80,
          ask: 0.90
        }
      };
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(5.60);
    cartServiceSpy.getAvailableFunds.and.returnValue(50000);

    cartServiceSpy.createOptionOrder.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return {
          holding: {
            symbol: 'BAC123'
          }
        };
      }
      return {
        holding: {
          symbol: 'MO123'
        }
      };
    });

    await service.balanceTrades(['BAC'], ['MO'], 100, 5000, 'test');
    expect(cartServiceSpy.createOptionOrder).toHaveBeenCalledTimes(2);

    expect(cartServiceSpy.createOptionOrder).toHaveBeenCalledWith(
      'BAC', [{ symbol: 'test BAC call', underlying: 'BAC', bid: 2.8, ask: 2.9, quantity: 1 }], 560, 1, 5, 'test', 'Buy', 1
    );

    expect(cartServiceSpy.createOptionOrder).toHaveBeenCalledWith(
      'MO', [{ symbol: 'MO put 1', underlying: 'MO', bid: 5.5, ask: 5.7, quantity: 1 }], 560, 1, 4, 'test', 'Buy', 1
    );
    expect(service.getTradingPairs().length).toEqual(1);
    expect(service.getTradingPairs()[0]).toEqual([{
      holding: {
        symbol: 'BAC123'
      }
    } as any, {
      holding: {
        symbol: 'MO123'
      }
    } as any]);
  });

  it('should not add balanced trades if call price too high', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.05
        });
      }
      return of({
        move: 0.05
      });
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        bid: 80.45,
        ask: 80.60
      }
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(80.50);

    await service.createTradingPair(1000, 5000);
    expect(service.getTradingPairs().length).toEqual(0);
    expect(cartServiceSpy.createOptionOrder).not.toHaveBeenCalled();
  });

  it('should not add balanced trades if calls are too cheap', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.05
        });
      }
      return of({
        move: 0.05
      });
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        bid: 0.45,
        ask: 0.60
      }
    });
    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(0.5);

    await service.createTradingPair(1000, 5000);
    expect(service.getTradingPairs().length).toEqual(0);
  });
  it('should not add trades if stocks too volatile', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.2
        });
      }
      return of({
        move: 0.05
      });
    });

    await service.createTradingPair(1000, 5000);
    expect(service.getTradingPairs().length).toEqual(0);
  });

  it('should get hash value', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.01
        });
      }
      return of({
        move: 0.05
      });
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        underlying: 'BAC',
        bid: 2.80,
        ask: 2.90
      }
    });

    strategyBuilderServiceSpy.getPutStrangleTrade.and.callFake((symbol: string) => {
      if (symbol === 'MO') {
        return {
          put: {
            symbol: 'MO put 1',
            underlying: 'MO',
            bid: 5.50,
            ask: 5.70
          }
        }
      }
      return {
        put: {
          symbol: 'test put 1',
          underlying: 'TEST',
          bid: 0.80,
          ask: 0.90
        }
      };
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(5.60);
    cartServiceSpy.getAvailableFunds.and.returnValue(50000);

    cartServiceSpy.createOptionOrder.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return {
          holding: {
            symbol: 'BAC123'
          }
        };
      }
      return {
        holding: {
          symbol: 'MO123'
        }
      };
    });

    await service.balanceTrades(['BAC'], ['MO'], 100, 5000, 'test');
    expect(service.getTradeHashValue(service.getTradingPairs()[0])).toBe('93acbe56');
    expect(service.getTradeHashValue(service.getTradingPairs()[0])).toBe('93acbe56');
    expect(service.getTradeHashValue([{
      holding: {
        symbol: 'MRNA 241220P00060000'
      }
    } as any, {
      holding: {
        symbol: 'JPM 241220P00210000	'
      }
    } as any])).toBe('1c5adddb');

    expect(service.getTradeHashValue([{
      holding: {
        symbol: 'GOOG 241220C00170000'
      }
    } as any, {
      holding: {
        symbol: 'MSFT 241220P00420000'
      }
    } as any])).toBe('db6ee64b');
  });

  it('should filter out old trading pairs', async () => {
    strategyBuilderServiceSpy.getTradingStrategies.and.returnValue([{
      strategy: {
        "buy": [
          "BAC"
        ],
        "sell": [
          "AXP",
          "KMB",
          "TTD",
          "KMI",
          "MO"
        ]
      }
    }]);

    optionsDataServiceSpy.getImpliedMove.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return of({
          move: 0.01
        });
      }
      return of({
        move: 0.05
      });
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        underlying: 'BAC',
        bid: 2.80,
        ask: 2.90
      }
    });

    strategyBuilderServiceSpy.getPutStrangleTrade.and.callFake((symbol: string) => {
      if (symbol === 'MO') {
        return {
          put: {
            symbol: 'MO put 1',
            underlying: 'MO',
            bid: 5.50,
            ask: 5.70
          }
        }
      }
      return {
        put: {
          symbol: 'test put 1',
          underlying: 'TEST',
          bid: 0.80,
          ask: 0.90
        }
      };
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(5.60);
    cartServiceSpy.getAvailableFunds.and.returnValue(50000);

    cartServiceSpy.createOptionOrder.and.callFake((symbol: string) => {
      if (symbol === 'BAC') {
        return {
          holding: {
            symbol: 'BAC123'
          }
        };
      }
      return {
        holding: {
          symbol: 'MO123'
        }
      };
    });

    service.tradingPairs = [[{
      holding: {
        symbol: 'GOOG 241220C00170000'
      }
    } as any, {
      holding: {
        symbol: 'MSFT 241220P00420000'
      }
    } as any],
    [{
      holding: {
        symbol: 'MRNA 241220P00060000'
      }
    } as any, {
      holding: {
        symbol: 'JPM 241220P00210000	'
      }
    } as any]];
    service.tradingPairDate = { '1c5adddb': 123, 'db6ee64b': new Date().valueOf() - 402000000 };
    await service.balanceTrades(['BAC'], ['MO'], 100, 5000, 'test');
    expect(service.getTradeHashValue(service.getTradingPairs()[0])).toBe('db6ee64b');
    expect(service.getTradingPairs().length).toBe(2);
    expect(service.getTradingPairs()[0]).toEqual([{
      holding: {
        symbol: 'GOOG 241220C00170000'
      }
    } as any, {
      holding: {
        symbol: 'MSFT 241220P00420000'
      }
    } as any]);
    expect(service.getTradingPairs()[1]).toEqual([{
      holding: {
        symbol: 'BAC123'
      }
    } as any, {
      holding: {
        symbol: 'MO123'
      }
    } as any]);
  });
});
