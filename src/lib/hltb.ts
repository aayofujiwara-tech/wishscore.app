const HLTB_BASE = "https://howlongtobeat.com";
const SEARCH_URL = `${HLTB_BASE}/api/find`;
const INIT_URL = `${HLTB_BASE}/api/find/init`;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

type InitData = {
  token: string;
  hpKey: string | null;
  hpVal: string | null;
  fetchedAt: number;
};

// Cache token for 5 minutes so 20 sequential game lookups share one init call
let cachedInit: InitData | null = null;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getInitData(): Promise<InitData | null> {
  if (cachedInit && Date.now() - cachedInit.fetchedAt < 5 * 60 * 1000) {
    return cachedInit;
  }

  try {
    const initRes = await fetchWithTimeout(`${INIT_URL}?t=${Date.now()}`, {
      headers: {
        ...BROWSER_HEADERS,
        referer: `${HLTB_BASE}/`,
        accept: "*/*",
      },
    });
    console.log(`[WishScore] HLTB init status: ${initRes.status}`);

    if (!initRes.ok) return null;

    const data = await initRes.json() as { token?: string; hpKey?: string; hpVal?: string };
    if (!data.token) {
      console.log(`[WishScore] HLTB init: no token in response`);
      return null;
    }

    console.log(`[WishScore] HLTB init success, token: ${data.token.substring(0, 8)}...`);
    cachedInit = {
      token: data.token,
      hpKey: data.hpKey ?? null,
      hpVal: data.hpVal ?? null,
      fetchedAt: Date.now(),
    };
    return cachedInit;
  } catch (e) {
    console.log(`[WishScore] HLTB init error: ${e}`);
    return null;
  }
}

export async function getHLTBData(gameName: string): Promise<{
  mainStory: number | null;
  completionist: number | null;
} | null> {
  try {
    console.log(`[WishScore] HLTB fetching: ${gameName}`);

    const initData = await getInitData();
    if (!initData) {
      console.log(`[WishScore] HLTB: init failed for ${gameName}`);
      return null;
    }

    const payload: Record<string, unknown> = {
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
          gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
          rangeYear: { min: "", max: "" },
          modifier: "",
        },
        users: { sortCategory: "postcount" },
        lists: { sortCategory: "follows" },
        filter: "",
        sort: 0,
        randomizer: 0,
      },
      useCache: true,
    };

    // Include honeypot field if provided
    if (initData.hpKey && initData.hpVal) {
      payload[initData.hpKey] = initData.hpVal;
    }

    const searchReferer = `${HLTB_BASE}/?q=${encodeURIComponent(gameName)}`;
    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      "content-type": "application/json",
      accept: "*/*",
      origin: HLTB_BASE,
      referer: searchReferer,
      "x-auth-token": initData.token,
    };
    if (initData.hpKey) headers["x-hp-key"] = initData.hpKey;

    const searchRes = await fetchWithTimeout(SEARCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    console.log(`[WishScore] HLTB search status: ${searchRes.status}`);

    if (!searchRes.ok) {
      // Token may have expired — clear cache so next call re-initializes
      if (searchRes.status === 401 || searchRes.status === 403) cachedInit = null;
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

    console.log(`[WishScore] HLTB: ${gameName} → main:${mainStory}h`);
    return { mainStory, completionist };
  } catch (e) {
    console.log(`[WishScore] HLTB error: ${gameName} → ${e}`);
    return null;
  }
}
