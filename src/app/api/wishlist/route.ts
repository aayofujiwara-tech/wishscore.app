import { NextRequest } from "next/server";
import { resolveToSteamId64 } from "@/lib/steamUtils";
import { getHLTBData } from "@/lib/hltb";
import { getSteamSpyTags } from "@/lib/steamspy";
import type { GameResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETRY_LIMIT = 3;
const RETRY_INTERVAL_MS = 500;
const DETAIL_LIMIT = 20;
const BATCH_SIZE = 25;

async function fetchWithRetry(
  url: string,
  retries = RETRY_LIMIT,
  headers?: Record<string, string>
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
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
  if (!res.ok) throw new Error(`Wishlist fetch error: HTTP ${res.status}`);

  const bodyText = await res.text();
  let data: WishlistResponse;
  try {
    data = JSON.parse(bodyText) as WishlistResponse;
  } catch {
    throw new Error("PRIVATE_WISHLIST");
  }

  const items = data.response?.items ?? [];
  console.log(`[WishScore] Wishlist items count: ${items.length}`);
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
    price_overview?: { final?: number; initial?: number; discount_percent?: number };
  };
};

async function fetchAppDetails(appid: number): Promise<AppDetailsData | null> {
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
  query_summary?: { total_positive?: number; total_negative?: number; total_reviews?: number };
};

