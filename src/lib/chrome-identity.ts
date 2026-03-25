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

export async function clearAllCachedAuthTokens(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(() => resolve());
  });
}

/** POST token to Google's revoke endpoint per https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke */
export async function revokeGoogleAccessToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token revoke failed (${response.status}): ${text}`);
  }
}

/**
 * Revokes the current access token at Google (if any), then clears Chrome Identity cache.
 * Revoke errors are ignored so local sign-out still completes.
 */
export async function signOutFromGoogle(): Promise<void> {
  const token = await getAuthTokenInteractive(false).catch(() => null);
  if (token) {
    try {
      await revokeGoogleAccessToken(token);
    } catch {
      /* still clear cache below */
    }
  }
  await clearAllCachedAuthTokens();
}

/**
 * Best-effort account switch for Chrome's built-in OAuth flow.
 * We clear extension OAuth cache first, then trigger an interactive token request.
 */
export async function getAuthTokenWithAccountPicker(): Promise<string> {
  await clearAllCachedAuthTokens();
  return getAuthTokenInteractive(true);
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
