import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SmartOrder } from './models/smart-order';

@Injectable({
  providedIn: 'root'
})
export class OrderingService {
  constructor(
    private http: HttpClient) {
  }

  getRecommendationAndProcess(order: SmartOrder): Observable<any> {
    const body = { order };
    return this.http.post('/api/ordering', body);
  }
}
