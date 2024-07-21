import { Component, OnDestroy, OnInit } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { Subject } from 'rxjs';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';

@Component({
  selector: 'app-add-options-trade',
  templateUrl: './add-options-trade.component.html',
  styleUrls: ['./add-options-trade.component.css']
})
export class AddOptionsTradeComponent implements OnInit, OnDestroy {
  symbolsQuery = null;
  defaultSuggestions = [{ label: 'HUBS,GOOGL,SNOW' }];
  suggestionsArr = [];
  processSymbol$ = new Subject<string>();
  symbolsArr = [];
  isLoading = false;

  constructor(private strategyBuilderService: StrategyBuilderService,
    private ref: DynamicDialogRef) { }


  ngOnInit() {
    const storedSuggestions = this.strategyBuilderService.getStorage('strangle_suggestions');
    for (const s in storedSuggestions) {
      this.suggestionsArr.push({ label: s })
    }
    this.suggestionsArr = this.suggestionsArr.concat(this.defaultSuggestions);
    this.processSymbol$.subscribe(sym => {
      this.buildStrangle(sym);
    });
  }

  processList() {
    this.isLoading = true;
    this.symbolsQuery.forEach(query => {
      const symbol = query.label;
      if (symbol.includes(',')) {
        this.symbolsArr = query.label.trim().toUpperCase().split(',');
        this.buildStrangle(this.symbolsArr.pop());
      } else {
        this.buildStrangle(symbol);
      }
    });
  }

  async buildStrangle(symbol: string) {
    if (symbol) {
      let optionStrategy = null;
      const backtestResults = await this.strategyBuilderService.getBacktestData(symbol);
      if (backtestResults && backtestResults.ml > 0.6) {
        optionStrategy = await this.strategyBuilderService.getCallStrangleTrade(symbol);
      } else if (backtestResults && backtestResults.ml < 0.2) {
        optionStrategy = await this.strategyBuilderService.getPutStrangleTrade(symbol);
      }

      if (optionStrategy.call && optionStrategy.put) {
        const price = this.strategyBuilderService.findOptionsPrice(optionStrategy.call.bid, optionStrategy.call.ask) + this.strategyBuilderService.findOptionsPrice(optionStrategy.put.bid, optionStrategy.put.ask);
        console.log('optionStrategy', optionStrategy, price);

        this.strategyBuilderService.addStrangle(symbol, price, optionStrategy);
      }
      this.saveToStorage(symbol);
      if (this.symbolsArr.length) {
        await this.delayRequest();
        this.processSymbol$.next(this.symbolsArr.pop());
      } else {
        this.isLoading = false;
        this.closeDialog();
      }
    } else {
      this.closeDialog();
    }
  }

  delayRequest() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 5000);
    });
  }

  filterItems(event) {
    if (event.query) {
      const foundSuggestions = this.suggestionsArr.filter(suggestion => suggestion.label.includes(event.query));
      if (foundSuggestions.length) {
        this.suggestionsArr = foundSuggestions;
      } else {
        this.suggestionsArr = [
          { label: event.query.toUpperCase() }
        ];
      }
    }
    this.suggestionsArr = [].concat(this.suggestionsArr);
    console.log('filter', this.suggestionsArr);
  }

  closeDialog() {
    this.ref.close();
  }

  saveToStorage(symbol) {
    this.strategyBuilderService.addToStorage('strangle_suggestions', symbol, true);
  }
  ngOnDestroy() {
    this.processSymbol$.next();
    this.processSymbol$.complete();
  }
}
