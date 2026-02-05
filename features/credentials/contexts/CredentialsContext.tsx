import * as SecureStore from "expo-secure-store";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { logError, logInfo } from "@/shared/utils/logger";

export const CREDENTIALS_KEY = "echo_credentials";

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

interface CredentialsContextType {
  credentials: Credentials | null;
  isLoading: boolean;
  isConfigured: boolean;
  saveCredentials: (credentials: Credentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  redirectUri: string;
}

const CredentialsContext = createContext<CredentialsContextType | undefined>(
  undefined
);

export const REDIRECT_URI = "echo://callback";

export const getStoredCredentials = async (): Promise<Credentials | null> => {
  try {
    const stored = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (stored) {
      return JSON.parse(stored) as Credentials;
    }
    return null;
  } catch {
    return null;
  }
};

export const CredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const stored = await getStoredCredentials();
        if (stored) {
          setCredentials(stored);
          logInfo("Credentials: Loaded from secure storage");
        }
      } catch (error) {
        logError("Credentials: Error loading credentials:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCredentials();
  }, []);

  const saveCredentials = useCallback(async (newCredentials: Credentials) => {
    try {
      await SecureStore.setItemAsync(
        CREDENTIALS_KEY,
        JSON.stringify(newCredentials)
      );
      setCredentials(newCredentials);
      logInfo("Credentials: Saved to secure storage");
    } catch (error) {
      logError("Credentials: Error saving credentials:", error);
      throw error;
    }
  }, []);

  const clearCredentials = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
      setCredentials(null);
      logInfo("Credentials: Cleared from secure storage");
    } catch (error) {
      logError("Credentials: Error clearing credentials:", error);
      throw error;
    }
  }, []);

  const value: CredentialsContextType = {
    credentials,
    isLoading,
    isConfigured: credentials !== null,
    saveCredentials,
    clearCredentials,
    redirectUri: REDIRECT_URI,
  };

  return (
    <CredentialsContext.Provider value={value}>
      {children}
    </CredentialsContext.Provider>
  );
};

export const useCredentials = () => {
  const context = useContext(CredentialsContext);
  if (context === undefined) {
    throw new Error("useCredentials must be used within a CredentialsProvider");
  }
  return context;
};
