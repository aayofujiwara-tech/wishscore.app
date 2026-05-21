import { NextRequest, NextResponse } from "next/server";
import { resolveToSteamId64 } from "@/lib/steamUtils";
import { getHLTBData } from "@/lib/hltb";
import { getSteamSpyTags } from "@/lib/steamspy";
import type { GameResult, ApiResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const RETRY_LIMIT = 3;
const RETRY_INTERVAL_MS = 500;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
  "Referer": "https://store.steampowered.com/",
};

async function fetchWithRetry(
  url: string,
  retries = RETRY_LIMIT,
  headers?: Record<string, string>
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 0 },
    });
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

type WishlistItem = { appid: number; priority: number; date_added: number };
type WishlistResponse = { response?: { items?: WishlistItem[] } };

async function fetchAllWishlistAppIds(steamId: string, apiKey: string): Promise<number[]> {
  const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}&key=${apiKey}`;
  console.log(`[WishScore] Fetching wishlist: ${url.replace(apiKey, "***")}`);

  const res = await fetchWithRetry(url);
  const contentType = res.headers.get("content-type") ?? "";
  console.log(`[WishScore] Wishlist response: status=${res.status}, content-type=${contentType}`);

  if (!res.ok) {
    throw new Error(`Wishlist fetch error: HTTP ${res.status}`);
  }

  const bodyText = await res.text();
  console.log(`[WishScore] Wishlist body (first 200 chars): ${bodyText.slice(0, 200)}`);

  let data: WishlistResponse;
  try {
    data = JSON.parse(bodyText) as WishlistResponse;
  } catch (e) {
    console.error(`[WishScore] Failed to parse wishlist JSON: ${e}`);
    throw new Error("PRIVATE_WISHLIST");
  }

  const items = data.response?.items ?? [];
  console.log(`[WishScore] Wishlist items count: ${items.length}`);

  if (items.length === 0) {
    return [];
  }

  return items.map((item) => item.appid);
}

type AppDetailsData = {
  success: boolean;
  data?: {
    name?: string;
    header_image?: string;
    short_description?: string;
    genres?: { id: string; description: string }[];
    is_free?: boolean;
    release_date?: { coming_soon?: boolean };
    price_overview?: {
      final?: number;
      initial?: number;
      discount_percent?: number;
    };
  };
};

async function fetchAppDetails(
  appid: number
): Promise<AppDetailsData | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=jp&l=japanese`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, AppDetailsData>;
    return json[String(appid)] ?? null;
  } catch {
    return null;
  }
}

type ReviewData = {
  success: number;
  query_summary?: {
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
  };
};

async function fetchReviews(
  appid: number
): Promise<{ positive: number; negative: number; total: number }> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return { positive: 0, negative: 0, total: 0 };
    const json = (await res.json()) as ReviewData;
    const qs = json.query_summary;
    return {
      positive: qs?.total_positive ?? 0,
      negative: qs?.total_negative ?? 0,
      total: qs?.total_reviews ?? 0,
    };
  } catch {
    return { positive: 0, negative: 0, total: 0 };
  }
}

function calculateScore(
  positiveRate: number,
  reviewTotal: number,
  discountPercent: number,
  priceJPY: number,
  hltbBonus = 1.0
): number {
  const reviewWeight = Math.log10(reviewTotal + 1);
  const discountBoost = Math.pow(1 + discountPercent / 100, 2);
  return (positiveRate * reviewWeight * discountBoost / priceJPY) * 1000 * hltbBonus;
}

