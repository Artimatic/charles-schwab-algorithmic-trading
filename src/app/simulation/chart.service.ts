import { Injectable } from '@angular/core';
import { Chart } from 'angular-highcharts';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class ChartService {

  constructor() { }

  initChart(title, timeArr, 
    seriesData, momentFormat = 'MMM D',
    clickHandler = (evt) => {}) {
    return new Chart({
      chart: {
        type: 'spline',
        zoomType: 'x'
      },
      title: {
        text: title
      },
      subtitle: {
        text: 'Daily Price'
      },
      xAxis: {
        type: 'datetime',
        labels: {
          formatter: function () {
            return moment(this.value).format(momentFormat);
          }
        },
        categories: timeArr
      },
      yAxis: {
        title: {
          text: 'Price'
        },
        labels: {
          formatter: function () {
            return '$' + this.value;
          }
        }
      },
      tooltip: {
        crosshairs: true,
        shared: true,
        formatter: function () {
          return '<b>Date:</b>' +
            moment(this.x).format('YYYY-MM-DD HH:mm') +
            '<br><b>Price:</b> ' +
            this.y + '<br>' + this.points[0].key;
        }
      },
      plotOptions: {
        spline: {
          marker: {
            radius: 1,
            lineColor: '#666666',
            lineWidth: 1
          }
        },
        series: {
          marker: {
            enabled: true
          },
          turboThreshold: 5000,
          point: {
            events: {
              click: clickHandler
            }
          }
        }
      },
      series: [{
        name: 'Stock',
        data: seriesData
      }]
    });
  }

}
