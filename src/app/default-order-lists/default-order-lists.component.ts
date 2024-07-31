import { Component, OnInit, Input, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { OrderTypes, SmartOrder } from '../shared/models/smart-order';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import * as _ from 'lodash';
import { CartService } from '../shared/services/cart.service';
import { Order } from '../shared/models/order';
import { Subject } from 'rxjs';
import {
  debounceTime, distinctUntilChanged, takeUntil
} from 'rxjs/operators';
import { MachineDaytradingService } from '../machine-daytrading/machine-daytrading.service';
import { SchedulerService } from '@shared/service/scheduler.service';
import { MenuItem, SelectItem } from 'primeng/api';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { OrderType } from '@shared/stock-backtest.interface';

export interface DefaultOrders {
  label: string;
  allocation: number;
  side: string;
}

@Component({
  selector: 'app-default-order-lists',
  templateUrl: './default-order-lists.component.html',
  styleUrls: ['./default-order-lists.component.scss']
})
export class DefaultOrderListsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() displayName = 'Add order';
  @Input() defaultSide = { label: 'Buy', value: 'Buy' };
  @Input() display: boolean;
  @Input() hideButton: boolean;
  @Input() prefillOrderForm: Order;
  @Input() defaultLists: DefaultOrders[];
  templateOrders: SmartOrder[];
  addOrderFormGroup: FormGroup;
  selectedDefaultOrders = [];
  private amountChange = new Subject<number>();
  isLoading = false;
  sides: SelectItem[];
  errorMsg: string;
  destroy$ = new Subject();

  pageSteps: MenuItem[];
  cartStep = 0;
  cashBalance = null;
  symbolsQuery = null;
  suggestionsArr = [];

  constructor(private _formBuilder: FormBuilder,
    private cartService: CartService,
    private strategyBuilderService: StrategyBuilderService,
    private schedulerService: SchedulerService,
    private machineDaytradingService: MachineDaytradingService) { }

  async ngOnInit() {
    this.display = false;
    this.hideButton = false;
    this.templateOrders = [];
    this.pageSteps = [{
      label: 'Shopping cart',
      command: () => {
        this.cartStep = 0;
      }
    },
    {
      label: 'Order confirmation',
      command: () => {
        this.cartStep = 1;
      }
    }
    ];

    this.amountChange
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(async (value) => {
        this.cashBalance = value;
        if (!this.defaultLists || !this.defaultLists.length) {
          this.defaultLists = this.createDefaultList();
          const currentHoldings = await this.cartService.findCurrentPositions();
          this.defaultLists = this.defaultLists.concat(currentHoldings.reduce((accumulator, currentValue) => {
            if (currentValue.quantity) {
              let price = Number(currentValue.price);
              const currentValueAllocation = Number((price * Number(currentValue.quantity) / Number(this.cashBalance)).toFixed(2));
              accumulator.push({
                label: currentValue.holding.symbol,
                allocation: currentValueAllocation < 1 && currentValueAllocation > 0 ? currentValueAllocation : this.addOrderFormGroup.value.allocation,
                side: currentValue.side ? currentValue.side : OrderType.Buy
              });
            }
            if (currentValue.primaryLegs) {
              if (!this.cartService.isStrangle(currentValue)) {
                // const price = await this.orderHandlingService.getEstimatedPrice(currentValue.primaryLegs[0].symbol);
                // const currentValueAllocation = Number((price * 100 * Number(currentValue.primaryLegs[0].quantity) / Number(this.cashBalance)).toFixed(2));
                accumulator.push({
                  label: currentValue.primaryLegs[0].symbol,
                  allocation: this.addOrderFormGroup.value.allocation,
                  //allocation: currentValueAllocation < 1 && currentValueAllocation > 0 ? currentValueAllocation : this.addOrderFormGroup.value.allocation,
                  side: currentValue.side ? currentValue.side : OrderType.Buy
                });
              }
            }
            
            return accumulator;
          }, []));
        }
      });

    this.sides = [
      { label: 'Buy', value: 'Buy' },
      { label: 'Sell', value: 'Sell' },
      { label: 'DayTrade', value: 'DayTrade' },
      { label: 'Strangle', value: 'Strangle' }
    ];

    this.setAddOrderForm();

    this.suggestionsArr = this.createSuggestionList();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.prefillOrderForm) {
      this.setAddOrderForm();
    }
  }

  showDialog() {
    this.display = true;
  }

  readStockList() {
    this.symbolsQuery.forEach(query => {
      const symbol = query.label;
      if (symbol.includes(',')) {
        const symbolsTextStr = query.label.trim().toUpperCase().split(',');
        symbolsTextStr.forEach(s => {
          this.addNewOrder(s);
        });
      } else {
        this.addNewOrder(symbol);
      }
    });
  }

  addNewOrder(symbol) {
    const allocationPct = this.addOrderFormGroup.value.allocation;
    this.addOrder(symbol, allocationPct, this.cashBalance);
  }

  addOrder(stock: string, allocationPct: number, total: number, side: string = '') {
    this.isLoading = true;
    stock = stock.toUpperCase();
    this.schedulerService.schedule(() => {
      const cb = (quantity, price) => {
        if (this.templateOrders.findIndex(val => val.holding.symbol === stock) === -1) {
          this.templateOrders.push(this.cartService.buildOrder(stock, quantity, price, side || this.addOrderFormGroup.value.side));
        }
        this.isLoading = false;
      };

      const reject = err => {
        this.isLoading = false;
        if (err) {
          this.errorMsg = err.error ? `${err.error}` : `${err}`;
        }
      };

      this.machineDaytradingService.addOrder(this.addOrderFormGroup.value.side, stock, allocationPct, total, cb, null, reject);
    }, 'adding_order', null, true, 3000);
  }

  async buildStrangle(symbol: string) {
    let optionStrategy = null;
    const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);
    if (backtestResults && backtestResults.ml > 0.5) {
      optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
    } else {
      optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
    }
    console.log('optionStrategy', optionStrategy);

    const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);

    this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
  }


  addCustomList() {
    if (this.addOrderFormGroup.valid) {
      if (this.addOrderFormGroup.value.side === 'Strangle') {
        this.buildStrangle(this.addOrderFormGroup.value.symbol);
      } else {
        const stock = this.addOrderFormGroup.value.symbol;
        const allocationPct = this.addOrderFormGroup.value.allocation;
        const total = this.cashBalance;
        this.addOrder(stock, allocationPct, total);
      }

      this.errorMsg = '';
    } else {
      this.errorMsg = 'Please fix errors.';
    }
  }

  getQuantity(stockPrice: number, allocationPct: number, total: number) {
    const totalCost = _.round(total * allocationPct, 2);
    return _.floor(totalCost / stockPrice);
  }

  delete(event) {
    const foundIdx = this.templateOrders.findIndex((val) => {
      if (val.holding.symbol === event) {
        return true;
      }
      return false;
    });

    this.templateOrders.splice(foundIdx, 1);
  }

  addSelectedList() {
    this.templateOrders.forEach((order: SmartOrder) => {
      this.cartService.addToCart(order);
    });
    this.display = false;
  }

  setAddOrderForm() {
    let defaultSide = 'Buy';
    let defaultSymbol = '';
    if (this.prefillOrderForm) {
      defaultSide = this.prefillOrderForm.side;
      defaultSymbol = this.prefillOrderForm.holding.symbol;
    }
    const initAllocation = 0.1;
    this.addOrderFormGroup = this._formBuilder.group({
      allocation: [initAllocation, Validators.required],
      symbol: [defaultSymbol, Validators.required],
      side: [this.defaultSide.value || defaultSide, Validators.required]
    });
  }

  onShow() {
    if (this.prefillOrderForm) {
      this.addOrderFormGroup = this._formBuilder.group({
        allocation: [1, Validators.required],
        symbol: [this.prefillOrderForm.holding.symbol, Validators.required],
        side: [this.prefillOrderForm.side, Validators.required]
      });
    }
    this.getPortfolioTotal();
  }

  onHide() {
    this.display = false;
  }

  updatedAmount(query: number) {
    this.amountChange.next(query);
  }

  getPortfolioTotal() {
    this.isLoading = true;
    this.machineDaytradingService.getPortfolioBalance()
      .subscribe((data) => {
        const spendBalance = data.liquidationValue - data.longMarketValue;
        this.updatedAmount(spendBalance);
        this.isLoading = false;
      }, () => {
        this.isLoading = false;
      });
  }

  createDefaultList() {
    const daytradeList = sessionStorage.getItem('daytradeList');
    if (daytradeList) {
      const storedList: SmartOrder[] = JSON.parse(sessionStorage.getItem('daytradeList'));

      const retrievedList = storedList.reduce((accumulator, currentValue) => {
        if (currentValue) {
          const currentValueAllocation = Number((Number(currentValue.price) * Number(currentValue.quantity) / Number(this.cashBalance)).toFixed(2));
          const newItem = {
            label: currentValue.holding.symbol,
            allocation: currentValueAllocation < 1 && currentValueAllocation > 0 ? currentValueAllocation : this.addOrderFormGroup.value.allocation,
            side: currentValue.side
          };
          accumulator.push(newItem);
        }
        return accumulator;
      }, []);
      return retrievedList;
    }
    return [];
  }

  createSuggestionList() {
    const daytradeList = sessionStorage.getItem('daytradeList');
    if (daytradeList) {
      const storedList: SmartOrder[] = JSON.parse(sessionStorage.getItem('daytradeList'));

      const retrievedList = storedList.reduce((accumulator, currentValue) => {
        if (currentValue) {
          const newItem = {
            label: currentValue.holding.symbol,
            allocation: this.addOrderFormGroup.value.allocation,
            side: currentValue.side
          };
          accumulator.push(newItem);
        }
        return accumulator;
      }, []);
      return retrievedList;
    }
    return [
      {
        label: 'TQQQ',
        allocation: 1,
        side: 'Buy'
      }
    ];
  }

  addItem() {
    this.selectedDefaultOrders.forEach(tableRow => {
      this.addOrder(tableRow.label, tableRow.allocation, this.cashBalance, tableRow.side);
    });
  }

  filterItems(event) {
    const mainSuggestions = this.createSuggestionList().map(val => {
      return {
        label: val.label,
        value: val
      };
    });
    if (event.query) {
      this.suggestionsArr = [
        { label: event.query, value: event.query }
      ];
    } else {
      this.suggestionsArr = [];
    }

    this.suggestionsArr = this.suggestionsArr.concat(mainSuggestions);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
