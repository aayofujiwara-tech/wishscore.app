export async function getSteamSpyTags(appid: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appid}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { tags?: Record<string, number> };
    return data.tags ? Object.keys(data.tags).slice(0, 10) : [];
  } catch {
    return [];
  }
}
