export const getValidToken = async (
  accessToken: string | null,
  ensureValidToken?: () => Promise<string | null>
): Promise<string | null> => {
  let token = accessToken;
  if (ensureValidToken) {
    const refreshed = await ensureValidToken();
    if (refreshed) {
      token = refreshed;
    }
  }
  return token;
};
