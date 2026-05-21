import { HowLongToBeatService } from "howlongtobeat";

const hltbService = new HowLongToBeatService();

export async function getHLTBData(gameName: string): Promise<{
  mainStory: number | null;
  completionist: number | null;
} | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const results = await Promise.race([
      hltbService.search(gameName),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("HLTB timeout")), 3000)
      ),
    ]);

    clearTimeout(timeout);

    if (!results || results.length === 0) return null;
    const top = results[0];
    return {
      mainStory: top.gameplayMain || null,
      completionist: top.gameplayCompletionist || null,
    };
  } catch {
    return null;
  }
}
