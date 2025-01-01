import { Component, OnInit } from '@angular/core';
import { ScenarioGeneratorService } from '../scenario-generator.service';
import { CartService } from '@shared/services';
import { AlgoQueueItem, TradeService } from '@shared/services/trade.service';
import { OrderType } from '@shared/stock-backtest.interface';
import { AutopilotService } from 'src/app/autopilot/autopilot.service';

interface TestEvent {
  status: string;
  date: string;
  expected: string;
  result: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-live-simulation',
  templateUrl: './live-simulation.component.html',
  styleUrls: ['./live-simulation.component.css']
})
export class LiveSimulationComponent implements OnInit {
  events: TestEvent[];

  lastCart = {
    buyOrders: [],
    sellOrders: [],
    otherOrders: []
  };

  constructor(private scenarioGeneratorService: ScenarioGeneratorService,
    private cartService: CartService,
    private autopilotService: AutopilotService
  ) { }

  ngOnInit(): void {
    this.lastCart = {
      buyOrders: this.cartService.buyOrders,
      sellOrders: this.cartService.sellOrders,
      otherOrders: this.cartService.otherOrders
    };

    this.startSimulation();
  }

  createSuccessEvent(expected: string, result: string) {
    this.events.push({
      status: 'success',
      date: new Date().toDateString(),
      expected: expected,
      result: result,
      icon: 'pi pi-check', 
      color: '#0F9117'
    });
  }

  createFailedEvent(expected: string, result: string) {
    this.events.push({
      status: 'failed',
      date: new Date().toDateString(),
      expected: expected,
      result: result,
      icon: 'pi pi-times', 
      color: '#ff0000'
    });
  }

  async startSimulation() {
    const opened = await this.autopilotService.isMarketOpened();
    if (opened) {
      return;
    }
    await this.scenarioGeneratorService.testSellLoser();
    const newOrder = this.cartService.sellOrders.find(order => !this.lastCart.sellOrders.find(lastOrder => lastOrder.id === order.id));
    if (newOrder) {
      const log = this.cartService.createOrderLog(newOrder, 'Sell Loser');
      this.createSuccessEvent('Create order to sell loser', log);
      this.scenarioGeneratorService.sendSignal(newOrder.holding.symbol, OrderType.Buy);
      this.createSuccessEvent('Send signal to sell loser', 'Sell');
    } else {
      this.createFailedEvent('Create order to sell loser', 'No new order');
    }
  }
}
