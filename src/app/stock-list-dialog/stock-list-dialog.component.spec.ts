import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockListDialogComponent } from './stock-list-dialog.component';

describe('StockListDialogComponent', () => {
  let component: StockListDialogComponent;
  let fixture: ComponentFixture<StockListDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StockListDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StockListDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
