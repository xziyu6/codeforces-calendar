export async function getAuthTokenInteractive(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const token = typeof result === "string" ? result : result?.token;
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? "Failed to get auth token"));
        return;
      }
      resolve(token);
    });
  });
}

export async function getFreshAuthToken(): Promise<string> {
  try {
    return await getAuthTokenInteractive(true);
  } catch {
    const cachedToken = await getAuthTokenInteractive(false).catch(() => null);
    if (cachedToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => resolve());
      });
    }
    return getAuthTokenInteractive(true);
  }
}

export async function removeCachedAuthToken(token: string): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}
