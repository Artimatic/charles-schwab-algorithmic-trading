import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StrategyStoreService {

  constructor() { }

  getStorage(storageName: string) {
    const storage = JSON.parse(localStorage.getItem(storageName));
    return storage ? storage : {};
  }

}
