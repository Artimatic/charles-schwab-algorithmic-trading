import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderDialogComponent } from './order-dialog.component';

describe('OrderDialogComponent', () => {
  let component: OrderDialogComponent;
  let fixture: ComponentFixture<OrderDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OrderDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OrderDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  xit('createshould create', () => {
    expect(component).toBeTruthy();
  });
});
