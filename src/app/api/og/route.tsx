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
  if (score >= 10) return "#4ade80";
  if (score >= 5) return "#fb923c";
  return "#94a3b8";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rank = searchParams.get("rank") ?? "1";
  const name = searchParams.get("name") ?? "Unknown Game";
  const score = parseFloat(searchParams.get("score") ?? "0");
  const price = searchParams.get("price") ?? "";
  const discount = parseInt(searchParams.get("discount") ?? "0");
  const positive = searchParams.get("positive") ?? "0";
  const imageUrl = searchParams.get("image") ?? "";

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "NotoSansJP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];

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
        <div style={{ width: "420px", height: "630px", flexShrink: 0, display: "flex" }}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              style={{ width: "420px", height: "630px", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "420px", height: "630px", background: "#16202d", display: "flex" }} />
          )}
        </div>

        {/* Divider */}
        <div style={{ width: "3px", background: "#2a475e", flexShrink: 0, display: "flex" }} />

        {/* Right: info */}
        <div
          style={{
            flex: 1,
            padding: "48px 52px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#16202d",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "22px", color: "#1b9aff", fontWeight: 700, letterSpacing: "0.15em" }}>
              WishScore
            </span>
          </div>

          {/* Main info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#1b9aff22",
                border: "1px solid #1b9aff44",
                borderRadius: "8px",
                padding: "6px 16px",
                width: "fit-content",
              }}
            >
              <span style={{ fontSize: "20px", color: "#1b9aff", fontWeight: 700 }}>
                #{rank} コスパランキング
              </span>
            </div>

            <div
              style={{
                fontSize: name.length > 30 ? "28px" : "34px",
                color: "#c7d5e0",
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              {name}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                style={{
                  fontSize: "60px",
                  fontWeight: 700,
                  color: scoreColor(score),
                  lineHeight: 1,
                }}
              >
                {score.toFixed(1)}
              </span>
              <span style={{ fontSize: "36px", lineHeight: 1 }}>🔥</span>
            </div>
          </div>

          {/* Price / review row */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
            {price && (
              <span style={{ fontSize: "24px", color: "#c7d5e0", fontWeight: 700 }}>
                {price}
              </span>
            )}
            {discount > 0 && (
              <span
                style={{
                  fontSize: "20px",
                  background: "#1b9aff",
                  color: "white",
                  padding: "4px 14px",
                  borderRadius: "6px",
                  fontWeight: 700,
                }}
              >
                -{discount}%
              </span>
            )}
            <span style={{ fontSize: "20px", color: "#8ba3b5" }}>
              ⭐ {positive}% 好評
            </span>
          </div>

          {/* CTA */}
          <div style={{ fontSize: "18px", color: "#4a6b7c" }}>
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
