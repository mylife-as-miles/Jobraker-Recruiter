import { z } from 'zod';
import { useCallback, useEffect, useState } from 'react';
import { JobrakerRecruiterApiConfig } from '@x/shared/dist/jobraker-recruiter-account.js';


interface JobrakerRecruiterAccountState {
  signedIn: boolean;
  accessToken: string | null;
  config: z.infer<typeof JobrakerRecruiterApiConfig> | null;
}

export type JobrakerRecruiterAccountSnapshot = JobrakerRecruiterAccountState;

const DEFAULT_STATE: JobrakerRecruiterAccountState = {
  signedIn: false,
  accessToken: null,
  config: null,
};

export function useJobrakerRecruiterAccount() {
  const [state, setState] = useState<JobrakerRecruiterAccountState>(DEFAULT_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async (): Promise<JobrakerRecruiterAccountSnapshot | null> => {
    try {
      setIsLoading(true);
      const result = await window.ipc.invoke('account:getJobrakerRecruiter', null);
      const next: JobrakerRecruiterAccountSnapshot = {
        signedIn: result.signedIn,
        accessToken: result.accessToken,
        config: result.config,
      };
      setState(next);
      return next;
    } catch (error) {
      console.error('Failed to load Jobraker Recruiter account state:', error);
      setState(DEFAULT_STATE);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const cleanup = window.ipc.on('oauth:didConnect', (event) => {
      if (event.provider !== 'jobraker-recruiter') {
        return;
      }
      refresh();
    });
    return cleanup;
  }, [refresh]);

  return {
    signedIn: state.signedIn,
    accessToken: state.accessToken,
    config: state.config,
    isLoading,
    refresh,
  };
}
