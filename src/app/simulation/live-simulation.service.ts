import { Injectable } from '@angular/core';
import { LiveSimulationComponent } from './live-simulation/live-simulation.component';
import { DialogService } from 'primeng/dynamicdialog';

@Injectable({
  providedIn: 'root'
})
export class LiveSimulationService {

  constructor(private dialogService: DialogService) { }

  simulate(symbol: string) {
    this.dialogService.open(LiveSimulationComponent, {
      header: 'Live Simulation',
      contentStyle: { 'overflow-y': 'unset' },
      width: '100vw',
      height: '100vh',
      data: {
        symbol: symbol
      }
    });
  }
}
