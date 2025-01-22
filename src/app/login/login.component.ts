import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { AuthenticationService } from '../shared';
import { FormGroup, FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  @Output() credentialSet: EventEmitter<boolean> = new EventEmitter();
  hideSecret = true;
  hideKey = true;
  model: any = {};
  loading = false;
  error = '';
  selectedLogin = '';
  tdaForm: FormGroup;
  selectedItem;
  code = null;
  dialogRef;

  constructor(
    private ref: DynamicDialogRef,
    private authenticationService: AuthenticationService) { }

  ngOnInit() {
    this.tdaForm = new FormGroup({
      accountId: new FormControl(document.cookie
        .split('; ')
        .find((row) => row.startsWith('accountId'))?.replace('accountId=', '') || '', Validators.required),
      appKey: new FormControl(document.cookie
        .split('; ')
        .find((row) => row.startsWith('appKey'))?.replace('appKey=', '') || '', Validators.required),
      secret: new FormControl(document.cookie
        .split('; ')
        .find((row) => row.startsWith('secret'))?.replace('secret=', '') || '', Validators.required),
      callbackUrl: new FormControl(document.cookie
        .split('; ')
        .find((row) => row.startsWith('callbackUrl'))?.replace('callbackUrl=', '') || '', Validators.required),
      saveToCookie: new FormControl(false, Validators.required),
    });

    this.selectedLogin = 'tda';
    this.selectedItem = '';
    const query = new URLSearchParams(window.location.search);
    const code = query.get('code');
    if (code) {
      this.code = code;
      this.getAccessToken();
    }
  }

  getAccessToken() {
    const accountId = sessionStorage.getItem('accountId');

    this.authenticationService.getAccessToken(accountId, this.code)
      .subscribe(() => {
        this.ref?.close();
        history.pushState({}, null, '/');
      });
    this.code = null;
  }

  logout() {
    this.authenticationService.logout();
    window.location.reload();
  }

  signIn() {
    this.loading = true;
    document.cookie = `accountId=${this.tdaForm.value.accountId};SameSite=None;Secure`;
    if (this.tdaForm.value.saveToCookie) {
      document.cookie = `appKey=${this.tdaForm.value.appKey};SameSite=None;Secure`;
      document.cookie = `secret=${this.tdaForm.value.secret};SameSite=None;Secure`;
      document.cookie = `callbackUrl=${this.tdaForm.value.callbackUrl};SameSite=None;Secure`;
    } else {
      document.cookie = 'appKey=;SameSite=None;Secure';
      document.cookie = 'secret=;SameSite=None;Secure';
      document.cookie = 'callbackUrl=;SameSite=None;Secure';
    }

    sessionStorage.setItem('accountId', this.tdaForm.value.accountId);

    this.authenticationService.login(this.tdaForm.value.accountId,
      this.tdaForm.value.appKey,
      this.tdaForm.value.secret,
      this.tdaForm.value.callbackUrl)
      .subscribe(() => {
        this.authenticationService.signIn(this.tdaForm.value.accountId,
          this.tdaForm.value.appKey,
          this.tdaForm.value.secret,
          this.tdaForm.value.callbackUrl);
      });
  }

  selectAccount(account) {
    this.authenticationService.selectTdaAccount(account.accountId);
    this.credentialSet.emit(true);
  }

  removeAccount(account) {
    this.authenticationService.removeTdaAccount(account.accountId);
  }
}
