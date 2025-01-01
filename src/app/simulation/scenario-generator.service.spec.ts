import { TestBed } from '@angular/core/testing';

import { ScenarioGeneratorService } from './scenario-generator.service';

describe('ScenarioGeneratorService', () => {
  let service: ScenarioGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScenarioGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
