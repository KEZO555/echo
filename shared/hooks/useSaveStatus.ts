import { useCallback, useEffect, useState } from "react";
import { logError } from "@/shared/utils";

interface UseSaveStatusOptions {
  id: string | undefined;
  checkFn: (id: string) => Promise<boolean>;
  saveFn: (id: string) => Promise<boolean>;
  removeFn: (id: string) => Promise<boolean>;
  accessToken?: string | null;
}

interface UseSaveStatusResult {
  isSaved: boolean;
  isChecking: boolean;
  toggle: () => Promise<void>;
}

export function useSaveStatus({
  id,
  checkFn,
  saveFn,
  removeFn,
  accessToken,
}: UseSaveStatusOptions): UseSaveStatusResult {
  const [isSaved, setIsSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!id) return;

    setIsChecking(true);
    try {
      const result = await checkFn(id);
      setIsSaved(result);
    } catch (error) {
      logError("Error checking save status:", error);
      setIsSaved(false);
    } finally {
      setIsChecking(false);
    }
  }, [id, checkFn]);

  const toggle = useCallback(async () => {
    if (!id) return;

    try {
      if (isSaved) {
        const success = await removeFn(id);
        if (success) {
          setIsSaved(false);
        }
      } else {
        const success = await saveFn(id);
        if (success) {
          setIsSaved(true);
        }
      }
    } catch (error) {
      logError("Error toggling save status:", error);
    }
  }, [id, isSaved, saveFn, removeFn]);

  useEffect(() => {
    if (id && accessToken) {
      checkStatus();
    }
  }, [id, accessToken, checkStatus]);

  return { isSaved, isChecking, toggle };
}
