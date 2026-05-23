type SteamSpyResponse = {
  tags?: Record<string, number>;
  median_forever?: number; // median playtime in minutes (all-time)
};

function minutesToHours(rawMinutes: number | undefined): number | null {
  if (!rawMinutes || rawMinutes <= 0) return null;
  if (rawMinutes < 10) return null;           // under 10 min → skip
  const hours = Math.round(rawMinutes / 60);
  if (hours > 1000) return null;              // over 1000h → anomaly
  return hours;
}

export type SteamSpyData = {
  tags: string[];
  medianPlaytime: number | null; // hours
};

export async function getSteamSpyData(appid: number): Promise<SteamSpyData> {
  try {
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
    );
    if (!res.ok) return { tags: [], medianPlaytime: null };
    const data = (await res.json()) as SteamSpyResponse;
    const tags = data.tags ? Object.keys(data.tags).slice(0, 10) : [];
    const medianPlaytime = minutesToHours(data.median_forever);
    return { tags, medianPlaytime };
  } catch {
    return { tags: [], medianPlaytime: null };
  }
}

export async function getSteamSpyPlaytime(appid: number): Promise<{
  medianPlaytime: number | null;
} | null> {
  try {
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
    );
    const data = (await res.json()) as SteamSpyResponse;
    const rawMinutes = data.median_forever;

    console.log(`[WishScore] SteamSpy raw: ${appid} → ${rawMinutes}分`);

    const medianPlaytime = minutesToHours(rawMinutes);

    if (medianPlaytime !== null) {
      console.log(`[WishScore] SteamSpy playtime: ${appid} → ${medianPlaytime}時間`);
    }

    return { medianPlaytime };
  } catch {
    return null;
  }
}
