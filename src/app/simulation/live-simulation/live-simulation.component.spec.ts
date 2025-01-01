import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveSimulationComponent } from './live-simulation.component';

describe('LiveSimulationComponent', () => {
  let component: LiveSimulationComponent;
  let fixture: ComponentFixture<LiveSimulationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LiveSimulationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveSimulationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
