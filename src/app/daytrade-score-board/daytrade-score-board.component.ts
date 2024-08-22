import { Component, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import * as moment from 'moment-timezone';
import { Order } from '../shared/models/order';
import { ScoreKeeperService } from '../shared';

@Component({
  selector: 'app-daytrade-score-board',
  templateUrl: './daytrade-score-board.component.html',
  styleUrls: ['./daytrade-score-board.component.css']
})
export class DaytradeScoreBoardComponent implements OnChanges, OnInit {
  @Input() buyOrders: Order[];
  @Input() otherOrders: Order[];
  @Input() totalScore: number;
  scoreTable;

  constructor(private scoreKeeperService: ScoreKeeperService) { }

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.totalScore) {
      this.getScores();
    }
  }

  getScores() {
    this.scoreTable = this.scoreKeeperService.recentTradeArr.sort((a, b) => moment(a.closeDate).valueOf() -  moment(b.closeDate).valueOf());
  }
}
