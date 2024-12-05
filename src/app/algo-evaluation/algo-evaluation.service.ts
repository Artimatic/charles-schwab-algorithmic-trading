import { Injectable } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { AlgoEvaluationComponent } from './algo-evaluation/algo-evaluation.component';

@Injectable({
  providedIn: 'root'
})
export class AlgoEvaluationService {

  constructor(private dialogService: DialogService) { }

  openDialog(): void {
    this.dialogService.open(AlgoEvaluationComponent, {
      header: 'Backtest',
      width: '90%'
    });
  }
}
