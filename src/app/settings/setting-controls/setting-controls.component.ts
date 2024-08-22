import { Component } from '@angular/core';
import { GlobalSettingsService } from '../global-settings.service';
import * as moment from 'moment-timezone';

@Component({
  selector: 'app-setting-controls',
  templateUrl: './setting-controls.component.html',
  styleUrls: ['./setting-controls.component.css']
})
export class SettingControlsComponent {
  ismeridian = true;
  constructor(public globalSettingsService: GlobalSettingsService) { }

  toggleMode(): void {
    this.ismeridian = !this.ismeridian;
  }

  toggleBacktesting(): void {
    this.globalSettingsService.backtesting = !this.globalSettingsService.backtesting;
  }

  toggleAutostart(): void {
    this.globalSettingsService.setAutoStart();
  }

  setTradeDate(event) {
    console.log(event);
    this.globalSettingsService.tradeDate = moment(event);
  }
}