async function processAppIdBatch(appids: number[]): Promise<GameResult[]> {
  const results: GameResult[] = [];

  // Fetch details and reviews in parallel per batch
  const detailsPromises = appids.map((id) => fetchAppDetails(id));
  const reviewsPromises = appids.map((id) => fetchReviews(id));

  const [detailsArr, reviewsArr] = await Promise.all([
    Promise.all(detailsPromises),
    Promise.all(reviewsPromises),
  ]);

  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    const details = detailsArr[i];
    const reviews = reviewsArr[i];

    if (!details || !details.success || !details.data) continue;

    const d = details.data;
    const isFree = d.is_free ?? false;
    const isUnreleased = d.release_date?.coming_soon ?? false;
    const name = d.name ?? `App ${appid}`;
    const headerImage =
      d.header_image ??
      `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
    const shortDescription = d.short_description ?? "";
    const genres = (d.genres ?? []).map((g) => g.description);

    const priceOverview = d.price_overview;
    const priceJPY = priceOverview
      ? (priceOverview.final ?? 0) / 100
      : isFree
      ? 0
      : 0;
    const originalPriceJPY = priceOverview
      ? (priceOverview.initial ?? 0) / 100
      : 0;
    const discountPercent = priceOverview?.discount_percent ?? 0;

    const positive = reviews.positive;
    const negative = reviews.negative;
    const total = reviews.total;
    const positiveRate =
      total > 0 ? positive / (positive + negative) : 0;

    let score = 0;
    if (!isFree && !isUnreleased && priceJPY > 0) {
      score = calculateScore(positiveRate, total, discountPercent, priceJPY);
    }

    results.push({
      appid,
      name,
      headerImage,
      priceJPY,
      originalPriceJPY,
      discountPercent,
      positiveRate,
      reviewTotal: total,
      score,
      isFree,
      isUnreleased,
      shortDescription,
      genres,
      hltbMainStory: null,
      hltbCompletionist: null,
      pricePerHour: null,
      tags: [],
      tagMatchCount: 0,
    });
  }

  return results;
}

const EMPTY_RESPONSE = {
  games: [] as GameResult[],
  totalCount: 0,
  freeGames: [] as GameResult[],
  unreleasedGames: [] as GameResult[],
};

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const steamIdParam = searchParams.get("steamid");
    const favoriteTagsParam = searchParams.get("favoriteTags") ?? "";
    const favoriteTags = favoriteTagsParam
      ? favoriteTagsParam.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    console.log(`[WishScore] GET /api/wishlist?steamid=${steamIdParam} favoriteTags=${favoriteTags.join(",")}`);

    if (!steamIdParam || steamIdParam.trim() === "") {
      return NextResponse.json(
        { ...EMPTY_RESPONSE, error: "INVALID_STEAMID" },
        { status: 400 }
      );
    }

    const apiKey = process.env.STEAM_API_KEY ?? "";
    if (!apiKey) {
      console.error("[WishScore] STEAM_API_KEY is not set");
      return NextResponse.json(
        { ...EMPTY_RESPONSE, error: "INVALID_API_KEY" },
        { status: 500 }
      );
    }

    let steamId: string;
    try {
      steamId = await resolveToSteamId64(steamIdParam, apiKey);
      console.log(`[WishScore] Resolved SteamID: ${steamId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WishScore] SteamID resolve error: ${message}`);
      return NextResponse.json(
        { ...EMPTY_RESPONSE, error: "INVALID_STEAMID" },
        { status: 400 }
      );
    }

    let allAppIds: number[];
    try {
      allAppIds = await fetchAllWishlistAppIds(steamId, apiKey);
      console.log(`[WishScore] Total appids fetched: ${allAppIds.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WishScore] Wishlist fetch error: ${message}`);
      if (message === "PRIVATE_WISHLIST") {
        return NextResponse.json(
          { ...EMPTY_RESPONSE, error: "PRIVATE_WISHLIST" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { ...EMPTY_RESPONSE, error: message },
        { status: 500 }
      );
    }

    if (allAppIds.length === 0) {
      return NextResponse.json(
        { ...EMPTY_RESPONSE, error: "EMPTY_WISHLIST" },
        { status: 200 }
      );
    }

    const BATCH_SIZE = 5;
    const allResults: GameResult[] = [];

    for (let i = 0; i < allAppIds.length; i += BATCH_SIZE) {
      const batch = allAppIds.slice(i, i + BATCH_SIZE);
      const batchResults = await processAppIdBatch(batch);
      allResults.push(...batchResults);
    }

    // HLTB + SteamSpy: fetch in parallel per game, serially across games (500ms interval)
    const ENRICH_LIMIT = 50;
    const paidForEnrich = allResults
      .filter((g) => !g.isFree && !g.isUnreleased && g.priceJPY > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, ENRICH_LIMIT);

    console.log(`[WishScore] Enriching ${paidForEnrich.length} games with HLTB + SteamSpy`);
    for (const game of paidForEnrich) {
      const [hltb, tags] = await Promise.all([
        getHLTBData(game.name),
        getSteamSpyTags(game.appid),
      ]);

      game.tags = tags;
      const matchCount = favoriteTags.length > 0
        ? tags.filter((t) => favoriteTags.includes(t)).length
        : 0;
      game.tagMatchCount = matchCount;
      const tagBonus = Math.min(2.0, 1 + matchCount * 0.2);

      if (hltb) {
        game.hltbMainStory = hltb.mainStory;
        game.hltbCompletionist = hltb.completionist;
        game.pricePerHour =
          hltb.mainStory && hltb.mainStory > 0
            ? Math.round(game.priceJPY / hltb.mainStory)
            : null;
      }
      const hltbBonus = game.pricePerHour
        ? Math.max(1.0, 20 / game.pricePerHour)
        : 1.0;

      if (game.priceJPY > 0) {
        game.score = calculateScore(
          game.positiveRate,
          game.reviewTotal,
          game.discountPercent,
          game.priceJPY,
          hltbBonus
        ) * tagBonus;
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    const paidGames = allResults.filter((g) => !g.isFree && !g.isUnreleased);
    const freeGames = allResults.filter((g) => g.isFree);
    const unreleasedGames = allResults.filter((g) => g.isUnreleased);

    paidGames.sort((a, b) => b.score - a.score);
    freeGames.sort((a, b) => b.positiveRate - a.positiveRate);

    return NextResponse.json({
      games: paidGames,
      totalCount: allResults.length,
      freeGames,
      unreleasedGames,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: `SERVER_ERROR: ${message}` },
      { status: 500 }
    );
  }
}
