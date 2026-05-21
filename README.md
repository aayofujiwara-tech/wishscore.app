# WishScore

**WishScore** は、SteamウィッシュリストをコスパスコアでランキングするWebアプリです。
SteamIDを入力するだけで、ウィッシュリスト内のゲームを「価格・割引率・レビュースコア」の合成スコアで自動ランキングします。

**WishScore** is a web app that ranks your Steam wishlist games by cost-performance score.
Enter your Steam ID and instantly see your wishlist ranked by a composite score of price, discount, and review ratings.

- **Domain**: wishscore.app
- **Stack**: Next.js (App Router) + TypeScript + Tailwind CSS
- **Deploy**: Vercel

---

## ローカル開発 / Local Development

### 前提条件 / Prerequisites

- Node.js 18+
- Steam API Key（[取得方法](https://steamcommunity.com/dev/apikey)）

### セットアップ / Setup

```bash
git clone https://github.com/aayofujiwara-tech/wishscore.app.git
cd wishscore.app
npm install
```

`.env.local` を作成して Steam API キーを設定：

```bash
cp .env.example .env.local
# .env.local を編集して STEAM_API_KEY を設定
```

```
STEAM_API_KEY=your_steam_api_key_here
```

### 起動 / Run

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

---

## Steam APIキーの取得方法 / How to Get a Steam API Key

1. [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) にアクセス
2. Steamアカウントでログイン
3. ドメイン名（ローカル開発なら `localhost`）を入力して登録
4. 発行されたAPIキーを `.env.local` の `STEAM_API_KEY` に設定

---

## Vercelデプロイ手順 / Deploy to Vercel

1. このリポジトリをVercelにインポート
2. Vercelのダッシュボードで **Environment Variables** を設定：
   - Key: `STEAM_API_KEY`
   - Value: 取得したSteam APIキー
3. デプロイ実行

`vercel.json` により、APIルートのタイムアウトは60秒に設定されています。

---

## スコア計算式 / Score Formula

```
positiveRate = positive / (positive + negative)
reviewWeight = log10(total + 1)
discountBoost = (1 + discount% / 100) ^ discountWeight
score = (positiveRate × reviewWeight × discountBoost × reviewWeight) / price × 1000
```

スライダーで各重みをリアルタイムに調整できます。

---

## 免責事項 / Disclaimer

WishScore は Valve Corporation とは一切関係ありません。
Steam および Steam ロゴは Valve Corporation の商標です。

WishScore is not affiliated with Valve Corporation.
Steam and the Steam logo are trademarks and/or registered trademarks of Valve Corporation in the U.S. and/or other countries.
