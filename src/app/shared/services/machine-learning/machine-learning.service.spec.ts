import { TestBed } from '@angular/core/testing';

import { MachineLearningService } from './machine-learning.service';

xdescribe('MachineLearningService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: MachineLearningService = TestBed.get(MachineLearningService);
    expect(service).toBeTruthy();
  });
});
