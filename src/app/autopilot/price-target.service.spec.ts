import { TestBed } from '@angular/core/testing';

import { PriceTargetService } from './price-target.service';
import { BacktestService, CartService, PortfolioService } from '@shared/services';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { of } from 'rxjs';

describe('PriceTargetService', () => {
  let service: PriceTargetService;
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addOptionOrder', 'getAvailableFunds', 'createOptionOrder', 'portfolioSell', 'isStrangle']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);
  const portfolioServiceSpy = jasmine.createSpyObj('PortfolioService', ['getTdPortfolio']);
  const backtestServiceSpy = jasmine.createSpyObj('BacktestService', ['getLastPriceTiingo']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: BacktestService, useValue: backtestServiceSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: PortfolioService, useValue: portfolioServiceSpy },
        { provide: OptionsOrderBuilderService, useValue: {} },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy }
      ]
    });
    service = TestBed.inject(PriceTargetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate profit loss', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 73.1541361257,
        "currentDayProfitLoss": -112.690000000001,
        "currentDayProfitLossPercentage": -0.76,
        "longQuantity": 191,
        "settledLongQuantity": 191,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "679295105",
          "symbol": "OKTA",
          "netChange": 0.07
        },
        "marketValue": 14771.94,
        "maintenanceRequirement": 4431.58,
        "averageLongPrice": 73.154107853403,
        "taxLotAverageLongPrice": 73.1541361257,
        "longOpenProfitLoss": 799.499999991299,
        "previousSessionLongQuantity": 191,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 13.5951,
        "currentDayProfitLoss": -10.61,
        "currentDayProfitLossPercentage": -0.58,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MSFT.XK40420000",
          "symbol": "MSFT  241220P00420000",
          "description": "Microsoft Corp 12/20/2024 $420 Put",
          "netChange": 0.5189,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MSFT"
        },
        "marketValue": 1812.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 13.59,
        "taxLotAverageLongPrice": 13.5951,
        "longOpenProfitLoss": 452.99,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 1.6051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MO...XK40050000",
          "symbol": "MO    241220P00050000",
          "description": "ALTRIA GROUP INC 12/20/2024 $50 Put",
          "netChange": 0.01,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MO"
        },
        "marketValue": 149,
        "maintenanceRequirement": 0,
        "averageLongPrice": 1.6,
        "taxLotAverageLongPrice": 1.6051,
        "longOpenProfitLoss": -11.51,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 3.9051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRNA.MH50050000",
          "symbol": "MRNA  250117P00050000",
          "description": "MODERNA INC 01/17/2025 $50 Put",
          "netChange": -0.2,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MRNA"
        },
        "marketValue": 790,
        "maintenanceRequirement": 0,
        "averageLongPrice": 3.9,
        "taxLotAverageLongPrice": 3.9051,
        "longOpenProfitLoss": 8.98,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(-0.007036289678282304);
  });
  it('should return true if profit target met', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 73.1541361257,
        "currentDayProfitLoss": 150.690000000001,
        "currentDayProfitLossPercentage": null,
        "longQuantity": 191,
        "settledLongQuantity": 191,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "679295105",
          "symbol": "OKTA",
          "netChange": 0.07
        },
        "marketValue": 14771.94,
        "maintenanceRequirement": 4431.58,
        "averageLongPrice": 73.154107853403,
        "taxLotAverageLongPrice": 73.1541361257,
        "longOpenProfitLoss": 799.499999991299,
        "previousSessionLongQuantity": 191,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 13.5951,
        "currentDayProfitLoss": -10.61,
        "currentDayProfitLossPercentage": -0.58,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MSFT.XK40420000",
          "symbol": "MSFT  241220P00420000",
          "description": "Microsoft Corp 12/20/2024 $420 Put",
          "netChange": 0.5189,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MSFT"
        },
        "marketValue": 1812.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 13.59,
        "taxLotAverageLongPrice": 13.5951,
        "longOpenProfitLoss": 452.99,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 1.6051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MO...XK40050000",
          "symbol": "MO    241220P00050000",
          "description": "ALTRIA GROUP INC 12/20/2024 $50 Put",
          "netChange": 0.01,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MO"
        },
        "marketValue": 149,
        "maintenanceRequirement": 0,
        "averageLongPrice": 1.6,
        "taxLotAverageLongPrice": 1.6051,
        "longOpenProfitLoss": -11.51,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 3.9051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRNA.MH50050000",
          "symbol": "MRNA  250117P00050000",
          "description": "MODERNA INC 01/17/2025 $50 Put",
          "netChange": -0.2,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MRNA"
        },
        "marketValue": 790,
        "maintenanceRequirement": 0,
        "averageLongPrice": 3.9,
        "taxLotAverageLongPrice": 3.9051,
        "longOpenProfitLoss": 8.98,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of({
      'SPY': {
        lastPrice: 579.58,
        closePrice: 575.97
      }
    }));
    service.targetDiff = 0;
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(0.007993864218441227);
    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(true);
  });
  it('should get correct profit loss', async () => {
    expect(Number(service.getDiff(579.04, 581.86).toFixed(4))).toBe(0.0049)
  });

  it('should add order if profit target met', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 5.7051,
        "currentDayProfitLoss": 55,
        "currentDayProfitLossPercentage": 7.38,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0Z....AH50065000",
          "symbol": "Z     250117C00065000",
          "description": "Zillow Group Inc 01/17/2025 $65 Call",
          "netChange": 0.275,
          "type": "VANILLA",
          "putCall": "CALL",
          "underlyingSymbol": "Z"
        },
        "marketValue": 800,
        "maintenanceRequirement": 0,
        "averageLongPrice": 5.7,
        "taxLotAverageLongPrice": 5.7051,
        "longOpenProfitLoss": -341.02,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 18.7651,
        "currentDayProfitLoss": 1400.950000000003,
        "currentDayProfitLossPercentage": 14.93,
        "longQuantity": 5,
        "settledLongQuantity": 5,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0HD...AH50400000",
          "symbol": "HD    250117C00400000",
          "description": "HOME DEPOT INC 01/17/2025 $400 Call",
          "netChange": 2.1969,
          "type": "VANILLA",
          "putCall": "CALL",
          "underlyingSymbol": "HD"
        },
        "marketValue": 10787.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 18.76,
        "taxLotAverageLongPrice": 18.7651,
        "longOpenProfitLoss": 1404.950000000003,
        "previousSessionLongQuantity": 5,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 4.7701,
        "currentDayProfitLoss": -700.000000000001,
        "currentDayProfitLossPercentage": -15.28,
        "longQuantity": 8,
        "settledLongQuantity": 8,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0AXP..MH50250000",
          "symbol": "AXP   250117P00250000",
          "description": "AMERICAN EXPRESS CO 01/17/2025 $250 Put",
          "netChange": -0.025,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "AXP"
        },
        "marketValue": 3880,
        "maintenanceRequirement": 0,
        "averageLongPrice": 4.765,
        "taxLotAverageLongPrice": 4.7701,
        "longOpenProfitLoss": 63.92,
        "previousSessionLongQuantity": 8,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 5.4051,
        "currentDayProfitLoss": 15,
        "currentDayProfitLossPercentage": 1.24,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0ORCL.MH50165000",
          "symbol": "ORCL  250117P00165000",
          "description": "ORACLE CORP 01/17/2025 $165 Put",
          "netChange": -0.025,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "ORCL"
        },
        "marketValue": 1220,
        "maintenanceRequirement": 0,
        "averageLongPrice": 5.4,
        "taxLotAverageLongPrice": 5.4051,
        "longOpenProfitLoss": 138.98,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 10.8051,
        "currentDayProfitLoss": 358.86,
        "currentDayProfitLossPercentage": 11.31,
        "longQuantity": 3,
        "settledLongQuantity": 3,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRVL.LK40075000",
          "symbol": "MRVL  241220C00075000",
          "description": "MARVELL TECHNOLOGY INC 12/20/2024 $75 Call",
          "netChange": 0.9212,
          "type": "VANILLA",
          "putCall": "CALL",
          "underlyingSymbol": "MRVL"
        },
        "marketValue": 3532.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 10.8,
        "taxLotAverageLongPrice": 10.8051,
        "longOpenProfitLoss": 290.97,
        "previousSessionLongQuantity": 3,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 3.8051,
        "currentDayProfitLoss": 510,
        "currentDayProfitLossPercentage": 8.66,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0Z....LK40065000",
          "symbol": "Z     241220C00065000",
          "description": "ZILLOW GROUP INC 12/20/2024 $65 Call",
          "netChange": 0.305,
          "type": "VANILLA",
          "putCall": "CALL",
          "underlyingSymbol": "Z"
        },
        "marketValue": 640,
        "maintenanceRequirement": 0,
        "averageLongPrice": 3.8,
        "taxLotAverageLongPrice": 3.8051,
        "longOpenProfitLoss": -121.02,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      }
    ];

    const testHoldings = [
      {
        "name": "ADI",
        "pl": -10,
        "cost": 1140,
        "netLiq": 1130,
        "pnlPercentage": -0.008771929824561403,
        "shares": 0,
        "alloc": 0,
        "recommendation": "None",
        "buyReasons": "vwma",
        "sellReasons": "",
        "buyConfidence": -1.142384518447035,
        "sellConfidence": 0,
        "prediction": null,
        "primaryLegs": [
          {
            "symbol": "ADI   250117P00210000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 2,
            "description": "ANALOG DEVICES INC 01/17/2025 $210 Put",
            "averagePrice": 570,
            "underlyingSymbol": "ADI"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "SPY",
        "pl": -4.5,
        "cost": 1770,
        "netLiq": 1765.5,
        "pnlPercentage": -0.002542372881355932,
        "shares": 0,
        "alloc": 0,
        "recommendation": null,
        "buyReasons": "",
        "sellReasons": "",
        "buyConfidence": 0,
        "sellConfidence": 0,
        "prediction": null,
        "primaryLegs": [
          {
            "symbol": "SPY   241231C00580000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 1,
            "description": "SPDR S&P 500 12/31/2024 $580 Call",
            "averagePrice": 1770,
            "underlyingSymbol": "SPY"
          }
        ],
        "assetType": "option"
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of({
      'SPY': {
        lastPrice: 575.58,
        closePrice: 575.97
      }
    }));
    orderHandlingServiceSpy.getEstimatedPrice.and.callFake((symbol) => {
      return 5;
    });

    cartServiceSpy.isStrangle.and.returnValue(false);
    const pl = await service.todaysPortfolioPl();

    expect(Number(pl.toFixed(4))).toEqual(0.0786);
    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(true);

    await service.checkProfitTarget(testHoldings);
    expect(cartServiceSpy.addOptionOrder).toHaveBeenCalledTimes(2);
    expect(cartServiceSpy.portfolioSell).not.toHaveBeenCalled();
  });
});