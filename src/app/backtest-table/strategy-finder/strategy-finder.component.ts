import { Component, OnInit } from '@angular/core';
import { DynamicDialogConfig } from 'primeng/dynamicdialog';
import { StrategyBuilderService } from '../strategy-builder.service';
import { MachineDaytradingService } from 'src/app/machine-daytrading/machine-daytrading.service';

@Component({
  selector: 'app-strategy-finder',
  templateUrl: './strategy-finder.component.html',
  styleUrls: ['./strategy-finder.component.css']
})
export class StrategyFinderComponent implements OnInit {

  constructor(public config: DynamicDialogConfig, 
    private backTestTableService: StrategyBuilderService) { }

  ngOnInit(): void {
    this.backTestTableService.findTrades();
  }
}
