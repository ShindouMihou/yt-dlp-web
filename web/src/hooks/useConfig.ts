import { useCallback, useEffect, useState } from 'react';
import type { AppConfigResponse } from '../types/api';
import { fetchConfig, login as loginRequest } from '../lib/api';

interface ConfigState {
  loading: boolean;
  config: AppConfigResponse | null;
  authenticated: boolean;
}

export function useConfig() {
  const [state, setState] = useState<ConfigState>({
    loading: true,
    config: null,
    authenticated: false,
  });

  const refresh = useCallback(async () => {
    try {
      const config = await fetchConfig();
      setState({ loading: false, config, authenticated: config.authenticated });
    } catch {
      setState({ loading: false, config: null, authenticated: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (password: string) => {
      await loginRequest(password);
      setState((prev) => ({ ...prev, authenticated: true }));
    },
    [],
  );

  return { ...state, login, refresh };
}
