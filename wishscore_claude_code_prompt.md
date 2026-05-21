# WishScore 実装プロンプト（Claude Code用）

## プロジェクト概要

**WishScore** は、SteamウィッシュリストをコスパスコアでランキングするWebアプリ。
ユーザーがSteamIDを入力するだけで、ウィッシュリスト内のゲームを
「価格・割引率・レビュースコア」の合成スコアで自動ランキングする。

- **ドメイン**: wishscore.app
- **デプロイ先**: Vercel
- **スタック**: Next.js (App Router) + Tailwind CSS + TypeScript

---

## 実装指示

### ステップ1：プロジェクト初期化

```bash
npx create-next-app@latest wishscore --typescript --tailwind --app --src-dir --import-alias "@/*"
cd wishscore
```

---

### ステップ2：環境変数

`.env.local` を作成：

```
STEAM_API_KEY=your_steam_api_key_here
```

`.env.local` を `.gitignore` に追加されていることを確認する。

---

### ステップ3：APIルート実装

#### `src/app/api/wishlist/route.ts`

以下の処理を実装すること：

1. クエリパラメータ `steamid` を受け取る
2. `https://store.steampowered.com/wishlist/profiles/{steamid}/wishlistdata/?p={page}` を
   ページ（p=0, 1, 2...）ごとにフェッチし、空になるまで全件取得する
3. 取得したappidリストに対して、
   `https://store.steampowered.com/api/appdetails?appids={appid}&cc=jp&l=japanese`
   を **5件ずつバッチ処理（並列）** でフェッチする（レートリミット対策）
4. 各ゲームから以下を抽出する：
   - `name`: ゲーム名
   - `header_image`: サムネイル画像URL
   - `price_overview.final`: 現在価格（円、整数）
   - `price_overview.initial`: 定価（円、整数）
   - `price_overview.discount_percent`: 割引率（0〜100）
   - `recommendations.total`: レビュー総数
   - `metacritic.score`: メタクリティックスコア（あれば）
   - `short_description`: 短い説明文
   - `genres`: ジャンル配列
   - `is_free`: 無料ゲームフラグ
5. **コスパスコア**を以下の式で計算する：

```
// 好評率をSteamのレビューAPIから取得
// GET https://store.steampowered.com/appreviews/{appid}?json=1&language=all

const positiveRate = positive / (positive + negative);  // 0.0〜1.0
const reviewWeight = Math.log10(total + 1);             // レビュー件数の対数
const discountBoost = Math.pow(1 + discount_percent / 100, 2);
const priceJPY = final / 100;  // steamは銭単位

// 無料ゲームは除外してスコア計算不可
// 価格0円・未発売は別グループとして扱う

const score = (positiveRate * reviewWeight * discountBoost / priceJPY) * 1000;
```

6. スコア降順でソートしてJSONレスポンスを返す
7. エラーハンドリング：
   - ウィッシュリストが非公開 → `{ error: "PRIVATE_WISHLIST" }`
   - SteamIDが存在しない → `{ error: "INVALID_STEAMID" }`
   - レート制限エラー → リトライ（最大3回、500msインターバル）

レスポンス型：
```typescript
type GameResult = {
  appid: number;
  name: string;
  headerImage: string;
  priceJPY: number;
  originalPriceJPY: number;
  discountPercent: number;
  positiveRate: number;   // 0.0〜1.0
  reviewTotal: number;
  score: number;
  isFree: boolean;
  isUnreleased: boolean;
  shortDescription: string;
  genres: string[];
};

type ApiResponse = {
  games: GameResult[];
  totalCount: number;
  freeGames: GameResult[];
  unreleasedGames: GameResult[];
  error?: string;
};
```

---

### ステップ4：フロントエンド実装

#### `src/app/page.tsx`（メインページ）

**デザイン方針：**
- テーマ：ダーク、Steam的なゲーミング雰囲気。深みのある黒〜紺のグラデーション背景
- フォント：見出しに `Rajdhani` または `Orbitron`（Google Fonts）、本文に `Noto Sans JP`
- アクセントカラー：Steamのブルー系（#1b9aff）をベースに、スコアに応じてグリーン〜レッドのグラデーション
- アニメーション：ランキング表示時に上からカード順番にフェードイン（stagger animation）

