export interface ApiClientConfig {
  baseUrl: string;
}

let config: ApiClientConfig = {
  baseUrl: '',
};

export function configureApiClient(value: ApiClientConfig) {
  config = value;
}

export function getApiClientConfig() {
  return config;
}
