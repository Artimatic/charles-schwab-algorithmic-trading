import { ChangeDetectorRef, Component } from '@angular/core';

import { CartService } from '@shared/services/cart.service';

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
