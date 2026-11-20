import { createPrivateKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { SearchConsoleError, searchConsoleRecord } from './search-console-errors';
import { SearchConsoleTransport } from './search-console-transport';

export const SEARCH_CONSOLE_PROPERTY_IDS = [
  'sc-domain:hamidian.shop',
  'https://hamidian.shop/',
  'https://www.hamidian.shop/',
] as const;

const tokenUrl = 'https://oauth2.googleapis.com/token';
const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
const sitesUrl = 'https://www.googleapis.com/webmasters/v3/sites/';

export type GoogleSearchAnalyticsQuery = {
  startDate: string;
  endDate: string;
  dimensions: readonly string[];
  type: string;
  aggregationType: string;
  rowLimit: number;
  startRow: number;
  dataState: 'final';
  dimensionFilterGroups?: readonly {
    groupType: 'and';
    filters: readonly { dimension: string; operator: string; expression: string }[];
  }[];
};

export interface SearchConsoleClient {
  readonly property: string;
  checkAccess(): Promise<void>;
  query(query: GoogleSearchAnalyticsQuery): Promise<unknown>;
  listSitemaps(): Promise<unknown>;
}

export const SEARCH_CONSOLE_CLIENT = Symbol('SEARCH_CONSOLE_CLIENT');

type Options = Readonly<{ property?: string; credentialsFile?: string }>;
type CachedToken = { value: string; refreshAt: number };

function invalidCredentials(message: string): SearchConsoleError {
  return new SearchConsoleError('invalid_credentials', undefined, message);
}

export class GoogleSearchConsoleClient implements SearchConsoleClient {
  readonly property: string;
  private cached?: CachedToken;
  private refreshing?: Promise<CachedToken>;

  constructor(
    private readonly options: Options,
    private readonly transport = new SearchConsoleTransport(),
  ) {
    const requestedProperty = options.property?.trim() || SEARCH_CONSOLE_PROPERTY_IDS[0];
    this.property = SEARCH_CONSOLE_PROPERTY_IDS.find((item) => item === requestedProperty) ?? '';
  }

  async checkAccess() {
    const site = searchConsoleRecord(await this.authorized(''));
    if (site?.siteUrl !== this.property) throw new SearchConsoleError('invalid_response');
    if (site.permissionLevel === 'siteUnverifiedUser')
      throw new SearchConsoleError('access_denied');
    if (
      !['siteOwner', 'siteFullUser', 'siteRestrictedUser'].some(
        (level) => level === site.permissionLevel,
      )
    ) {
      throw new SearchConsoleError('invalid_response');
    }
  }

  query(query: GoogleSearchAnalyticsQuery) {
    return this.authorized('/searchAnalytics/query', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  }

  listSitemaps() {
    return this.authorized('/sitemaps');
  }

  private async authorized(path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.property) {
      throw new SearchConsoleError('property_not_found');
    }
    const token = await this.accessToken();
    const request = (value: string) =>
      this.transport.json(`${sitesUrl}${encodeURIComponent(this.property)}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${value}`,
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
      });
    try {
      return await request(token.value);
    } catch (error) {
      if (!(error instanceof SearchConsoleError) || error.code !== 'authentication_failed')
        throw error;
      if (this.cached === token) this.cached = undefined;
      const refreshed = await this.accessToken();
      try {
        return await request(refreshed.value);
      } catch (retryError) {
        if (
          retryError instanceof SearchConsoleError &&
          retryError.code === 'authentication_failed' &&
          this.cached === refreshed
        )
          this.cached = undefined;
        throw retryError;
      }
    }
  }

  private accessToken(): Promise<CachedToken> {
    if (this.cached && this.cached.refreshAt > Date.now()) return Promise.resolve(this.cached);
    this.refreshing ??= this.issueToken()
      .then((token) => (this.cached = token))
      .finally(() => {
        this.refreshing = undefined;
      });
    return this.refreshing;
  }

  private async assertion(): Promise<string> {
    const file = this.options.credentialsFile;
    if (!file) throw new SearchConsoleError('not_configured');
    if (!isAbsolute(file)) {
      throw invalidCredentials('SEARCH_CONSOLE_CREDENTIALS_FILE must be an absolute path.');
    }

    const input = await readFile(file, 'utf8').catch((error: unknown) => {
      switch (searchConsoleRecord(error)?.code) {
        case 'ENOENT':
          throw invalidCredentials(
            'The configured service account JSON file was not found (ENOENT).',
          );
        case 'EACCES':
        case 'EPERM':
          throw invalidCredentials(
            'The Node process was denied access to the service account JSON file.',
          );
        case 'EISDIR':
          throw invalidCredentials('The configured credentials path points to a directory.');
        default:
          throw invalidCredentials(
            'The Node process could not read the service account JSON file.',
          );
      }
    });

    let rawCredential: unknown;
    try {
      rawCredential = JSON.parse(input);
    } catch {
      throw invalidCredentials('The service account file contains malformed JSON.');
    }
    const credential = searchConsoleRecord(rawCredential);
    if (
      credential?.type !== 'service_account' ||
      typeof credential.client_email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(credential.client_email) ||
      typeof credential.private_key !== 'string' ||
      typeof credential.private_key_id !== 'string' ||
      !credential.private_key_id
    ) {
      throw invalidCredentials('The JSON file is missing valid Google service account fields.');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: credential.private_key_id }),
    ).toString('base64url');
    const claims = Buffer.from(
      JSON.stringify({
        iss: credential.client_email,
        scope,
        aud: tokenUrl,
        iat: issuedAt,
        exp: issuedAt + 300,
      }),
    ).toString('base64url');
    const unsigned = `${header}.${claims}`;
    try {
      const key = createPrivateKey(credential.private_key);
      if (key.asymmetricKeyType !== 'rsa') throw new Error();
      return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
    } catch {
      throw invalidCredentials('Node could not sign the assertion with the configured RSA key.');
    }
  }

  private async issueToken(): Promise<CachedToken> {
    const assertion = await this.assertion();
    const payload = searchConsoleRecord(
      await this.transport.json(
        tokenUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
          }),
        },
        'oauth',
      ),
    );
    const value = payload?.access_token;
    const expires = payload?.expires_in;
    if (
      typeof value !== 'string' ||
      !value ||
      typeof expires !== 'number' ||
      !Number.isSafeInteger(expires) ||
      expires <= 0
    ) {
      throw new SearchConsoleError('invalid_response');
    }
    return { value, refreshAt: Date.now() + Math.max(0, Math.min(expires, 3600) - 45) * 1000 };
  }
}
