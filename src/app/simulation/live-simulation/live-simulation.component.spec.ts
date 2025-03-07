import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LiveSimulationComponent } from './live-simulation.component';
import { ScenarioGeneratorService } from '../scenario-generator.service';
import { CartService } from '@shared/services';
import { AutopilotService } from 'src/app/autopilot/autopilot.service';
import { DialogService } from 'primeng/dynamicdialog';

const mockCartService = {
  createOrderLog: jasmine.createSpy('createOrderLog'),
  getBuyOrders: jasmine.createSpy('getBuyOrders').and.returnValue([]),
  getSellOrders: jasmine.createSpy('getSellOrders').and.returnValue([]),
  getOtherOrders: jasmine.createSpy('getOtherOrders').and.returnValue([])
}
describe('LiveSimulationComponent', () => {
  let component: LiveSimulationComponent;
  let fixture: ComponentFixture<LiveSimulationComponent>;

  beforeEach(() => {
    const spyScenarioGeneratorService = jasmine.createSpyObj('ScenarioGeneratorService', ['testSellLoser', 'sendSignal']);
    const spyAutopilotService = jasmine.createSpyObj('AutopilotService', ['isMarketOpened']);

    TestBed.configureTestingModule({
      declarations: [LiveSimulationComponent],
      providers: [
        { provide: ScenarioGeneratorService, useValue: spyScenarioGeneratorService },
        { provide: CartService, useValue: mockCartService },
        { provide: AutopilotService, useValue: spyAutopilotService }
      ],
    });

    fixture = TestBed.createComponent(LiveSimulationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
