import { TestBed } from '@angular/core/testing';

import { PriceTargetService } from './price-target.service';
import { BacktestService, CartService, PortfolioService, ReportingService } from '@shared/services';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { of } from 'rxjs';
import { GlobalSettingsService } from '../settings/global-settings.service';
import { PortfolioWeightsService } from './portfolio-weights.service';

const mockPortfolioData = [
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

describe('PriceTargetService', () => {
  let service: PriceTargetService;
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addSingleLegOptionOrder', 'getAvailableFunds', 'createOptionOrder', 'portfolioSell', 'isStrangle']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);
  const portfolioServiceSpy = jasmine.createSpyObj('PortfolioService', ['getTdPortfolio', 'getTdBalance']);
  const backtestServiceSpy = jasmine.createSpyObj('BacktestService', ['getLastPriceTiingo']);
  const reportingServiceSpy = jasmine.createSpyObj('ReportingService', ['addAuditLog']);
  const globalSettingsServiceSpy = jasmine.createSpyObj('GlobalSettingsService', ['get10YearYield']);
  const portfolioWeightsServiceSpy = jasmine.createSpyObj('PortfolioWeightsService', ['getPortfolioVolatility']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: BacktestService, useValue: backtestServiceSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: PortfolioService, useValue: portfolioServiceSpy },
        { provide: OptionsOrderBuilderService, useValue: {} },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy },
        { provide: GlobalSettingsService, useValue: globalSettingsServiceSpy },
        { provide: ReportingService, useValue: reportingServiceSpy },
        { provide: PortfolioWeightsService, useValue: portfolioWeightsServiceSpy }
      ]
    });
    service = TestBed.inject(PriceTargetService);
    portfolioWeightsServiceSpy.getPortfolioVolatility.and.returnValue(new Promise((resolve) => {
      resolve(0.1);
    }));

    portfolioServiceSpy.getTdBalance.and.returnValue(of({cashBalance: 80000, liquidationValue: 100000}));
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate profit loss', async () => {
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(mockPortfolioData));
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(-0.007);
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
        "currentDayProfitLoss": 100,
        "currentDayProfitLossPercentage": 10,
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
      },
      {
        "shortQuantity": 0,
        "averagePrice": 89.048384353742,
        "currentDayProfitLoss": -38200.01,
        "currentDayProfitLossPercentage": -43.2,
        "longQuantity": 588,
        "settledLongQuantity": 588,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "COLLECTIVE_INVESTMENT",
          "cusip": "74347X864",
          "symbol": "UPRO",
          "description": "PROSHARES ULTRAPRO S&P 500 ETF",
          "type": "EXCHANGE_TRADED_FUND"
        },
        "marketValue": 51891,
        "maintenanceRequirement": 38918.25,
        "averageLongPrice": 88.759525,
        "taxLotAverageLongPrice": 89.048384353742,
        "longOpenProfitLoss": -469.45,
        "previousSessionLongQuantity": 588,
        "currentDayCost": 39191.67
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of({
      'SPY': {
        quote: {
          lastPrice: 579.58,
          closePrice: 575.97
        }
      }
    }));
    service.targetDiff = 0;
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(0.0137);
    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(true);
  });

  it('should return false if profit target not met', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 73.1541361257,
        "currentDayProfitLoss": -10,
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
      },
      {
        "shortQuantity": 0,
        "averagePrice": 89.048384353742,
        "currentDayProfitLoss": -39462.149999999994,
        "currentDayProfitLossPercentage": -43.2,
        "longQuantity": 588,
        "settledLongQuantity": 588,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "COLLECTIVE_INVESTMENT",
          "cusip": "74347X864",
          "symbol": "UPRO",
          "description": "PROSHARES ULTRAPRO S&P 500 ETF",
          "type": "EXCHANGE_TRADED_FUND"
        },
        "marketValue": 51891,
        "maintenanceRequirement": 38918.25,
        "averageLongPrice": 88.759525,
        "taxLotAverageLongPrice": 89.048384353742,
        "longOpenProfitLoss": -469.45,
        "previousSessionLongQuantity": 588,
        "currentDayCost": 39191.67
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of({
      'SPY': {
        quote: {
          lastPrice: 579.58,
          closePrice: 575.97
        }
      }
    }));
    service.targetDiff = 0;
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(-0.0012);
    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(false);
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

    const testSpyPrice = {
      'SPY': {
        quote: {
          lastPrice: 568.58,
          closePrice: 580
        }
      }
    };

    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of(testSpyPrice));

    orderHandlingServiceSpy.getEstimatedPrice.and.callFake((symbol) => {
      return 5;
    });

    cartServiceSpy.isStrangle.and.returnValue(false);

    expect(service.getDiff(testSpyPrice['SPY'].quote.closePrice, testSpyPrice['SPY'].quote.lastPrice)).toEqual(-0.019689655172413723);

    const pl = await service.todaysPortfolioPl();

    expect(Number(pl.toFixed(4))).toEqual(0.0786);

    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(true);

    await service.checkProfitTarget(testHoldings);
    expect(cartServiceSpy.addSingleLegOptionOrder).toHaveBeenCalledTimes(2);
    expect(cartServiceSpy.portfolioSell).not.toHaveBeenCalled();
  });

  it('should get call put balance', async () => {
    const testHoldings = [
      {
        "name": "FCX",
        "pl": -6.59,
        "cost": 2674.0899999998,
        "netLiq": 2667.5,
        "pnlPercentage": -0.0024643897550197034,
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
            "symbol": "FCX   250117C00045000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 1,
            "description": "FREEPORT-MCMORAN INC 01/17/2025 $45 Call",
            "averagePrice": 430.51000000000005,
            "underlyingSymbol": "FCX"
          },
          {
            "symbol": "FCX   250117C00047000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 7,
            "description": "FREEPORT-MCMORAN INC 01/17/2025 $47 Call",
            "averagePrice": 320.5114285714,
            "underlyingSymbol": "FCX"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "JNJ",
        "pl": 661.42,
        "cost": 1683.5799999998003,
        "netLiq": 2345,
        "pnlPercentage": 0.39286520391076074,
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
            "symbol": "JNJ   250117P00155000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 7,
            "description": "JOHNSON & JOHNSON 01/17/2025 $155 Put",
            "averagePrice": 240.51142857140002,
            "underlyingSymbol": "JNJ"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "AMD",
        "pl": -41.02,
        "cost": 661.02,
        "netLiq": 620,
        "pnlPercentage": -0.06205561102538498,
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
            "symbol": "AMD   241213C00155000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 2,
            "description": "Advanced Micro Device Inc 12/13/2024 $155 Call",
            "averagePrice": 330.51,
            "underlyingSymbol": "AMD"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "C",
        "pl": 57.96,
        "cost": 1462.04,
        "netLiq": 1520,
        "pnlPercentage": 0.03964323821509674,
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
            "symbol": "C     250117P00065000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 4,
            "description": "Citigroup Inc 01/17/2025 $65 Put",
            "averagePrice": 365.51,
            "underlyingSymbol": "C"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "CRM",
        "pl": -73.01,
        "cost": 1900.5099999999998,
        "netLiq": 1827.5,
        "pnlPercentage": -0.0384160041252085,
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
            "symbol": "CRM   250117P00300000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 1,
            "description": "Salesforce Inc 01/17/2025 $300 Put",
            "averagePrice": 1900.5099999999998,
            "underlyingSymbol": "CRM"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "AMZN",
        "pl": -193.02999999999997,
        "cost": 1760.53,
        "netLiq": 1567.5,
        "pnlPercentage": -0.10964311883353307,
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
            "symbol": "AMZN  241213C00200000",
            "putCall": "CALL",
            "putCallInd": "C",
            "quantity": 1,
            "description": "Amazon.com Inc 12/13/2024 $200 Call",
            "averagePrice": 550.51,
            "underlyingSymbol": "AMZN"
          }
        ],
        "assetType": "option",
        "secondaryLegs": [
          {
            "symbol": "AMZN  241213P00195000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 2,
            "description": "Amazon.com Inc 12/13/2024 $195 Put",
            "averagePrice": 605.01,
            "underlyingSymbol": "AMZN"
          }
        ]
      },
      {
        "name": "CL",
        "pl": -96.02,
        "cost": 501.02000000000004,
        "netLiq": 405,
        "pnlPercentage": -0.19164903596662802,
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
            "symbol": "CL    250117P00092500",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 2,
            "description": "COLGATE PALMOLIVE CO 01/17/2025 $92.5 Put",
            "averagePrice": 250.51000000000002,
            "underlyingSymbol": "CL"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "ORCL",
        "pl": -70.51,
        "cost": 520.51,
        "netLiq": 450,
        "pnlPercentage": -0.1354632956139171,
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
            "symbol": "ORCL  241220P00160000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 1,
            "description": "ORACLE CORP 12/20/2024 $160 Put",
            "averagePrice": 520.51,
            "underlyingSymbol": "ORCL"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "NFLX",
        "pl": -323.01,
        "cost": 2390.51,
        "netLiq": 2067.5,
        "pnlPercentage": -0.13512179409414735,
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
            "symbol": "NFLX  241220P00755000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 1,
            "description": "NETFLIX INC 12/20/2024 $755 Put",
            "averagePrice": 2390.51,
            "underlyingSymbol": "NFLX"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "UPRO",
        "pl": -62.1236,
        "assetType": "collective_investment",
        "netLiq": 3774.79,
        "shares": 44,
        "cost": 3836.91,
        "pnlPercentage": -0.016191049568532987,
        "alloc": 0,
        "recommendation": null,
        "buyReasons": "",
        "sellReasons": "",
        "buyConfidence": 0,
        "sellConfidence": 0,
        "prediction": null
      },
      {
        "name": "BSX",
        "pl": -3.58,
        "cost": 1543.5799999998,
        "netLiq": 1540,
        "pnlPercentage": -0.0023192837429873354,
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
            "symbol": "BSX   250117P00082500",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 7,
            "description": "BOSTON SCIENTIFIC CORP 01/17/2025 $82.5 Put",
            "averagePrice": 220.51142857140002,
            "underlyingSymbol": "BSX"
          }
        ],
        "assetType": "option"
      },
      {
        "name": "WMT",
        "pl": -138.02,
        "cost": 473.02,
        "netLiq": 335,
        "pnlPercentage": -0.29178470254957506,
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
            "symbol": "WMT   241220P00080000",
            "putCall": "PUT",
            "putCallInd": "P",
            "quantity": 2,
            "description": "WALMART INC 12/20/2024 $80 Put",
            "averagePrice": 236.51,
            "underlyingSymbol": "WMT"
          }
        ],
        "assetType": "option"
      }
    ];

    const result = service.getCallPutBalance(testHoldings);
    expect(result.call).toEqual(3287.5);
    expect(result.put).toEqual(10490);
  });
});