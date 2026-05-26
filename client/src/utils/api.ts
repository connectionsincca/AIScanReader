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

// ── Session token ─────────────────────────────────────────────────────────────

let _sessionToken: string | null = null;

/** Called by ConsentSection after Turnstile + /api/session succeed. */
export function setSessionToken(token: string): void {
  _sessionToken = token;
}

/** Attach session token to every outgoing request if one has been set. */
http.interceptors.request.use((cfg) => {
  if (_sessionToken) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers['x-session-token'] = _sessionToken;
  }
  return cfg;
});

/**
 * Exchange a Cloudflare Turnstile one-time token for a server-side session
 * token. Call this once after the human-verification step completes, then pass
 * the result to setSessionToken() before making any other API calls.
 */
export async function createSession(turnstileToken: string): Promise<string> {
  const { data } = await http.post<{ sessionToken: string }>('/session', {
    turnstileToken,
  });
  return data.sessionToken;
}

// ── API calls ─────────────────────────────────────────────────────────────────

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
