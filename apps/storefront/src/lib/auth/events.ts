export const OPEN_AUTH_MODAL_EVENT = 'hamidian:open-auth-modal';
export const AUTHENTICATION_SUCCEEDED_EVENT = 'hamidian:authentication-succeeded';
export const AUTHENTICATION_ENDED_EVENT = 'hamidian:authentication-ended';

export function openAuthModal(): void {
  window.dispatchEvent(new Event(OPEN_AUTH_MODAL_EVENT));
}

export function notifyAuthenticationEnded(): void {
  window.dispatchEvent(new Event(AUTHENTICATION_ENDED_EVENT));
}
