import { Injectable } from '@angular/core';
import { PortfolioService } from '@shared/services';
import { Subject } from 'rxjs';

interface StreamerInfo {
  streamerSocketUrl: string;
  schwabClientCustomerId: string;
  schwabClientCorrelId: string;
  schwabClientChannel: string;
  schwabClientFunctionId: string;
};
interface Accounts {
  accountNumber: string;
  primaryAccount: boolean;
  type: string;
  nickName: string;
  accountColor: string;
  displayAcctId: string;
  autoPositionEffect: boolean;
}

interface Offers {
  level2Permissions: boolean;
  mktDataPermission: string;
}

interface UserPreference {
  streamerInfo: StreamerInfo[];
  accounts: Accounts[];
  offers: Offers[];
}
@Injectable({
  providedIn: 'root'
})
export class WebsocketStreamerService {
  private webSocket;
  private webSocketSubject = new Subject();
  private streamPreferences;

  constructor(private portfolioService: PortfolioService) { }

  connect() {
    this.portfolioService.getUserPreferences().subscribe((pref: UserPreference) => {
      this.streamPreferences = pref;
      this.webSocket = new WebSocket(
        pref.streamerInfo[0].streamerSocketUrl
      );
    });
  }

  getSubject() {
    return this.webSocketSubject;
  }

  send(message) {
    this.webSocket.send(JSON.stringify(message));
  }

  receive() {
    this.webSocket.onmessage = (event) => {
      console.log(event.data);
      this.webSocketSubject.next(event.data);
    };
  }

  // this method is used to end web socket connection
  disconnectSocket() {
    this.webSocket.close();
  }

  jsonToQueryString(json) {
    return Object.keys(json).map(function (key) {
      return encodeURIComponent(key) + '=' +
        encodeURIComponent(json[key]);
    }).join('&');
  }

  sendRequest() {
    const credentials = {
      userid: this.streamPreferences.accounts[0].accountId,
      token: this.streamPreferences.streamerInfo.token,
      company: this.streamPreferences.accounts[0].company,
      segment: this.streamPreferences.accounts[0].segment,
      cddomain: this.streamPreferences.accounts[0].accountCdDomainId,
      usergroup: this.streamPreferences.streamerInfo.userGroup,
      accesslevel: this.streamPreferences.streamerInfo.accessLevel,
      appid: this.streamPreferences.streamerInfo.appId,
      acl: this.streamPreferences.streamerInfo.acl
    }
    const request = {
      requests: [
        {
          service: 'ADMIN',
          command: 'LOGIN',
          requestid: 0,
          account: this.streamPreferences.accounts[0].accountId,
          source: this.streamPreferences.streamerInfo.appId,
          parameters: {
            credential: this.jsonToQueryString(credentials),
            token: this.streamPreferences.streamerInfo.token,
            version: 1.0
          }
        }
      ]
    }

    this.webSocket.send(JSON.stringify(request));
  }
}
