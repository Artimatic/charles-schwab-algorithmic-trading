import { ChangeDetectorRef, AfterContentChecked, Component, OnDestroy, OnInit } from '@angular/core';

import { CartService } from '@shared/services/cart.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-orders-list',
  templateUrl: './orders-list.component.html',
  styleUrls: ['./orders-list.component.css']
})
export class OrdersListComponent implements OnInit, OnDestroy {
  buyOrders = [];
  sellOrders = [];
  otherOrders = [];
  destroy$ = new Subject();

  constructor(public cartService: CartService,
    private ref: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.refresh();
  }

  ngAfterContentChecked() {
    this.ref.detectChanges();
  }

  refresh() {
    this.cartService.cartObserver
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.ref.detectChanges();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
