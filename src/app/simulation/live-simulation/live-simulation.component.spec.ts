import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveSimulationComponent } from './live-simulation.component';
import { ScenarioGeneratorService } from '../scenario-generator.service';
import { CartService } from '@shared/services';
import { OrderType } from '@shared/stock-backtest.interface';
import { AutopilotService } from 'src/app/autopilot/autopilot.service';

describe('LiveSimulationComponent', () => {
  let component: LiveSimulationComponent;
  let fixture: ComponentFixture<LiveSimulationComponent>;
  let scenarioGeneratorServiceSpy;
  let cartServiceSpy;
  let autopilotServiceSpy;

  beforeEach(() => {
    const spyScenarioGeneratorService = jasmine.createSpyObj('ScenarioGeneratorService', ['testSellLoser', 'sendSignal']);
    const spyCartService = jasmine.createSpyObj('CartService', ['createOrderLog']);
    spyCartService.buyOrders = [];
    spyCartService.sellOrders = [];
    spyCartService.otherOrders = [];
    const spyAutopilotService = jasmine.createSpyObj('AutopilotService', ['isMarketOpened']);

    TestBed.configureTestingModule({
      declarations: [LiveSimulationComponent],
      providers: [
        { provide: ScenarioGeneratorService, useValue: spyScenarioGeneratorService },
        { provide: CartService, useValue: spyCartService },
        { provide: AutopilotService, useValue: spyAutopilotService },
      ],
    });

    fixture = TestBed.createComponent(LiveSimulationComponent);
    component = fixture.componentInstance;
    scenarioGeneratorServiceSpy = spyOn(spyScenarioGeneratorService, 'testSellLoser').and.returnValue(Promise.resolve());
    scenarioGeneratorServiceSpy = TestBed.inject(ScenarioGeneratorService);
    cartServiceSpy = TestBed.inject(CartService);
    autopilotServiceSpy =  spyOn(spyAutopilotService, 'isMarketOpened');
    fixture.detectChanges();
    component.events = [];
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize lastCart', () => {
    cartServiceSpy.buyOrders = [{ id: '1', holding: { symbol: "A" } } as any] as any;
    cartServiceSpy.sellOrders = [{ id: '2', holding: { symbol: "B" } } as any] as any;
    cartServiceSpy.otherOrders = [{ id: '3', holding: { symbol: "C" } } as any] as any;

    component.ngOnInit();

    expect(component.lastCart.buyOrders).toEqual(cartServiceSpy.buyOrders);
    expect(component.lastCart.sellOrders).toEqual(cartServiceSpy.sellOrders);
    expect(component.lastCart.otherOrders).toEqual(cartServiceSpy.otherOrders);
  });
});
