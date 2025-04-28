import { ChangeDetectorRef, AfterContentChecked, Component, OnDestroy, OnInit } from '@angular/core';

import { CartService } from '@shared/services/cart.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-orders-list',
  templateUrl: './orders-list.component.html',
  styleUrls: ['./orders-list.component.css']
})
export class OrdersListComponent {
  constructor(public cartService: CartService,
    private ref: ChangeDetectorRef
  ) { }


  ngAfterContentChecked() {
    this.ref.detectChanges();
  }
}
