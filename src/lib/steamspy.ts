type SteamSpyResponse = {
  tags?: Record<string, number>;
  median_forever?: number; // median playtime in minutes (all-time)
};

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
    const medianMinutes = data.median_forever ?? 0;
    const medianPlaytime = medianMinutes > 0 ? Math.round(medianMinutes / 60) : null;
    return { tags, medianPlaytime };
  } catch {
    return { tags: [], medianPlaytime: null };
  }
}

export async function getSteamSpyPlaytime(appid: number): Promise<{
  medianPlaytime: number | null; // hours
} | null> {
  try {
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
    );
    const data = (await res.json()) as SteamSpyResponse;
    const medianMinutes = data.median_forever ?? 0;
    const medianPlaytime = medianMinutes > 0 ? Math.round(medianMinutes / 60) : null;
    return { medianPlaytime };
  } catch {
    return null;
  }
}
