"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 8) return "#4ade80";
  if (score >= 5) return "#fb923c";
  return "#94a3b8";
}

function rankBadge(rank: number) {
  if (rank === 1) return { icon: "🥇", label: "1st" };
  if (rank === 2) return { icon: "🥈", label: "2nd" };
  if (rank === 3) return { icon: "🥉", label: "3rd" };
  return null;
}

function recomputeScore(
  g: GameResult,
  weights: { discount: number; review: number; price: number },
  favoriteTags: string[]
): number {
  if (g.isFree || g.isUnreleased || g.priceJPY <= 0) return 0;
  const reviewWeight = Math.log10(g.reviewTotal + 1);
  const discountBoost = Math.pow(1 + g.discountPercent / 100, weights.discount);
  const priceFactor = Math.pow(g.priceJPY, weights.price);
  const base = (g.positiveRate * reviewWeight * discountBoost * weights.review / priceFactor) * 1000;
  const hltbBonus = g.pricePerHour ? Math.max(1.0, 20 / g.pricePerHour) : 1.0;
  const matchCount = favoriteTags.length > 0
    ? g.tags.filter((t) => favoriteTags.includes(t)).length
    : 0;
  const tagBonus = Math.min(2.0, 1 + matchCount * 0.2);
  return base * hltbBonus * tagBonus;
}

function GameCard({
  game,
  rank,
  weights,
  favoriteTags,
  steamid,
  style,
}: {
  game: GameResult;
  rank: number;
  weights: { discount: number; review: number; price: number };
  favoriteTags: string[];
  steamid: string;
  style?: React.CSSProperties;
}) {
  const score = recomputeScore(game, weights, favoriteTags);
  const badge = rankBadge(rank);
  const color = scoreColor(score);
  const matchCount = favoriteTags.length > 0
    ? game.tags.filter((t) => favoriteTags.includes(t)).length
    : 0;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildShareUrl(): string {
    const origin = window.location.origin;
    const sp = new URLSearchParams({
      rank: String(rank),
      name: game.name,
      score: score.toFixed(1),
      price: `¥${game.priceJPY.toLocaleString()}`,
      discount: String(game.discountPercent),
      positive: String(Math.round(game.positiveRate * 100)),
      image: game.headerImage,
    });
    return `${origin}/share/${encodeURIComponent(steamid)}?${sp.toString()}`;
  }

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = buildShareUrl();
    const text = `私のウィッシュリスト${rank}位は「${game.name}」！コスパスコア${score.toFixed(1)}🔥 #WishScore`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = buildShareUrl();
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative animate-fade-in-down" style={style}>
      <a
        href={`https://store.steampowered.com/app/${game.appid}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#1b9aff] hover:bg-[#1a2535] transition-all duration-200 cursor-pointer"
      >
      {/* Score color bar */}
      <div className="w-1 flex-shrink-0" style={{ background: color }} />

      {/* Thumbnail */}
      <div className="w-24 sm:w-28 h-16 flex-shrink-0 overflow-hidden my-3 rounded bg-[#0f1923]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.headerImage}
          alt={game.name}
          className="w-full h-full object-contain"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-2 sm:py-3 pr-2 sm:pr-3">
        <div className="flex items-start gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {badge && (
              <span className="text-lg flex-shrink-0">{badge.icon}</span>
            )}
            {!badge && (
              <span className="font-rajdhani text-[#8ba3b5] text-sm w-6 flex-shrink-0">
                #{rank}
              </span>
            )}
            <span className="text-sm font-medium text-[#c7d5e0] truncate">
              {game.name}
            </span>
          </div>
          {/* Right column: share buttons (top) + score (bottom) */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <div className="flex gap-1">
              <button
                onClick={handleShare}
                title="X(Twitter)でシェア"
                className="p-2 rounded bg-[#1b2838] border border-[#2a475e] text-[#8ba3b5] hover:border-[#1b9aff] hover:text-[#1b9aff] hover:bg-[#1b2f45] transition-colors leading-none text-xs"
              >
                𝕏
              </button>
              <button
                onClick={handleCopy}
                title="URLをコピー"
                className="p-2 rounded bg-[#1b2838] border border-[#2a475e] text-[#8ba3b5] hover:border-[#1b9aff] hover:text-[#1b9aff] hover:bg-[#1b2f45] transition-colors leading-none text-xs"
              >
                {copied ? "✓" : "📋"}
              </button>
            </div>
            <div className="flex items-center gap-1">
              {score >= 8 && <span className="text-base">🔥</span>}
              <span
                className="font-rajdhani font-bold text-2xl sm:text-3xl"
                style={{ color }}
              >
                {score.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 text-xs">
            {game.discountPercent > 0 ? (
              <>
                <span className="bg-[#1b9aff] text-white px-1.5 py-0.5 rounded font-bold">
                  -{game.discountPercent}%
                </span>
                <span className="text-[#c7d5e0] font-medium">
                  ¥{game.priceJPY.toLocaleString()}
                </span>
                <span className="text-[#8ba3b5] line-through">
                  ¥{game.originalPriceJPY.toLocaleString()}
                </span>
              </>
            ) : (
              <span className="text-[#c7d5e0]">
                ¥{game.priceJPY.toLocaleString()}
              </span>
            )}
          </div>

          {game.reviewTotal > 0 && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex-1 bg-[#2a475e] rounded-full h-1.5 min-w-0 max-w-[50px] sm:max-w-[80px]">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(game.positiveRate * 100).toFixed(0)}%`,
                    background: game.positiveRate >= 0.8 ? "#22c55e" : game.positiveRate >= 0.6 ? "#facc15" : "#ef4444",
                  }}
                />
              </div>
              <span className="text-xs text-[#8ba3b5] whitespace-nowrap">
                {(game.positiveRate * 100).toFixed(0)}% ({game.reviewTotal.toLocaleString()})
              </span>
            </div>
          )}
        </div>

        {game.hltbMainStory && (
          <div className="flex items-center gap-1.5 mt-1 text-sm text-[#94a3b8]">
            <span>🕐 約{game.hltbMainStory}時間</span>
            {game.pricePerHour !== null && (
              <span>・ ¥{game.pricePerHour.toLocaleString()}/時間</span>
            )}
          </div>
        )}

        {game.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {matchCount > 0 && (
              <span className="text-xs font-bold text-[#1b9aff] mr-0.5">
                🏷️ +{(matchCount * 20)}%
              </span>
            )}
            {game.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  favoriteTags.includes(tag)
                    ? "bg-[#1b9aff]/20 text-[#1b9aff] border border-[#1b9aff]/40"
                    : "bg-[#2a475e]/50 text-[#4a6b7c]"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      </a>
    </div>
  );
}

function WeightSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs sm:text-sm text-[#8ba3b5] w-24 sm:w-40 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#1b9aff]"
      />
      <span className="font-rajdhani text-[#1b9aff] w-10 text-right text-sm">
        {value.toFixed(1)}x
      </span>
    </div>
  );
}

const PRESET_TAGS = [
  "ローグライク", "RPG", "サバイバル", "アクション",
  "シミュレーション", "パズル", "ホラー", "ADV",
  "ストラテジー", "スポーツ",
];

type SseData = {
  type: string;
  message?: string;
  current?: number;
  total?: number;
  game?: GameResult;
  games?: GameResult[];
  freeGames?: GameResult[];
  unreleasedGames?: GameResult[];
  totalCount?: number;
  analyzedCount?: number;
  hasMore?: boolean;
  error?: string;
};

type CacheData = {
  steamId: string;
  games: GameResult[];
  freeGames: GameResult[];
  unreleasedGames: GameResult[];
  allScoredGames: GameResult[];
  totalCount: number;
  analyzedCount: number;
  analyzedAt: number;
};

export default function Home() {
  const [steamId, setSteamId] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState({ discount: 2.0, review: 1.0, price: 1.0 });
  const [showWeights, setShowWeights] = useState(false);
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tagInput, setTagInput] = useState("");

  // SSE streaming state
  const [games, setGames] = useState<GameResult[]>([]);
  const [freeGames, setFreeGames] = useState<GameResult[]>([]);
  const [unreleasedGames, setUnreleasedGames] = useState<GameResult[]>([]);
  const [allScoredGames, setAllScoredGames] = useState<GameResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [streamingGames, setStreamingGames] = useState<GameResult[]>([]);

  // Load-more state
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreCurrent, setLoadMoreCurrent] = useState(0);
  const [loadMoreTotal, setLoadMoreTotal] = useState(0);

  // Cache state
  const [showCacheNotice, setShowCacheNotice] = useState(false);
  const [cacheAge, setCacheAge] = useState(0);
  const [diffNotice, setDiffNotice] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);
  const loadMoreEsRef = useRef<EventSource | null>(null);
  const loadMoreCompletedRef = useRef(false);
  const allScoredGamesRef = useRef<GameResult[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const urlSteamId = new URLSearchParams(window.location.search).get("steamid");
    if (urlSteamId) {
      setSteamId(urlSteamId);
    } else {
      const savedSteamId = localStorage.getItem("wishscore_steamid");
      if (savedSteamId) {
        setSteamId(savedSteamId);
        setSavedId(savedSteamId);

        // Restore cache if fresh enough
        try {
          const cacheStr = localStorage.getItem(`wishscore_cache_${savedSteamId}`);
          if (cacheStr) {
            const cached = JSON.parse(cacheStr) as CacheData;
            const ageMinutes = Math.round((Date.now() - cached.analyzedAt) / 60000);
            if (ageMinutes < 60) {
              setGames(cached.games ?? []);
              setFreeGames(cached.freeGames ?? []);
              setUnreleasedGames(cached.unreleasedGames ?? []);
              setAllScoredGames(cached.allScoredGames ?? []);
              allScoredGamesRef.current = cached.allScoredGames ?? [];
              setTotalCount(cached.totalCount ?? 0);
              setAnalyzedCount(cached.analyzedCount ?? 0);
              setIsComplete(true);
              setCacheAge(ageMinutes);
              setShowCacheNotice(true);

              // Background diff check
              const cachedIds = new Set((cached.allScoredGames ?? []).map((g) => g.appid));
              fetch(`/api/wishlist?mode=check&steamid=${encodeURIComponent(savedSteamId)}`)
                .then((r) => (r.ok ? r.json() : null))
                .then((result: { appids?: number[] } | null) => {
                  if (!result?.appids || !isMountedRef.current) return;
                  const newSet = new Set(result.appids);
                  const added = result.appids.filter((id) => !cachedIds.has(id));
                  const removed = [...cachedIds].filter((id) => !newSet.has(id));
                  if (removed.length > 0) {
                    setGames((prev) => prev.filter((g) => newSet.has(g.appid)));
                    setFreeGames((prev) => prev.filter((g) => newSet.has(g.appid)));
                    setUnreleasedGames((prev) => prev.filter((g) => newSet.has(g.appid)));
                    setAllScoredGames((prev) => prev.filter((g) => newSet.has(g.appid)));
                  }
                  if (added.length > 0 && isMountedRef.current) {
                    setDiffNotice(`${added.length}件のゲームがウィッシュリストに追加されています。`);
                  }
                })
                .catch(() => { /* background check — ignore errors */ });
            }
          }
        } catch { /* ignore parse errors */ }
      }
    }

    const savedTags = localStorage.getItem("wishscore_favorite_tags");
    if (savedTags) {
      try { setFavoriteTags(JSON.parse(savedTags) as string[]); } catch { /* ignore */ }
    }

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (loadMoreEsRef.current) loadMoreEsRef.current.close();
    };
  }, []);

  function clearSavedId() {
    localStorage.removeItem("wishscore_steamid");
    setSavedId(null);
    setSteamId("");
  }

  function toggleTag(tag: string) {
    setFavoriteTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      localStorage.setItem("wishscore_favorite_tags", JSON.stringify(next));
      return next;
    });
  }

  function addCustomTag() {
    const tag = tagInput.trim();
    if (!tag || favoriteTags.includes(tag)) { setTagInput(""); return; }
    setFavoriteTags((prev) => {
      const next = [...prev, tag];
      localStorage.setItem("wishscore_favorite_tags", JSON.stringify(next));
      return next;
    });
    setTagInput("");
  }

  const rankedGames = useMemo(() => {
    const source = isComplete
      ? games
      : streamingGames.filter((g) => !g.isFree && !g.isUnreleased && g.priceJPY > 0);
    return [...source]
      .map((g) => ({ ...g, score: recomputeScore(g, weights, favoriteTags) }))
      .sort((a, b) => b.score - a.score);
  }, [games, streamingGames, isComplete, weights, favoriteTags]);

  function handleAnalyze() {
    if (!steamId.trim()) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (loadMoreEsRef.current) {
      loadMoreEsRef.current.close();
      loadMoreEsRef.current = null;
    }

    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setGames([]);
    setFreeGames([]);
    setUnreleasedGames([]);
    setAllScoredGames([]);
    allScoredGamesRef.current = [];
    setStreamingGames([]);
    setTotalCount(0);
    setAnalyzedCount(0);
    setIsComplete(false);
    setShowCacheNotice(false);
    setDiffNotice(null);
    setProgressMessage("分析開始中...");
    setProgressCurrent(0);
    setProgressTotal(0);
    completedRef.current = false;

    const params = new URLSearchParams({ steamid: steamId.trim() });
    if (favoriteTags.length > 0) params.set("favoriteTags", favoriteTags.join(","));

    const es = new EventSource(`/api/wishlist?${params.toString()}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as SseData;

        if (data.type === "progress") {
          setProgressMessage(data.message ?? "");
          setProgressCurrent(data.current ?? 0);
          setProgressTotal(data.total ?? 0);
        } else if (data.type === "allScores") {
          allScoredGamesRef.current = data.games ?? [];
          setAllScoredGames(allScoredGamesRef.current);
          setTotalCount(data.totalCount ?? 0);
        } else if (data.type === "game") {
          if (data.game) setStreamingGames((prev) => [...prev, data.game!]);
          setProgressCurrent(data.current ?? 0);
          setProgressTotal(data.total ?? 0);
        } else if (data.type === "complete") {
          completedRef.current = true;
          setGames(data.games ?? []);
          setFreeGames(data.freeGames ?? []);
          setUnreleasedGames(data.unreleasedGames ?? []);
          setTotalCount(data.totalCount ?? 0);
          setAnalyzedCount(data.analyzedCount ?? 0);
          setIsComplete(true);
          setLoading(false);
          localStorage.setItem("wishscore_steamid", steamId.trim());
          setSavedId(steamId.trim());
          // Save analysis cache for instant display on next visit
          try {
            const cacheData: CacheData = {
              steamId: steamId.trim(),
              games: data.games ?? [],
              freeGames: data.freeGames ?? [],
              unreleasedGames: data.unreleasedGames ?? [],
              allScoredGames: allScoredGamesRef.current,
              totalCount: data.totalCount ?? 0,
              analyzedCount: data.analyzedCount ?? 0,
              analyzedAt: Date.now(),
            };
            localStorage.setItem(`wishscore_cache_${steamId.trim()}`, JSON.stringify(cacheData));
          } catch { /* quota exceeded — skip cache */ }
          es.close();
          eventSourceRef.current = null;
        } else if (data.type === "error") {
          setError(data.error ?? "SERVER_ERROR");
          setLoading(false);
          es.close();
          eventSourceRef.current = null;
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      if (!completedRef.current) {
        setError("FETCH_ERROR");
        setLoading(false);
      }
      es.close();
      eventSourceRef.current = null;
    };
  }

  function handleLoadMore() {
    if (loadingMore) return;

    if (loadMoreEsRef.current) {
      loadMoreEsRef.current.close();
      loadMoreEsRef.current = null;
    }

    // Use cached Step 1 results to know which appids to detail next
    const currentAnalyzed = analyzedCount;
    const nextBatch = allScoredGames.slice(currentAnalyzed, currentAnalyzed + 20);
    if (nextBatch.length === 0) return;

    const batchSize = nextBatch.length;
    const appids = nextBatch.map((g) => g.appid).join(",");

    setLoadingMore(true);
    setLoadMoreCurrent(0);
    setLoadMoreTotal(batchSize);
    loadMoreCompletedRef.current = false;

    const params = new URLSearchParams({ mode: "details", appids });
    if (favoriteTags.length > 0) params.set("favoriteTags", favoriteTags.join(","));

    const es = new EventSource(`/api/wishlist?${params.toString()}`);
    loadMoreEsRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as SseData;

        if (data.type === "game") {
          setLoadMoreCurrent(data.current ?? 0);
          setLoadMoreTotal(data.total ?? 0);
        } else if (data.type === "complete") {
          loadMoreCompletedRef.current = true;

          if (data.games && data.games.length > 0) {
            setGames((prev) => {
              const existingIds = new Set(prev.map((g) => g.appid));
              const added = data.games!.filter((g) => !existingIds.has(g.appid));
              return [...prev, ...added].sort((a, b) => b.score - a.score);
            });
          }
          if (data.freeGames && data.freeGames.length > 0) {
            setFreeGames((prev) => {
              const existingIds = new Set(prev.map((g) => g.appid));
              const added = data.freeGames!.filter((g) => !existingIds.has(g.appid));
              return [...prev, ...added].sort((a, b) => b.positiveRate - a.positiveRate);
            });
          }
          if (data.unreleasedGames && data.unreleasedGames.length > 0) {
            setUnreleasedGames((prev) => {
              const existingIds = new Set(prev.map((g) => g.appid));
              const added = data.unreleasedGames!.filter((g) => !existingIds.has(g.appid));
              return [...prev, ...added];
            });
          }

          setAnalyzedCount(currentAnalyzed + batchSize);
          setLoadingMore(false);
          es.close();
          loadMoreEsRef.current = null;
        } else if (data.type === "error") {
          setLoadingMore(false);
          es.close();
          loadMoreEsRef.current = null;
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      if (!loadMoreCompletedRef.current) setLoadingMore(false);
      es.close();
      loadMoreEsRef.current = null;
    };
  }

  const hasMore = isComplete && !loadingMore && allScoredGames.length > analyzedCount;
  const hasResults = isComplete || (loading && streamingGames.length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="text-center py-8 sm:py-10 px-4">
        <h1 className="font-rajdhani font-bold text-4xl sm:text-5xl text-[#1b9aff] tracking-widest">
          WishScore
        </h1>
        <p className="text-[#8ba3b5] mt-2 text-sm tracking-wide">
          Find your best deal from wishlist
        </p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-3 sm:px-4 pb-12">
        {/* Input area */}
        <div className="rounded-xl border border-[#2a475e] bg-[#16202d] p-5 mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="SteamID64 or Profile URL"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="flex-1 bg-[#1b2838] border border-[#2a475e] rounded-lg px-4 py-3 text-sm text-[#c7d5e0] placeholder-[#4a6b7c] focus:outline-none focus:border-[#1b9aff] transition-colors"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !steamId.trim()}
              className="w-full sm:w-auto bg-[#1b9aff] hover:bg-[#1580d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-rajdhani font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              {loading ? "分析中..." : "分析"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
            <p className="text-xs text-[#4a6b7c]">
              SteamIDの調べ方は{" "}
              <a
                href="https://steamid.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1b9aff] hover:underline"
              >
                steamid.io
              </a>{" "}
              で確認できます
            </p>
            {savedId && (
              <p className="text-xs text-[#4a6b7c]">
                前回のID: <span className="text-[#8ba3b5]">{savedId}</span>{" "}
                <button
                  onClick={clearSavedId}
                  className="text-[#1b9aff] hover:underline"
                >
                  （クリアする）
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {loading && (
          <div className="mb-4">
            {progressTotal > 0 ? (
              <>
                <div className="flex justify-between text-xs text-[#4a6b7c] mb-1.5">
                  <span>{progressMessage}</span>
                  <span>{progressCurrent} / {progressTotal}</span>
                </div>
                <div className="bg-[#2a475e] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-[#1b9aff] transition-all duration-500"
                    style={{ width: `${Math.round(progressCurrent / progressTotal * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-[#1b9aff] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="text-xs text-[#8ba3b5]">{progressMessage || "読み込み中..."}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm">
            {error === "PRIVATE_WISHLIST" && (
              <>
                <p className="text-red-400 font-medium mb-1">
                  ウィッシュリストが非公開です
                </p>
                <p className="text-[#8ba3b5]">
                  Steamのプロフィール設定 → 公開設定 → ゲームの詳細を「公開」にしてください。{" "}
                  <a
                    href="https://steamcommunity.com/my/edit/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1b9aff] hover:underline"
                  >
                    設定ページを開く
                  </a>
                </p>
              </>
            )}
            {error === "EMPTY_WISHLIST" && (
              <p className="text-red-400">
                ウィッシュリストにゲームが見つかりませんでした。
              </p>
            )}
            {error === "INVALID_STEAMID" && (
              <p className="text-red-400">
                SteamIDが見つかりません。SteamID64（17桁の数字）またはプロフィールURLを入力してください。
              </p>
            )}
            {error === "INVALID_API_KEY" && (
              <p className="text-red-400">
                サーバー設定エラーが発生しました。管理者にお問い合わせください。
              </p>
            )}
            {!["PRIVATE_WISHLIST", "EMPTY_WISHLIST", "INVALID_STEAMID", "INVALID_API_KEY"].includes(error) && (
              <p className="text-red-400">
                エラーが発生しました。しばらく時間をおいて再試行してください。
              </p>
            )}
          </div>
        )}

        {/* Results (shown during streaming and after complete) */}
        {hasResults && (
          <>
            {/* Cache notice */}
            {showCacheNotice && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a475e] bg-[#1b2838] px-4 py-2.5 mb-3 text-xs text-[#8ba3b5]">
                <span>⚡ 前回の分析結果を表示中（{cacheAge}分前）</span>
                <button
                  onClick={handleAnalyze}
                  className="text-[#1b9aff] hover:underline whitespace-nowrap flex-shrink-0"
                >
                  最新データに更新する
                </button>
              </div>
            )}
            {/* Diff notice */}
            {diffNotice && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1b9aff]/30 bg-[#1b2838] px-4 py-2.5 mb-3 text-xs text-[#c7d5e0]">
                <span>ℹ️ {diffNotice}</span>
                <button
                  onClick={handleAnalyze}
                  className="text-[#1b9aff] hover:underline whitespace-nowrap flex-shrink-0"
                >
                  更新する
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#8ba3b5] text-xs">
                {isComplete
                  ? `全${totalCount}件 · 詳細分析済み: ${analyzedCount}件 · ランキング対象: ${games.length}本`
                  : allScoredGames.length > 0
                    ? `全${totalCount}件スキャン済み · 上位${streamingGames.filter(g => !g.isFree && !g.isUnreleased).length}件を詳細分析中...`
                    : `基本情報を取得中...`
                }
              </p>
              {isComplete && (
                <button
                  onClick={() => setShowWeights((v) => !v)}
                  className="text-xs text-[#1b9aff] hover:underline"
                >
                  {showWeights ? "▲ 重み調整を閉じる" : "▼ スコアの重みを調整"}
                </button>
              )}
            </div>

            {/* Weight panel (only after complete) */}
            {isComplete && showWeights && (
              <div className="rounded-xl border border-[#2a475e] bg-[#16202d] p-5 mb-4 space-y-3">
                <p className="text-xs text-[#8ba3b5] mb-2">
                  スライダーを動かすとリアルタイムに順位が変わります
                </p>
                <WeightSlider label="割引率の重み" value={weights.discount} min={1.0} max={3.0} step={0.1} onChange={(v) => setWeights((w) => ({ ...w, discount: v }))} />
                <WeightSlider label="レビュー件数の重み" value={weights.review} min={0.5} max={2.0} step={0.1} onChange={(v) => setWeights((w) => ({ ...w, review: v }))} />
                <WeightSlider label="価格の重み" value={weights.price} min={0.5} max={2.0} step={0.1} onChange={(v) => setWeights((w) => ({ ...w, price: v }))} />
              </div>
            )}

            {/* Tag panel toggle (only after complete) */}
            {isComplete && (
              <div className="flex justify-end mb-1">
                <button
                  onClick={() => setShowTagPanel((v) => !v)}
                  className="text-xs text-[#1b9aff] hover:underline"
                >
                  {showTagPanel ? "▲ タグ設定を閉じる" : "▼ 好みのタグを設定"}
                </button>
              </div>
            )}

            {/* Tag panel */}
            {isComplete && showTagPanel && (
              <div className="rounded-xl border border-[#2a475e] bg-[#16202d] p-5 mb-4">
                <p className="text-sm font-medium text-[#c7d5e0] mb-1">🏷️ 好みのタグを設定</p>
                <p className="text-xs text-[#4a6b7c] mb-3">一致したタグはスコアにボーナス（+20%/個）が加算されます</p>

                <p className="text-xs text-[#8ba3b5] mb-2">よく使われるタグ：</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {PRESET_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        favoriteTags.includes(tag)
                          ? "bg-[#1b9aff] border-[#1b9aff] text-white"
                          : "border-[#2a475e] text-[#8ba3b5] hover:border-[#1b9aff] hover:text-[#1b9aff]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {favoriteTags.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-[#8ba3b5] mb-1.5">選択中：</p>
                    <div className="flex flex-wrap gap-1.5">
                      {favoriteTags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-xs bg-[#1b9aff]/20 text-[#1b9aff] border border-[#1b9aff]/40 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                          <button onClick={() => toggleTag(tag)} className="hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="カスタムタグを追加"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomTag()}
                    className="flex-1 bg-[#1b2838] border border-[#2a475e] rounded-lg px-3 py-1.5 text-xs text-[#c7d5e0] placeholder-[#4a6b7c] focus:outline-none focus:border-[#1b9aff] transition-colors"
                  />
                  <button
                    onClick={addCustomTag}
                    className="text-xs bg-[#2a475e] hover:bg-[#1b9aff] text-[#c7d5e0] hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    追加
                  </button>
                </div>
              </div>
            )}

            {/* Ranked games */}
            {rankedGames.length > 0 && (
              <div className="space-y-2 mb-6">
                <h2 className="font-rajdhani font-semibold text-[#1b9aff] text-lg tracking-wide mb-3">
                  コスパランキング{loading ? "（分析中...）" : ""}
                </h2>
                {rankedGames.map((game, i) => (
                  <GameCard
                    key={game.appid}
                    game={game}
                    rank={i + 1}
                    weights={weights}
                    favoriteTags={favoriteTags}
                    steamid={steamId}
                    style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}
                  />
                ))}
              </div>
            )}

            {/* Spinner when no cards yet during loading */}
            {loading && rankedGames.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-2 border-[#1b9aff] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Free games (after complete) */}
            {isComplete && freeGames.length > 0 && (
              <div className="mb-6">
                <h2 className="font-rajdhani font-semibold text-[#22c55e] text-lg tracking-wide mb-3">
                  無料ゲーム（好評率順）
                </h2>
                <div className="space-y-2">
                  {freeGames.map((game) => (
                    <a
                      key={game.appid}
                      href={`https://store.steampowered.com/app/${game.appid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#22c55e] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-1 bg-[#22c55e] flex-shrink-0" />
                      <div className="w-20 sm:w-24 h-16 flex-shrink-0 overflow-hidden my-3 rounded">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.headerImage} alt={game.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <p className="text-sm text-[#c7d5e0] font-medium truncate">{game.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-[#22c55e] font-bold">FREE</span>
                          {game.reviewTotal > 0 && (
                            <span className="text-xs text-[#8ba3b5]">
                              · {(game.positiveRate * 100).toFixed(0)}% 好評 ({game.reviewTotal.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Unreleased games (after complete) */}
            {isComplete && unreleasedGames.length > 0 && (
              <div className="mb-6">
                <h2 className="font-rajdhani font-semibold text-[#8ba3b5] text-lg tracking-wide mb-3">
                  未発売ゲーム
                </h2>
                <div className="space-y-2">
                  {unreleasedGames.map((game) => (
                    <a
                      key={game.appid}
                      href={`https://store.steampowered.com/app/${game.appid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#8ba3b5] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-1 bg-[#4a6b7c] flex-shrink-0" />
                      <div className="w-20 sm:w-24 h-16 flex-shrink-0 overflow-hidden my-3 rounded">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.headerImage} alt={game.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <p className="text-sm text-[#c7d5e0] font-medium truncate">{game.name}</p>
                        <span className="text-xs text-[#4a6b7c]">Coming Soon</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Load more */}
            {isComplete && hasMore && (
              <div className="text-center mt-2 mb-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-sm border rounded-lg px-5 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-[#c7d5e0] border-[#2a475e] hover:border-[#1b9aff] hover:text-[#1b9aff]"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      詳細分析中...{loadMoreTotal > 0 ? ` (${loadMoreCurrent}/${loadMoreTotal})` : ""}
                    </span>
                  ) : (
                    `さらに詳細分析する（${analyzedCount + 1}〜${Math.min(analyzedCount + 20, allScoredGames.length)}位）`
                  )}
                </button>
              </div>
            )}
            {isComplete && !hasMore && allScoredGames.length > 0 && (
              <p className="text-center text-xs text-[#4a6b7c] mt-2 mb-4">
                全{allScoredGames.length}件の詳細分析が完了しました
              </p>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-[#2a475e] text-xs text-[#4a6b7c]">
        Not affiliated with Valve Corporation. Steam and the Steam logo are trademarks of Valve Corporation.
      </footer>
    </div>
  );
}
