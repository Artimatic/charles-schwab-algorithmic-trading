import { TestBed } from '@angular/core/testing';

import { PricingService } from './pricing.service';
import { BacktestService, CartService, PortfolioService } from '@shared/services';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OptionsOrderBuilderService } from '../options-order-builder.service';

xdescribe('PricingService', () => {
  let service: PricingService;
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addOptionOrder', 'getAvailableFunds', 'createOptionOrder']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: BacktestService, useValue: {} },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: PortfolioService, useValue: {} },
        { provide: OptionsOrderBuilderService, useValue: {} },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy }
      ]
    });
    service = TestBed.inject(PricingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
