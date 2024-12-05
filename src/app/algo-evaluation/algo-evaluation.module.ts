import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlgoEvaluationComponent } from './algo-evaluation/algo-evaluation.component';
import { SharedModule } from '@shared/shared.module';



@NgModule({
  declarations: [
    AlgoEvaluationComponent
  ],
  exports: [
    AlgoEvaluationComponent
  ],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class AlgoEvaluationModule { }
