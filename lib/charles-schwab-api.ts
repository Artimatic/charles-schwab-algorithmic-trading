import axios from 'axios';
import qs from 'qs';

const host = 'https://api.schwabapi.com/v1';

export interface ApiResponse {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  config: any;
  request: any;
  json: any;
}

export function getAuthorization(appKey: string, appSecret: string) {
  return Buffer.from(`${appKey}:${appSecret}`).toString('base64');
}

export function authorize(appKey: string, appCallbackUrl: string): Promise<ApiResponse> {
  const path = '/oauth/authorize';
  const url = `${host}${path}?client_id=${appKey}&redirect_uri=${appCallbackUrl}`;
  return axios({
    method: 'get',
    url
  });
}

export function getAccessToken(appKey: string, appSecret: string, grant_type: string, code: string, redirect_uri: string): Promise<ApiResponse> {
  const path = '/oauth/token'
  const url = `${host}${path}`;
  const data = {
    grant_type,
    code,
    redirect_uri
  };
  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getAuthorization(appKey, appSecret)}`
    },
    data: qs.stringify(data),
    url
  };
  return axios(options);
}

export function refreshAccessToken(appKey: string, appSecret: string, refreshToken: string) {
  const path = '/oauth/token'
  const url = `${host}${path}`;
  const data = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  };
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getAuthorization(appKey, appSecret)}`
    },
    data: qs.stringify(data),
    url
  };
  return axios(options);
}