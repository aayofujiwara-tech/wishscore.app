export async function getHLTBData(appid: number): Promise<{
  mainStory: number | null;
  completionist: number | null;
} | null> {
  try {
    console.log(`[WishScore] HLTB fetching: ${appid}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      `https://hltbapi.codepotatoes.de/steam/${appid}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`[WishScore] HLTB failed: ${appid} → ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      mainStory?: number;
      completionist?: number;
    };

    if (!data || !data.mainStory) {
      console.log(`[WishScore] HLTB not found: ${appid}`);
      return null;
    }

    console.log(`[WishScore] HLTB: ${appid} → main:${data.mainStory}h`);

    return {
      mainStory: data.mainStory || null,
      completionist: data.completionist || null,
    };
  } catch (e) {
    console.log(`[WishScore] HLTB error: ${appid} → ${e}`);
    return null;
  }
}
