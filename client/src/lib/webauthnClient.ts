import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from './api';

export { browserSupportsWebAuthn };

export async function registerPasskey(): Promise<{ ok: boolean; error?: string }> {
  try {
    const options = await api.post<any>('/api/webauthn/register-options');
    const attestation = await startRegistration({ optionsJSON: options });
    await api.post('/api/webauthn/register-verify', attestation);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Passkey registration failed' };
  }
}

export async function unlockWithPasskey(): Promise<{ ok: boolean; error?: string }> {
  try {
    const options = await api.post<any>('/api/webauthn/lock-options');
    const assertion = await startAuthentication({ optionsJSON: options });
    await api.post('/api/webauthn/lock-verify', assertion);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Passkey verification failed' };
  }
}
