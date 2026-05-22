export async function getHLTBData(gameName: string): Promise<{
  mainStory: number | null;
  completionist: number | null;
} | null> {
  try {
    console.log(`[WishScore] HLTB fetching: ${gameName}`);

    const searchRes = await fetch("https://howlongtobeat.com/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://howlongtobeat.com/",
        "Origin": "https://howlongtobeat.com",
      },
      body: JSON.stringify({
        searchType: "games",
        searchTerms: gameName.split(" "),
        searchPage: 1,
        size: 5,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: null, max: null },
            gameplay: { perspective: "", flow: "", genre: "" },
            rangeYear: { min: "", max: "" },
            modifier: "",
          },
          users: { sortCategory: "postcount" },
          lists: { sortCategory: "follows" },
          filter: "",
          sort: 0,
          randomizer: 0,
        },
      }),
    });

    if (!searchRes.ok) {
      console.log(`[WishScore] HLTB search failed: ${searchRes.status}`);
      return null;
    }

    const data = await searchRes.json() as { data?: { comp_main?: number; comp_plus?: number }[] };
    const results = data?.data;

    if (!results || results.length === 0) {
      console.log(`[WishScore] HLTB: ${gameName} → not found`);
      return null;
    }

    const top = results[0];
    const mainStory = top.comp_main ? Math.round(top.comp_main / 3600) : null;
    const completionist = top.comp_plus ? Math.round(top.comp_plus / 3600) : null;

    console.log(`[WishScore] HLTB: ${gameName} → main:${mainStory}h, completionist:${completionist}h`);

    return { mainStory, completionist };
  } catch (e) {
    console.log(`[WishScore] HLTB error: ${gameName} → ${e}`);
    return null;
  }
}
