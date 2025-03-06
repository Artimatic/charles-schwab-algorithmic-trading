import { TestBed } from '@angular/core/testing';
import { ScenarioGeneratorService } from './scenario-generator.service';
import { AutopilotService } from '../autopilot/autopilot.service';
import { CartService } from '@shared/services/cart.service';
import { TradeService } from '@shared/services/trade.service';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { Subject } from 'rxjs';
import { OrderType } from '@shared/stock-backtest.interface';
import { DaytradeRecommendation } from '@shared/stock-backtest.interface';

describe('ScenarioGeneratorService', () => {
  let service: ScenarioGeneratorService;
  let autopilotServiceSpy: jasmine.SpyObj<AutopilotService>;
  let cartServiceSpy: jasmine.SpyObj<CartService>;
  let tradeServiceSpy: jasmine.SpyObj<TradeService>;
  let optionsOrderBuilderServiceSpy: jasmine.SpyObj<OptionsOrderBuilderService>;

  beforeEach(() => {
    const spyAutopilotService = jasmine.createSpyObj('AutopilotService', ['sellLoser']);
    const spyCartService = jasmine.createSpyObj('CartService', ['findCurrentPositions']);
    const spyTradeService = jasmine.createSpyObj('TradeService', ['']);
    spyTradeService.algoQueue = new Subject();
    const spyOptionsOrderBuilderService = jasmine.createSpyObj('OptionsOrderBuilderService', ['addOptionByBalance', 'balanceTrades', 'addTradingPair']);

    TestBed.configureTestingModule({
      providers: [
        ScenarioGeneratorService,
        { provide: AutopilotService, useValue: spyAutopilotService },
        { provide: CartService, useValue: spyCartService },
        { provide: TradeService, useValue: spyTradeService },
        { provide: OptionsOrderBuilderService, useValue: spyOptionsOrderBuilderService },
      ],
    });

    service = TestBed.inject(ScenarioGeneratorService);
    autopilotServiceSpy = TestBed.inject(AutopilotService) as jasmine.SpyObj<AutopilotService>;
    cartServiceSpy = TestBed.inject(CartService) as jasmine.SpyObj<CartService>;
    tradeServiceSpy = TestBed.inject(TradeService) as jasmine.SpyObj<TradeService>;
    optionsOrderBuilderServiceSpy = TestBed.inject(OptionsOrderBuilderService) as jasmine.SpyObj<OptionsOrderBuilderService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call sellLoser on autopilotService', async () => {
    const mockHoldings = [{ symbol: 'AAPL', quantity: 1 }];
    cartServiceSpy.findCurrentPositions.and.returnValue(mockHoldings);
    await service.testSellLoser();
    expect(autopilotServiceSpy.sellLoser).toHaveBeenCalledWith(mockHoldings);
  });

  it('should call addOptionByBalance with correct parameters for testBuyCall', () => {
    service.testBuyCall();
    expect(optionsOrderBuilderServiceSpy.addOptionByBalance).toHaveBeenCalledWith('SPY', 2000, 'Test buying calls', true);
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      expect(queueItem.symbol).toEqual('SPY');
      expect(queueItem.reset).toEqual(true);
    });
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      if(!queueItem.reset){
        expect(queueItem.symbol).toEqual('SPY');
        expect(queueItem.analysis.recommendation).toEqual(OrderType.Buy);
        expect(queueItem.analysis.mfi).toEqual(DaytradeRecommendation.Bullish);
        expect(queueItem.analysis.vwma).toEqual(DaytradeRecommendation.Bullish);
      }
    });
  });

  it('should call addOptionByBalance with correct parameters for testBuyPut', () => {
    service.testBuyPut();
    expect(optionsOrderBuilderServiceSpy.addOptionByBalance).toHaveBeenCalledWith('AAPL', 2000, 'Test buying puts', false);
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      expect(queueItem.symbol).toEqual('AAPL');
      expect(queueItem.reset).toEqual(true);
    });
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      if(!queueItem.reset){
        expect(queueItem.symbol).toEqual('AAPL');
        expect(queueItem.analysis.recommendation).toEqual(OrderType.Sell);
        expect(queueItem.analysis.mfi).toEqual(DaytradeRecommendation.Bullish);
        expect(queueItem.analysis.vwma).toEqual(DaytradeRecommendation.Bullish);
      }
    });
  });

  it('should call balanceTrades and addTradingPair with correct parameters for testTradingPair', async () => {
    const mockOptions = [{ symbol: 'NVDA' }, { symbol: 'AMD' }];
    optionsOrderBuilderServiceSpy.balanceTrades.and.returnValue(mockOptions);
    await service.testTradingPair();
    expect(optionsOrderBuilderServiceSpy.balanceTrades).toHaveBeenCalledWith(['NVDA'], ['AMD'], 1000, 5000, 'Test trading pair');
    expect(optionsOrderBuilderServiceSpy.addTradingPair).toHaveBeenCalledWith(mockOptions, 'Test trading pair');
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      expect(queueItem.symbol).toEqual('NVDA');
      expect(queueItem.reset).toEqual(true);
    });
  });

  it('should send correct signal through algoQueue', () => {
    service.sendSignal('TEST', OrderType.Buy);
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      if(queueItem.reset) {
          expect(queueItem.symbol).toEqual('TEST');
      } else {
          expect(queueItem.symbol).toEqual('TEST');
          expect(queueItem.analysis.recommendation).toEqual(OrderType.Buy);
      }
    });
  });
  it('should send correct signal through algoQueue sell', () => {
    service.sendSignal('TEST2', OrderType.Sell);
    tradeServiceSpy.algoQueue.subscribe((queueItem) => {
      if(queueItem.reset) {
          expect(queueItem.symbol).toEqual('TEST2');
      } else {
          expect(queueItem.symbol).toEqual('TEST2');
          expect(queueItem.analysis.recommendation).toEqual(OrderType.Sell);
      }
    });
  });
});
