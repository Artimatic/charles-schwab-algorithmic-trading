import { TestBed } from '@angular/core/testing';

import { OptionsOrderBuilderService } from './options-order-builder.service';
import { StrategyBuilderService } from './backtest-table/strategy-builder.service';
import { BacktestService, CartService } from '@shared/services';
import { OptionsDataService } from '@shared/options-data.service';
import { OrderTypes } from '@shared/models/smart-order';

describe('OptionsOrderBuilderService', () => {
  let service: OptionsOrderBuilderService;
  const strategyBuilderServiceSpy = jasmine.createSpyObj('StrategyBuilderService', ['getCallStrangleTrade', 'findOptionsPrice', 'getTradingStrategies']);
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addOptionOrder']);
  const optionsDataServiceSpy = jasmine.createSpyObj('OptionsDataService', ['getImpliedMove']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: StrategyBuilderService, useValue: strategyBuilderServiceSpy },
        { provide: BacktestService, useValue: {} },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: OptionsDataService, useValue: optionsDataServiceSpy }
      ]
    });
    service = TestBed.inject(OptionsOrderBuilderService);
  });

  afterEach(() => {
    cartServiceSpy.addOptionOrder.calls.reset();
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
    expect(cartServiceSpy.addOptionOrder).not.toHaveBeenCalled();
  });

  it('should not create protective put if options price too low', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 191,
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
        bid: 1.45,
        ask: 1.60
      }
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(1.5);

    await service.createProtectivePutOrder(testHoldings[0]);
    expect(cartServiceSpy.addOptionOrder).not.toHaveBeenCalled();
  });

  it('should add 1 protective put', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 191,
        "alloc": 0,
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
    expect(cartServiceSpy.addOptionOrder).toHaveBeenCalledWith('OKTA', [testStrangleObj.put], 4.5, 1, OrderTypes.protectivePut, 'Buy', 'Adding protective put');
  });
  it('should add 3 protective put', async () => {
    const testHoldings = [
      {
        "name": "OKTA",
        "pl": -229.9900000087,
        "netLiq": 13742.45,
        "shares": 300,
        "alloc": 0,
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
    expect(cartServiceSpy.addOptionOrder).toHaveBeenCalledWith('OKTA', [testStrangleObj.put], 4.5, 3, OrderTypes.protectivePut, 'Buy', 'Adding protective put');
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
        return {
          move: 0.01
        }
      }
      return {
        move: 0.05
      }
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        bid: 1.45,
        ask: 1.60
      }
    });
    const testPairsArr = [];
    await service.createTradingPair(testPairsArr, null, 1000, 5000);
    expect(testPairsArr.length).toEqual(1);
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
        return {
          move: 0.01
        }
      }
      return {
        move: 0.05
      }
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        bid: 80.45,
        ask: 80.60
      }
    });

    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(8050);

    const testPairsArr = [];
    await service.createTradingPair(testPairsArr, null, 1000, 5000);
    expect(testPairsArr.length).toEqual(0);
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
        return {
          move: 0.01
        }
      }
      return {
        move: 0.05
      }
    });

    strategyBuilderServiceSpy.getCallStrangleTrade.and.returnValue({
      call: {
        symbol: 'test BAC call',
        bid: 0.45,
        ask: 0.60
      }
    });
    strategyBuilderServiceSpy.findOptionsPrice.and.returnValue(0.5);

    const testPairsArr = [];
    await service.createTradingPair(testPairsArr, null, 1000, 5000);
    expect(testPairsArr.length).toEqual(0);
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
        return {
          move: 0.20
        }
      }
      return {
        move: 0.05
      }
    });

    const testPairsArr = [];
    await service.createTradingPair(testPairsArr, null, 1000, 5000);
    expect(testPairsArr.length).toEqual(0);
  });
});
