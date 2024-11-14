import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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

  refresh() {
    this.ngOnDestroy();
    this.cartService.cartObserver
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.clearList();
        setTimeout(() => {
          this.buyOrders = Array.from(this.cartService.buyOrders);
          this.sellOrders = Array.from(this.cartService.sellOrders);
          this.otherOrders = Array.from(this.cartService.otherOrders);
          console.log('Buy orders', this.buyOrders);
          console.log('Sell orders', this.sellOrders);
          console.log('Other orders', this.otherOrders);
          this.ref.detectChanges();
        });
      });
  }

  clearList() {
    this.buyOrders = [];
    this.sellOrders = [];
    this.otherOrders = [];
    this.ref.detectChanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