**画面構成：**

```
┌─────────────────────────────────────────┐
│  ヘッダー                                │
│  WishScore ロゴ + キャッチコピー          │
│  "Find your best deal from wishlist"    │
├─────────────────────────────────────────┤
│  入力エリア                              │
│  [SteamID or Profile URL を入力    ] [分析] │
│  ※ SteamIDの調べ方リンク付き            │
├─────────────────────────────────────────┤
│  ローディング表示（取得中プログレス）      │
│  "Fetching wishlist... (32/150 games)"  │
├─────────────────────────────────────────┤
│  スコア重み調整パネル（折りたたみ）        │
│  割引率の重み [====|----] 2.0x          │
│  レビュー件数の重み [===|-----] 1.5x    │
│  価格の重み [====|----] 1.0x            │
├─────────────────────────────────────────┤
│  ランキング結果                           │
│  #1 [サムネ] ゲーム名                    │
│       ¥1,200（定価¥2,400・50%OFF）      │
│       ⭐ 97% 好評 (12,450件)            │
│       Score: 284.5 🔥                  │
│  ─────────────────────────────────────  │
│  #2 ...                                │
├─────────────────────────────────────────┤
│  無料ゲームセクション（別グループ）        │
│  未発売ゲームセクション（別グループ）      │
├─────────────────────────────────────────┤
│  フッター                                │
│  Not affiliated with Valve Corporation. │
└─────────────────────────────────────────┘
```

**実装すべきReact state：**
```typescript
const [steamId, setSteamId] = useState("");
const [loading, setLoading] = useState(false);
const [progress, setProgress] = useState({ current: 0, total: 0 });
const [results, setResults] = useState<ApiResponse | null>(null);
const [error, setError] = useState<string | null>(null);
const [weights, setWeights] = useState({
  discount: 2.0,
  review: 1.0,
  price: 1.0,
});
```

**スコアカードのデザイン：**
- 1〜3位はゴールド・シルバー・ブロンズのバッジ
- スコアに応じてカード左端にカラーバー（高スコア=緑、低スコア=赤）
- セール中のゲームには炎アイコン🔥またはセールバッジ
- ゲームカードをクリックするとSteamストアページを新しいタブで開く
- 好評率をプログレスバーで視覚化

---

### ステップ5：SteamID解決ユーティリティ

`src/lib/steamUtils.ts` を作成：

- カスタムURL（`https://steamcommunity.com/id/username`）を入力された場合、
  `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1?vanityurl={username}&key={API_KEY}`
  でSteamID64に変換する
- 数字のみのSteamID64はそのまま使用する

---

### ステップ6：Vercelデプロイ設定

`vercel.json` を作成：
```json
{
  "functions": {
    "src/app/api/wishlist/route.ts": {
      "maxDuration": 60
    }
  }
}
```

Vercelの環境変数に `STEAM_API_KEY` を設定する手順をREADME.mdに記載する。

---

### ステップ7：README.md

以下を含めること：
- プロジェクト概要（日本語・英語）
- ローカル開発手順
- Steam APIキーの取得方法（https://steamcommunity.com/dev/apikey）
- Vercelデプロイ手順
- 免責事項（Valve非公認ツールである旨）

---

## 注意事項・制約

- Steam APIキーは絶対にフロントエンドのコードに含めないこと
- `appdetails` APIは並列リクエスト数を抑えること（5件/バッチ推奨）
- ウィッシュリストが非公開の場合は、Steamの公開設定変更ページへの
  リンクを含むわかりやすいエラーメッセージを表示すること
- 無料ゲームはスコア計算から除外し、別セクションで「おすすめ順（レビュー好評率順）」で表示すること
- 未発売ゲーム（`price_overview` が存在しない）も別セクションで表示すること

---

## 完成イメージ

```
ユーザー操作フロー：
1. wishscore.app にアクセス
2. SteamIDまたはプロフィールURLを入力
3. 「分析」ボタンをクリック
4. ローディング中にプログレス表示
5. コスパランキングが表示される
6. スライダーで重みを調整するとリアルタイムに順位が変わる
7. ゲームをクリックするとSteamストアに飛ぶ
```
