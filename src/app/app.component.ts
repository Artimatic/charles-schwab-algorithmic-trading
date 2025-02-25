import { Component, OnInit, AfterViewInit } from '@angular/core';

import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/share';
import { BacktestService, AuthenticationService, ReportingService } from './shared';
import { ServiceStatus } from './shared/models/service-status';
import { GlobalSettingsService } from './settings/global-settings.service';
import { GlobalTaskQueueService } from '@shared/services/global-task-queue.service';
import { MenuItem, MessageService } from 'primeng/api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  dataStatus: boolean;
  dataText = 'OFFLINE';
  mlStatus: boolean;
  mlText = 'OFFLINE';
  items: MenuItem[];

  constructor(private backtestService: BacktestService,
    private authenticationService: AuthenticationService,
    private globalSettingsService: GlobalSettingsService,
    private reportingService: ReportingService,
    private globalTaskQueueService: GlobalTaskQueueService,
    private messageService: MessageService) { }

  ngOnInit() {
    this.checkStatus();
    this.globalSettingsService.initGlobalSettings();
    this.globalTaskQueueService.startTasks();
    this.items = [
      {
        label: 'Algotrader',
        styleClass: 'app-title',
        disabled: true
      },
      {
        label: 'Live Trading',
        icon: 'account_balance',
        routerLink: '/'
      },
      {
        label: 'Backtesting',
        routerLink: '/research'
      },
      {
        label: 'Additional Options',
        items: [{
          label: 'Machine Learning',
          icon: 'pi pi-fw pi-prime',
          routerLink: '/deep-analysis/machine-learning'
        },
        {
          label: 'Portfolio Management',
          icon: 'pi pi-fw pi-money-bill',
          routerLink: '/portfolio-managment'
        },
        {
          label: 'Daytrade Backtest',
          routerLink: '/backtest'
        }
      ]
      },
      {
        label: 'Export Logs',
        icon: 'pi pi-fw pi-file-excel',
        command: () => {
          this.exportLog();
        }
      }
    ];
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.authenticationService.retrieveLocalAccounts();
    }, 1000);
  }

  exportLog() {
    this.reportingService.exportAuditHistory();
  }

  logOut() {
    this.authenticationService.logout();
  }

  checkStatus() {
    this.backtestService.pingGoliath().subscribe(
      (data: ServiceStatus) => {
        if (data) {
          switch (data.status) {
            case 'UP':
              this.dataStatus = true;
              this.dataText = 'ONLINE';
              break;
            default:
              this.dataStatus = false;
              this.dataText = 'OFFLINE';
              break;
          }
        }
      },
      () => {
        this.dataStatus = false;
      });

    this.backtestService.pingArmidillo().subscribe(
      (data: ServiceStatus) => {
        if (data) {
          switch (data.status) {
            case 'UP':
              this.mlStatus = true;
              this.mlText = 'ONLINE';
              break;
            default:
              this.mlStatus = false;
              this.mlText = 'OFFLINE';
              this.messageService.add({ severity: 'error', summary: 'Machine learning service is not start', sticky: true });
              break;
          }
        }
      },
      () => {
        this.mlStatus = false;
      });
  }

  launchLogin() {
    this.authenticationService.openLoginDialog();
  }
}
