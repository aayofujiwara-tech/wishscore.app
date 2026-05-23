type SteamSpyResponse = {
  tags?: Record<string, number>;
  median_forever?: number; // median playtime in minutes (all-time)
};

export type SteamSpyData = {
  tags: string[];
  medianPlaytimeHours: number | null;
};

export async function getSteamSpyData(appid: number): Promise<SteamSpyData> {
  try {
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
    );
    if (!res.ok) return { tags: [], medianPlaytimeHours: null };
    const data = (await res.json()) as SteamSpyResponse;
    const tags = data.tags ? Object.keys(data.tags).slice(0, 10) : [];
    const medianMinutes = data.median_forever ?? 0;
    const medianPlaytimeHours = medianMinutes > 0
      ? Math.round(medianMinutes / 60)
      : null;
    return { tags, medianPlaytimeHours };
  } catch {
    return { tags: [], medianPlaytimeHours: null };
  }
}

// Backward-compatible wrapper
export async function getSteamSpyTags(appid: number): Promise<string[]> {
  const { tags } = await getSteamSpyData(appid);
  return tags;
}
