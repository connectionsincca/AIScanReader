import axios from 'axios';
import type {
  ValidateScanRequest,
  ValidateScanResponse,
  ExtractDataRequest,
  ExtractDataResponse,
  SubmitRequest,
  SubmitResponse,
} from '../types';

const http = axios.create({ baseURL: '/api', timeout: 60_000 });

export async function validateScan(payload: ValidateScanRequest): Promise<ValidateScanResponse> {
  const { data } = await http.post<ValidateScanResponse>('/validate-scan', payload);
  return data;
}

export async function extractData(payload: ExtractDataRequest): Promise<ExtractDataResponse> {
  const { data } = await http.post<ExtractDataResponse>('/extract-data', payload);
  return data;
}

export async function submitPackage(payload: SubmitRequest): Promise<SubmitResponse> {
  const { data } = await http.post<SubmitResponse>('/submit', payload, { timeout: 120_000 });
  return data;
}
