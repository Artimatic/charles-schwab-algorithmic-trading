import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type RotationQuadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';

export interface SectorRotationResult {
  ticker: string;
  name: string;
  category: string;
  rsRatio: number;
  rsMomentum: number;
  quadrant: RotationQuadrant;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class SectorRotationService {
  private apiUrl = 'api/backtest/sector-rotation';

  constructor(private http: HttpClient) {}

  getSectorRotation(currentDate?: string, lookbackDays?: number): Observable<SectorRotationResult[]> {
    let params = new HttpParams();
    if (currentDate) {
      params = params.set('currentDate', currentDate);
    }
    if (lookbackDays) {
      params = params.set('lookbackDays', lookbackDays.toString());
    }

    return this.http.get<SectorRotationResult[]>(this.apiUrl, { params });
  }
}