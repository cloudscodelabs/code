import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../logger.js';

export type AuthType = 'oauth' | 'api_key' | 'none';

export interface AuthInfo {
  type: AuthType;
  /** OAuth access token or API key */
  token: string | null;
  /** Subscription type from OAuth credentials (e.g. "max", "pro") */
  subscriptionType: string | null;
  /** Token expiry timestamp (ms) — only for OAuth */
  expiresAt: number | null;
}

interface CredentialsFile {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number | null;
    scopes: string[];
    subscriptionType: string | null;
    rateLimitTier: string | null;
  };
}

const CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

function readCredentials(): CredentialsFile | null {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return null;
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(raw) as CredentialsFile;
  } catch (err) {
    logger.warn({ err }, 'Failed to read Claude credentials file');
    return null;
  }
}

export function getAuthInfo(): AuthInfo {
  // 1. Check Claude CLI OAuth credentials
  const creds = readCredentials();
  if (creds?.claudeAiOauth?.accessToken) {
    const oauth = creds.claudeAiOauth;
    const expired = oauth.expiresAt != null && oauth.expiresAt < Date.now();
    if (!expired) {
      return {
        type: 'oauth',
        token: oauth.accessToken,
        subscriptionType: oauth.subscriptionType ?? null,
        expiresAt: oauth.expiresAt ?? null,
      };
    }
    logger.debug('OAuth token expired, falling back');
  }

  // 2. Fallback to API key env var
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return { type: 'api_key', token: apiKey, subscriptionType: null, expiresAt: null };
  }

  return { type: 'none', token: null, subscriptionType: null, expiresAt: null };
}

export function hasValidAuth(): boolean {
  return getAuthInfo().type !== 'none';
}

export function getAuthStatus(): {
  authenticated: boolean;
  authType: AuthType;
  subscriptionType: string | null;
  expiresAt: number | null;
} {
  const info = getAuthInfo();
  return {
    authenticated: info.type !== 'none',
    authType: info.type,
    subscriptionType: info.subscriptionType,
    expiresAt: info.expiresAt,
  };
}

export function clearOAuthCredentials(): boolean {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return false;
    const creds = readCredentials();
    if (!creds?.claudeAiOauth) return false;

    delete creds.claudeAiOauth;
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds), 'utf-8');
    logger.info('OAuth credentials cleared');
    return true;
  } catch (err) {
    logger.error({ err }, 'Failed to clear OAuth credentials');
    return false;
  }
}
