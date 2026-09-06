export const OPEN_AUTH_MODAL_EVENT = 'hamidian:open-auth-modal';
export const AUTHENTICATION_SUCCEEDED_EVENT = 'hamidian:authentication-succeeded';

export function openAuthModal(): void {
  window.dispatchEvent(new Event(OPEN_AUTH_MODAL_EVENT));
}