async function fetchReviews(appid: number): Promise<{ positive: number; negative: number; total: number }> {
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

// Step 1: fast scan — appdetails + reviews only, no HLTB, no SteamSpy
async function processGameFast(appid: number): Promise<GameResult | null> {
  const [details, reviews] = await Promise.all([
    fetchAppDetails(appid),
    fetchReviews(appid),
  ]);

  if (!details?.success || !details.data) return null;

  const d = details.data;
  const isFree = d.is_free ?? false;
  const isUnreleased = d.release_date?.coming_soon ?? false;
  const name = d.name ?? `App ${appid}`;
  const headerImage =
    d.header_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  const shortDescription = d.short_description ?? "";
  const genres = (d.genres ?? []).map((g) => g.description);

  const priceOverview = d.price_overview;
  const priceJPY = priceOverview ? (priceOverview.final ?? 0) / 100 : 0;
  const originalPriceJPY = priceOverview ? (priceOverview.initial ?? 0) / 100 : 0;
  const discountPercent = priceOverview?.discount_percent ?? 0;

  const { positive, negative, total } = reviews;
  const positiveRate = total > 0 ? positive / (positive + negative) : 0;

  let score = 0;
  if (!isFree && !isUnreleased && priceJPY > 0) {
    score = calculateScore(positiveRate, total, discountPercent, priceJPY);
  }

  return {
    appid, name, headerImage, priceJPY, originalPriceJPY, discountPercent,
    positiveRate, reviewTotal: total, score, isFree, isUnreleased,
    shortDescription, genres,
    hltbMainStory: null, hltbCompletionist: null, pricePerHour: null,
    tags: [], tagMatchCount: 0,
  };
}

// Step 2: full detail — appdetails + reviews, then HLTB + SteamSpy in parallel
async function processGame(appid: number, favoriteTags: string[]): Promise<GameResult | null> {
  const [details, reviews] = await Promise.all([
    fetchAppDetails(appid),
    fetchReviews(appid),
  ]);

  if (!details?.success || !details.data) return null;

  const d = details.data;
  const isFree = d.is_free ?? false;
  const isUnreleased = d.release_date?.coming_soon ?? false;
  const name = d.name ?? `App ${appid}`;
  const headerImage =
    d.header_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  const shortDescription = d.short_description ?? "";
  const genres = (d.genres ?? []).map((g) => g.description);

  const priceOverview = d.price_overview;
  const priceJPY = priceOverview ? (priceOverview.final ?? 0) / 100 : 0;
  const originalPriceJPY = priceOverview ? (priceOverview.initial ?? 0) / 100 : 0;
  const discountPercent = priceOverview?.discount_percent ?? 0;

  const { positive, negative, total } = reviews;
  const positiveRate = total > 0 ? positive / (positive + negative) : 0;

  let hltbMainStory: number | null = null;
  let hltbCompletionist: number | null = null;
  let pricePerHour: number | null = null;
  let tags: string[] = [];

  if (!isFree && !isUnreleased && priceJPY > 0) {
    const [hltb, fetchedTags] = await Promise.all([
      getHLTBData(name),
      getSteamSpyTags(appid),
    ]);
    tags = fetchedTags;
    if (hltb) {
      hltbMainStory = hltb.mainStory;
      hltbCompletionist = hltb.completionist;
      pricePerHour =
        hltb.mainStory && hltb.mainStory > 0
          ? Math.round(priceJPY / hltb.mainStory)
          : null;
    }
  }

  const hltbBonus = pricePerHour ? Math.max(1.0, 20 / pricePerHour) : 1.0;
  const matchCount = favoriteTags.length > 0
    ? tags.filter((t) => favoriteTags.includes(t)).length
    : 0;
  const tagBonus = Math.min(2.0, 1 + matchCount * 0.2);

  let score = 0;
  if (!isFree && !isUnreleased && priceJPY > 0) {
    score = calculateScore(positiveRate, total, discountPercent, priceJPY, hltbBonus) * tagBonus;
  }

  return {
    appid, name, headerImage, priceJPY, originalPriceJPY, discountPercent,
    positiveRate, reviewTotal: total, score, isFree, isUnreleased,
    shortDescription, genres, hltbMainStory, hltbCompletionist, pricePerHour,
    tags, tagMatchCount: matchCount,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "full";

  // Lightweight JSON endpoint: returns wishlist appids for cache diff check
  if (mode === "check") {
    const steamIdParam = searchParams.get("steamid") ?? "";
    const apiKey = process.env.STEAM_API_KEY ?? "";
    if (!steamIdParam.trim() || !apiKey) {
      return Response.json({ error: "INVALID_PARAMS" }, { status: 400 });
    }
    try {
      const steamId = await resolveToSteamId64(steamIdParam, apiKey);
      const appids = await fetchAllWishlistAppIds(steamId, apiKey);
      return Response.json({ appids });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SERVER_ERROR";
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller closed */ }
      };

      try {
        const favoriteTagsParam = searchParams.get("favoriteTags") ?? "";
        const favoriteTags = favoriteTagsParam
          ? favoriteTagsParam.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

        // ── details mode: HLTB + SteamSpy for specific appids (load-more) ──
        if (mode === "details") {
          const appidsParam = searchParams.get("appids") ?? "";
          const appids = appidsParam
            .split(",")
            .map(Number)
            .filter((n) => n > 0)
            .slice(0, DETAIL_LIMIT);

          if (appids.length === 0) {
            send({ type: "complete", games: [], freeGames: [], unreleasedGames: [] });
            controller.close();
            return;
          }

          send({ type: "progress", message: `詳細データを取得中...`, current: 0, total: appids.length });

          const results: GameResult[] = [];
          for (let i = 0; i < appids.length; i++) {
            const game = await processGame(appids[i], favoriteTags);
            if (game) {
              results.push(game);
              send({ type: "game", game, current: i + 1, total: appids.length });
            } else {
              send({ type: "progress", message: `詳細データを取得中...`, current: i + 1, total: appids.length });
            }
            if (i < appids.length - 1) {
              await new Promise((r) => setTimeout(r, 300));
            }
          }

          const paidGames = results
            .filter((g) => !g.isFree && !g.isUnreleased)
            .sort((a, b) => b.score - a.score);
          const freeGames = results
            .filter((g) => g.isFree)
            .sort((a, b) => b.positiveRate - a.positiveRate);
          const unreleasedGames = results.filter((g) => g.isUnreleased);

          send({ type: "complete", games: paidGames, freeGames, unreleasedGames });
          controller.close();
          return;
        }

        // ── full mode: Step 1 (all games fast) + Step 2 (top 20 detailed) ──
        const steamIdParam = searchParams.get("steamid") ?? "";
        if (!steamIdParam.trim()) {
          send({ type: "error", error: "INVALID_STEAMID" });
          controller.close();
          return;
        }

        const apiKey = process.env.STEAM_API_KEY ?? "";
        if (!apiKey) {
          send({ type: "error", error: "INVALID_API_KEY" });
          controller.close();
          return;
        }

        send({ type: "progress", message: "SteamIDを確認中...", current: 0, total: 0 });

        let steamId: string;
        try {
          steamId = await resolveToSteamId64(steamIdParam, apiKey);
        } catch {
          send({ type: "error", error: "INVALID_STEAMID" });
          controller.close();
          return;
        }

        send({ type: "progress", message: "ウィッシュリスト取得中...", current: 0, total: 0 });

        let allAppIds: number[];
        try {
          allAppIds = await fetchAllWishlistAppIds(steamId, apiKey);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "SERVER_ERROR";
          send({ type: "error", error: msg === "PRIVATE_WISHLIST" ? "PRIVATE_WISHLIST" : msg });
          controller.close();
          return;
        }

        if (allAppIds.length === 0) {
          send({ type: "error", error: "EMPTY_WISHLIST" });
          controller.close();
          return;
        }

        // Step 1: parallel batch fetch of appdetails + reviews for all games
        const totalCount = allAppIds.length;
        send({ type: "progress", message: `全${totalCount}件の基本情報を取得中...`, current: 0, total: totalCount });

        const allScoredGames: GameResult[] = [];
        for (let i = 0; i < allAppIds.length; i += BATCH_SIZE) {
          const batch = allAppIds.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(processGameFast));
          for (const g of batchResults) {
            if (g) allScoredGames.push(g);
          }
          const done = Math.min(i + BATCH_SIZE, totalCount);
          send({
            type: "progress",
            message: `全${totalCount}件の基本情報を取得中... (${done}/${totalCount})`,
            current: done,
            total: totalCount,
          });
        }

        // Sort all games by base score descending
        allScoredGames.sort((a, b) => b.score - a.score);

        // Send all scored games to frontend for caching (enables load-more without re-scanning)
        send({ type: "allScores", games: allScoredGames, totalCount });

        // Step 2: full detail (HLTB + SteamSpy) for top DETAIL_LIMIT
        const topGames = allScoredGames.slice(0, DETAIL_LIMIT);
        send({
          type: "progress",
          message: `上位${topGames.length}件の詳細データを取得中...`,
          current: 0,
          total: topGames.length,
        });

        const detailedResults: GameResult[] = [];
        for (let i = 0; i < topGames.length; i++) {
          const game = await processGame(topGames[i].appid, favoriteTags);
          if (game) {
            detailedResults.push(game);
            send({ type: "game", game, current: i + 1, total: topGames.length });
          } else {
            send({
              type: "progress",
              message: `上位${topGames.length}件の詳細データを取得中...`,
              current: i + 1,
              total: topGames.length,
            });
          }
          if (i < topGames.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        const paidGames = detailedResults
          .filter((g) => !g.isFree && !g.isUnreleased)
          .sort((a, b) => b.score - a.score);
        const freeGames = detailedResults
          .filter((g) => g.isFree)
          .sort((a, b) => b.positiveRate - a.positiveRate);
        const unreleasedGames = detailedResults.filter((g) => g.isUnreleased);

        send({
          type: "complete",
          games: paidGames,
          freeGames,
          unreleasedGames,
          totalCount,
          analyzedCount: topGames.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "SERVER_ERROR";
        send({ type: "error", error: `SERVER_ERROR: ${msg}` });
      } finally {
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
