import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; WishScore/1.0)" } }
    ).then((r) => r.text());
    const match = css.match(/url\(([^)]+\.woff2)\)/);
    if (!match) return null;
    return fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

function scoreColor(score: number): string {
  if (score >= 8) return "#4ade80";
  if (score >= 5) return "#fb923c";
  return "#94a3b8";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rank     = searchParams.get("rank") ?? "1";
  const name     = searchParams.get("name") ?? "Unknown Game";
  const score    = parseFloat(searchParams.get("score") ?? "0");
  const price    = searchParams.get("price") ?? "";
  const discount = parseInt(searchParams.get("discount") ?? "0");
  const positive = searchParams.get("positive") ?? "0";
  const imageUrl = searchParams.get("image") ?? "";

  // New params
  const hltbRaw  = searchParams.get("hltb");
  const pphRaw   = searchParams.get("pph");
  const expiry   = searchParams.get("expiry");
  const lowRaw   = searchParams.get("low");
  const atlow    = searchParams.get("atlow") === "1";
  const tagsStr  = searchParams.get("tags") ?? "";

  const hltb = hltbRaw ? parseFloat(hltbRaw) : null;
  const pph  = pphRaw  ? parseInt(pphRaw)    : null;
  const low  = lowRaw  ? parseInt(lowRaw)    : null;
  const tags = tagsStr ? tagsStr.split(",").filter(Boolean) : [];

  let daysLeft: number | null = null;
  if (expiry) {
    const ms = new Date(expiry).getTime() - Date.now();
    const d  = Math.ceil(ms / 1000 / 60 / 60 / 24);
    if (d >= 0) daysLeft = d;
  }

  const fontData = await loadFont();
  const fonts    = fontData
    ? [{ name: "NotoSansJP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];

  const color      = scoreColor(score);
  const nameSize   = name.length > 36 ? "22px" : name.length > 24 ? "26px" : "32px";
  const hasExtra   = hltb != null || daysLeft != null || low != null;
  const hasTags    = tags.length > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          fontFamily: fontData ? "NotoSansJP, sans-serif" : "sans-serif",
          background: "linear-gradient(135deg, #0f1923 0%, #1b2838 100%)",
        }}
      >
        {/* Left: thumbnail */}
        <div style={{ width: "400px", height: "630px", flexShrink: 0, display: "flex" }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{ width: "400px", height: "630px", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "400px", height: "630px", background: "#16202d", display: "flex" }} />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: "3px", background: "#2a475e", flexShrink: 0, display: "flex" }} />

        {/* Right: info */}
        <div
          style={{
            flex: 1,
            padding: "32px 44px",
            display: "flex",
            flexDirection: "column",
            gap: "0px",
            background: "#16202d",
          }}
        >
          {/* Logo + Rank badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "18px", color: "#1b9aff", fontWeight: 700, letterSpacing: "0.15em" }}>
              WishScore
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#1b9aff22",
                border: "1px solid #1b9aff44",
                borderRadius: "6px",
                padding: "4px 14px",
              }}
            >
              <span style={{ fontSize: "16px", color: "#1b9aff", fontWeight: 700 }}>
                #{rank} コスパランキング
              </span>
            </div>
          </div>

          {/* Game name */}
          <div
            style={{
              fontSize: nameSize,
              color: "#c7d5e0",
              fontWeight: 700,
              lineHeight: 1.3,
              marginBottom: "10px",
            }}
          >
            {name}
          </div>

          {/* Score */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "14px" }}>
            <span style={{ fontSize: "58px", fontWeight: 700, color, lineHeight: 1 }}>
              {score.toFixed(1)}
            </span>
            <span style={{ fontSize: "34px", lineHeight: 1 }}>🔥</span>
          </div>

          {/* Price + discount + reviews */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
            {price && (
              <span style={{ fontSize: "22px", color: "#c7d5e0", fontWeight: 700 }}>
                {price}
              </span>
            )}
            {discount > 0 && (
              <span
                style={{
                  fontSize: "18px",
                  background: "#1b9aff",
                  color: "white",
                  padding: "3px 12px",
                  borderRadius: "5px",
                  fontWeight: 700,
                }}
              >
                -{discount}%
              </span>
            )}
            <span style={{ fontSize: "18px", color: "#8ba3b5" }}>
              ⭐ {positive}% 好評
            </span>
          </div>

          {/* HLTB + sale expiry + historical low */}
          {hasExtra && (
            <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
              {hltb != null && (
                <span style={{ fontSize: "17px", color: "#94a3b8", display: "flex" }}>
                  🕐 約{Math.round(hltb)}時間{pph != null ? `  ·  ¥${pph.toLocaleString()}/時間` : ""}
                </span>
              )}
              {daysLeft != null && (
                <span
                  style={{
                    fontSize: "17px",
                    color: daysLeft <= 3 ? "#f87171" : daysLeft <= 7 ? "#fb923c" : "#94a3b8",
                    display: "flex",
                  }}
                >
                  ⏰ あと{daysLeft}日
                </span>
              )}
              {low != null && (
                atlow ? (
                  <span style={{ fontSize: "17px", color: "#4ade80", display: "flex" }}>🏆 過去最安値！</span>
                ) : (
                  <span style={{ fontSize: "17px", color: "#64748b", display: "flex" }}>
                    📉 過去最安値 ¥{low.toLocaleString()}
                  </span>
                )
              )}
            </div>
          )}

          {/* Tags */}
          {hasTags && (
            <div style={{ fontSize: "15px", color: "#4a6b7c", marginBottom: "10px", display: "flex" }}>
              {tags.join(" / ")}
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: "auto", fontSize: "16px", color: "#4a6b7c", display: "flex" }}>
            wishscore.app で分析する →
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );
}
