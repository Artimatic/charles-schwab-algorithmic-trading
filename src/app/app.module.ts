import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { ChartModule } from 'angular-highcharts';

// Angular Material imports
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatStepperModule } from '@angular/material/stepper';
import { MatListModule } from '@angular/material/list';
import { MatRippleModule } from '@angular/material/core';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import 'hammerjs';
import { AppComponent } from './app.component';
import { BulkBacktestComponent } from './bulk-backtest';
import { XlsImportComponent } from './xls-import/xls-import.component';
import { RhTableComponent } from './rh-table';
import {
  BacktestService,
  AuthenticationService,
  PortfolioService,
  DaytradeService,
  ReportingService,
  ScoreKeeperService,
  IndicatorsService,
  AlgoService,
  TradeService
} from './shared';

import { RhInputComponent } from './rh-input/rh-input.component';
import { ProductViewComponent } from './product-view/product-view.component';
import { TradeViewComponent } from './trade-view/trade-view.component';
import { InstrumentPipe } from './shared/pipes/instrument.pipe';
import { OrderDialogComponent } from './order-dialog/order-dialog.component';
import { CartService } from './shared/services/cart.service';
import { ExcelService } from './shared/services/excel-service.service';
import { ShoppingListComponent } from './shopping-list/shopping-list.component';
import { BbCardComponent } from './bb-card/bb-card.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { ReportingComponent, ReportDialogComponent } from './reporting/reporting.component';
import { ResearchViewComponent } from './research-view/research-view.component';
import { OptionsViewComponent } from './options-view/options-view.component';
import { ScoreBoardComponent } from './score-board/score-board.component';
import { IntradayBacktestViewComponent } from './intraday-backtest-view/intraday-backtest-view.component';
import { TerminalViewComponent } from './terminal-view/terminal-view.component';
import { OverviewModule } from './overview/overview.module';
import { SettingsModule } from './settings/settings.module';
import { MachineLearningModule } from './machine-learning/machine-learning.module';
import { MlCardComponent } from './ml-card/ml-card.component';
import { TestResultsTableComponent } from './test-results-table/test-results-table.component';
import { ChartDialogComponent } from './chart-dialog/chart-dialog.component';
import { HeaderComponent } from './header/header.component';
import { SharedModule } from './shared/shared.module';
import { RedirectLoginDialogComponent } from './redirect-login-dialog/redirect-login-dialog.component';
import { NeuroCardComponent } from './neuro-card/neuro-card.component';
import { DaytradeScoreBoardComponent } from './daytrade-score-board/daytrade-score-board.component';
import { PokerhandComponent } from './pokerhand/pokerhand.component';

import { MlBatchCardComponent } from './ml-batch-card/ml-batch-card.component';

import { EasyOrdersEditorComponent } from './easy-orders-editor/easy-orders-editor.component';
import { StocklistCleanupComponent } from './stocklist-cleanup/stocklist-cleanup.component';
import { StocklistComponent } from './stocklist/stocklist.component';
import { PortfolioManagementComponent } from './portfolio-management/portfolio-management.component';
import { PortfolioInfoComponent } from './portfolio-info/portfolio-info.component';
import { OrdersListComponent } from './orders-list/orders-list.component';
import { FindBuyComponent } from './find-buy/find-buy.component';
import { DetermineHedgeComponent } from './determine-hedge/determine-hedge.component';
import { SmsCardComponent } from './sms-card/sms-card.component';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { PieAlloctComponent } from './pie-alloct/pie-alloct.component';
import { AiPicksComponent } from './ai-picks/ai-picks.component';
import { AutoBacktestSwitchComponent } from './auto-backtest-switch/auto-backtest-switch.component';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { PasswordModule } from 'primeng/password';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PickListModule } from 'primeng/picklist';
import { TimelineModule } from 'primeng/timeline';
import { DataViewModule } from 'primeng/dataview';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { MessagesModule } from 'primeng/messages';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SplitButtonModule } from 'primeng/splitbutton';
import { StepsModule } from 'primeng/steps';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { TabMenuModule } from 'primeng/tabmenu';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { AutopilotComponent } from './autopilot/autopilot.component';
import { RippleModule } from 'primeng/ripple';
import { BacktestTableComponent } from './backtest-table/backtest-table.component';
import { AddOptionsTradeComponent } from './autopilot/add-options-trade/add-options-trade.component';
import { DaytradeActiveSearchComponent } from './autopilot/daytrade-active-search/daytrade-active-search.component';
import { StockListDialogComponent } from './stock-list-dialog/stock-list-dialog.component';
import { StrategyFinderDialogComponent } from './autopilot/strategy-finder-dialog/strategy-finder-dialog.component';
import { SimulationChartComponent } from './simulation/simulation-chart/simulation-chart.component';
import { AlgoEvaluationModule } from './algo-evaluation/algo-evaluation.module';
import { LiveSimulationComponent } from './simulation/live-simulation/live-simulation.component';
import { StatsCardComponent } from './stats-card/stats-card.component';
import { routes } from './app.routes';

