import { useCallback, useState } from 'react';

import { authRepository } from '../data';
import type { OtpVerifyResult } from '../data/types';

type RequestState = 'idle' | 'sending' | 'sent' | 'error';
type VerifyState = 'idle' | 'verifying' | 'success' | 'invalid' | 'error';

export function useOtpMock() {
  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');

  const requestOtp = useCallback(async (phoneE164: string) => {
    setRequestState('sending');
    try {
      await authRepository.requestOtp(phoneE164);
      setRequestState('sent');
      return { ok: true as const };
    } catch (err) {
      setRequestState('error');
      return { ok: false as const, error: err };
    }
  }, []);

  const verifyOtp = useCallback(
    async (phoneE164: string, code: string, deviceId: string): Promise<OtpVerifyResult> => {
      setVerifyState('verifying');
      try {
        const result = await authRepository.verifyOtp({ phoneE164, code, deviceId });
        setVerifyState(result.ok ? 'success' : 'invalid');
        return result;
      } catch (err) {
        setVerifyState('error');
        return { ok: false, kind: 'unknown', message: String(err) };
      }
    },
    []
  );

  return {
    requestOtp,
    verifyOtp,
    requestState,
    verifyState,
    isSending: requestState === 'sending',
    isVerifying: verifyState === 'verifying',
  };
}
