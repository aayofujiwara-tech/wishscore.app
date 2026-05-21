/**
 * Parse various Steam input formats and return a normalized identifier.
 * - https://steamcommunity.com/profiles/76561... -> SteamID64 (digits)
 * - https://steamcommunity.com/id/username -> username (vanity URL)
 * - digits only -> SteamID64
 * - anything else -> treat as vanity URL
 */
export function parseSteamInput(input: string): string {
  const trimmed = input.trim();

  // Profile URL with numeric SteamID64
  const profileMatch = trimmed.match(
    /steamcommunity\.com\/profiles\/(\d+)/
  );
  if (profileMatch) {
    return profileMatch[1];
  }

  // Vanity URL
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/]+)/);
  if (vanityMatch) {
    return vanityMatch[1];
  }

  // Pure digits -> SteamID64
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Everything else -> treat as vanity URL
  return trimmed;
}

/**
 * Resolve a Steam input (SteamID64 or vanity URL) to a numeric SteamID64 string.
 */
export async function resolveToSteamId64(
  input: string,
  apiKey: string
): Promise<string> {
  const parsed = parseSteamInput(input);

  // Already a SteamID64
  if (/^\d+$/.test(parsed)) {
    return parsed;
  }

  // Resolve vanity URL
  const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1?vanityurl=${encodeURIComponent(parsed)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to resolve vanity URL: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    response: { success: number; steamid?: string; message?: string };
  };

  if (data.response.success !== 1 || !data.response.steamid) {
    throw new Error(
      `Could not resolve Steam ID: ${data.response.message ?? "Unknown error"}`
    );
  }

  return data.response.steamid;
}
