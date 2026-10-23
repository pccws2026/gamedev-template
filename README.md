# gamedev-template

Phaser 4 + Vite + TypeScript のゲーム開発テンプレート。

## セットアップ

```bash
npm install
npm run dev
```

`npm run dev` でブラウザが自動で開き、`http://localhost:5173` でゲームが動く。
`src/` 以下を編集すると HMR で即座に反映される（Phaser の Game インスタンスは破棄・再生成される）。

## スクリプト

- `npm run dev` — 開発サーバー起動（HMR 有効）
- `npm run build` — 型チェック後に `dist/` へ本番ビルド
- `npm run preview` — ビルド結果をローカルで確認
- `npm run typecheck` — 型チェックのみ

## ゲームモードとランキング

タイトル画面上部のモードボタンを押すと「経過モード」と「制限モード」が切り替わり、表示されているモードで開始します。制限モードは残り時間が0になると終了し、経過モードは経過時間を計測してゲームを続けます。隣の「シード固定」ボタンを有効にすると前回のシードが入力され、同じ迷路でプレイできます。シード入力欄にコマンドを入力して Enter を押すと、ゲームを開始せず設定を変更できます。`system` は `sys`、`gamemode` は `gmd` に省略できます。

| コマンド | 動作 |
| --- | --- |
| `gamemode developer` (`gmd dev`) | 開発者モード（壁抜け、HP・EG非表示、無敵、一撃撃破、全視界・ミニマップ解放。同じ方向の移動キー同時押しまたはShiftで2倍速） |
| `gamemode default` (`gmd def`) | 通常モードに戻す |
| `system developer ranking` (`sys dev ran`) | 開発ランキングを表示 |
| `system player attack range 10` (`sys pyr at rg 10`) | プレイヤーの攻撃範囲を指定倍率にする |
| `system enemy attack range 10` (`sys emy at rg 10`) | 敵の攻撃範囲を指定倍率にする |
| `system speed 10` (`sys sp 10`) | ゲーム内時間・速度を指定倍率にする |
| `system time 10` | ゲーム時間を指定秒数にする |
| `system time true` / `system time false` | ゲーム時間の進行を切り替える |
| `system default` (`sys def`) | システム設定を初期状態に戻す |

攻撃範囲と速度の倍率は任意の正の数値に変更できます。タイトル画面下部からRSG（ランダムシード）とSSG（シード指定）のランキングを確認できます。設定変更中のクリアタイムは別枠の開発ランキングに上位100位まで記録され、`system developer ranking` (`sys dev ran`) で表示できます。各ランキングはブラウザーのローカルストレージに保存され、一覧はホイールまたは上下キーでスクロールできます。タイムをクリックするとリプレイが開き、再生・一時停止、5秒送り／戻し、シークバーで操作できます。リプレイ画面下部のシードをクリックすると、その値を入力したタイトル画面に戻ります。名前は英数字0〜5文字で入力できます。

## 構成

```
index.html            エントリ HTML。#game-container に canvas が入る
vite.config.ts        Vite 設定
tsconfig.json         TypeScript 設定
public/               そのまま配信される静的アセット置き場
src/
  main.ts             GameConfig と Game インスタンスの生成、HMR 処理
  scenes/
    HelloScene.ts     'Hello, world!' を表示するだけのシーン
```

## アセットの置き方

`public/` に置いたファイルはルート直下から参照できる。

```ts
this.load.image('logo', 'logo.png'); // public/logo.png
```

## シーンの追加

1. `src/scenes/` に `Phaser.Scene` を継承したクラスを作る
2. `src/main.ts` の `scene` 配列に追加する（配列の先頭のシーンが最初に起動する）

## AI コーディングエージェント向け

`AGENTS.md` に作業指針を置いている（Claude Code 用に `CLAUDE.md` から取り込み済み）。

Phaser 4 の公式ドキュメントは `node_modules/phaser/skills/<トピック>/SKILL.md` に 28 トピック分同梱されている。
API を書く前に該当トピックを読ませると、v3 と v4 の取り違えを防げる。詳細は `AGENTS.md` を参照。

ああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああ