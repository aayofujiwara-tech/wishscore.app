const HLTB_BASE = "https://howlongtobeat.com";
const COMMON_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: HLTB_BASE,
  Referer: `${HLTB_BASE}/`,
  Accept: "application/json, */*",
};

let _apiKey: string | null | undefined = undefined; // undefined = not yet fetched

async function fetchApiKey(): Promise<string | null> {
  if (_apiKey !== undefined) return _apiKey;

  try {
    const html = await fetch(HLTB_BASE, {
      headers: { "User-Agent": COMMON_HEADERS["User-Agent"] },
    }).then((r) => r.text());

    // Find Next.js JS chunk URLs
    const chunkMatches = html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g);
    const chunkUrls = Array.from(chunkMatches).map((m) => `${HLTB_BASE}${m[1]}`);

    for (const url of chunkUrls) {
      try {
        const js = await fetch(url).then((r) => r.text());
        // Pattern: "/api/search/" + key or concatenated string with the key
        const match = js.match(/"\/api\/search\/([a-zA-Z0-9]+)"/);
        if (match) {
          _apiKey = match[1];
          return _apiKey;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }

  _apiKey = null;
  return null;
}

type HltbResult = {
  game_name: string;
  comp_main: number;
  comp_plus: number;
  comp_100: number;
};

type HltbResponse = {
  data?: HltbResult[];
};

async function searchHltb(gameName: string): Promise<HltbResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const body = JSON.stringify({
      searchType: "games",
      searchTerms: gameName.split(" "),
      searchPage: 1,
      size: 5,
      searchOptions: {
        games: { userId: 0, platform: "", sortCategory: "popular", rangeCategory: "main", rangeTime: { min: null, max: null }, gameplay: { perspective: "", flow: "", genre: "" }, rangeYear: { min: "", max: "" }, modifier: "" },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
    });

    const apiKey = await fetchApiKey();
    const searchUrl = apiKey
      ? `${HLTB_BASE}/api/search/${apiKey}`
      : `${HLTB_BASE}/api/search`;

    const res = await fetch(searchUrl, {
      method: "POST",
      headers: COMMON_HEADERS,
      body,
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const json = (await res.json()) as HltbResponse;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getHLTBData(gameName: string): Promise<{
  mainStory: number | null;
  completionist: number | null;
} | null> {
  try {
    const result = await searchHltb(gameName);
    if (!result) return null;

    const toHours = (seconds: number): number | null =>
      seconds > 0 ? Math.round((seconds / 3600) * 10) / 10 : null;

    return {
      mainStory: toHours(result.comp_main),
      completionist: toHours(result.comp_100),
    };
  } catch {
    return null;
  }
}
