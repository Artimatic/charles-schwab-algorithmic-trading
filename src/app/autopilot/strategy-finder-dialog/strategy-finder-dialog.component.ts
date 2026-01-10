import { Component, OnInit } from '@angular/core';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { OptionsOrderBuilderService } from '../../strategies/options-order-builder.service';
import { AutopilotService } from '../autopilot.service';
import { SmartOrder } from '@shared/index';

@Component({
  selector: 'app-strategy-finder-dialog',
  templateUrl: './strategy-finder-dialog.component.html',
  styleUrls: ['./strategy-finder-dialog.component.scss']
})
export class StrategyFinderDialogComponent implements OnInit {
  showSavedStrategies = false;
  tradingPairs: SmartOrder[][] = [];

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    public autopilotService: AutopilotService
  ) { }

  ngOnInit(): void {
    if (this.config && this.config.data && this.config.data.tradingPairs) {
      this.tradingPairs = this.config.data.tradingPairs;
    } else {
      this.tradingPairs = this.optionsOrderBuilderService.getTradingPairs();
    }
  }

  close() {
    this.ref.close();
  }
}