@NgModule({
  declarations: [
    AppComponent,
    BulkBacktestComponent,
    XlsImportComponent,
    RhTableComponent,
    RhInputComponent,
    ProductViewComponent,
    TradeViewComponent,
    InstrumentPipe,
    OrderDialogComponent,
    ShoppingListComponent,
    BbCardComponent,
    ConfirmDialogComponent,
    ReportingComponent,
    ReportDialogComponent,
    ResearchViewComponent,
    OptionsViewComponent,
    ScoreBoardComponent,
    IntradayBacktestViewComponent,
    TerminalViewComponent,
    MlCardComponent,
    TestResultsTableComponent,
    ChartDialogComponent,
    HeaderComponent,
    RedirectLoginDialogComponent,
    NeuroCardComponent,
    DaytradeScoreBoardComponent,
    PokerhandComponent,
    MlBatchCardComponent,
    EasyOrdersEditorComponent,
    StocklistCleanupComponent,
    StocklistComponent,
    PortfolioManagementComponent,
    PortfolioInfoComponent,
    OrdersListComponent,
    FindBuyComponent,
    DetermineHedgeComponent,
    SmsCardComponent,
    PieAlloctComponent,
    AiPicksComponent,
    AutoBacktestSwitchComponent,
    AutopilotComponent,
    BacktestTableComponent,
    AddOptionsTradeComponent,
    DaytradeActiveSearchComponent,
    StockListDialogComponent,
    StrategyFinderDialogComponent,
    SimulationChartComponent,
    LiveSimulationComponent,
    StatsCardComponent,
  ],
  entryComponents: [
    OrderDialogComponent,
    ConfirmDialogComponent,
    ReportDialogComponent,
    ChartDialogComponent,
    RedirectLoginDialogComponent,
    StrategyFinderDialogComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes),
    ChartModule,
    OverviewModule,
    SettingsModule,
    MachineLearningModule,
    SharedModule,
    TimepickerModule.forRoot(),
    // Angular Material modules
    MatSnackBarModule,
    MatInputModule,
    MatToolbarModule,
    MatTooltipModule,
    MatTabsModule,
    MatMenuModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatAutocompleteModule,
    MatExpansionModule,
    MatStepperModule,
    MatListModule,
    MatRippleModule,
    AlgoEvaluationModule,
    // Keep PrimeNG modules for now (will migrate gradually)
    ToastModule,
    InputTextModule,
    DynamicDialogModule,
    PasswordModule,
    CheckboxModule,
    InputTextareaModule,
    PickListModule,
    TimelineModule,
    DataViewModule,
    ButtonModule,
    CardModule,
    TableModule,
    MessagesModule,
    SelectButtonModule,
    SplitButtonModule,
    StepsModule,
    ToolbarModule,
    TooltipModule,
    TabMenuModule,
    OverlayPanelModule,
    RippleModule,
  ],
  providers: [
    BacktestService,
    AuthenticationService,
    PortfolioService,
    CartService,
    ExcelService,
    DaytradeService,
    ReportingService,
    ScoreKeeperService,
    IndicatorsService,
    AlgoService,
    TradeService,
    MessageService,
    DialogService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
