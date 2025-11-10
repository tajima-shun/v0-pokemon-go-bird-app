# トラブルシューティング: postMessageが届かない問題

## 問題の状況

- ✅ ステップ1, 2は問題なし（初期化ログは表示される）
- ❌ 8thwall側で `bridge: sending message to app` が表示されない
- ❌ Next.js側で `AR page: received message event` が表示されない

## 原因の特定

### 確認1: 8thwallがiframe内で動作しているか

8thwallのコンソールで以下を実行：

```javascript
console.log('window.parent:', window.parent)
console.log('window.parent === window:', window.parent === window)
console.log('window.top:', window.top)
console.log('window.top === window:', window.top === window)
```

**期待される結果（iframe内の場合）:**
- `window.parent !== window` → `true`
- `window.top !== window` → `true`

**問題がある場合（直接URLを開いている場合）:**
- `window.parent === window` → `true`（これが原因！）

### 確認2: 8thwall側のsendToAppが呼ばれているか

8thwallのコンソールで以下を確認：

1. `🌉 bridge.js: notifyReady called` が表示されているか
2. `🌉 bridge.js: sendToApp called` が表示されているか
3. `❌ bridge: not in iframe, cannot send message` が表示されているか

### 確認3: Next.js側のメッセージリスナーが動作しているか

Next.jsのコンソールで以下を確認：

1. `📱 AR page: setting up message listener` が表示されているか
2. `📱 AR page: message listener added` が表示されているか

### 確認4: 手動でpostMessageをテスト

#### Next.js側のコンソールで実行：

```javascript
// メッセージリスナーが登録されているか確認
const iframe = document.querySelector('iframe[src*="8thwall"]')
console.log('iframe:', iframe)

// iframe内からメッセージを送信するテスト（iframe内のコンソールで実行する必要がある）
// このコードはiframe内のコンソールで実行してください
```

#### 8thwall側のコンソールで実行：

```javascript
// 手動でpostMessageを送信
if (window.parent && window.parent !== window) {
  console.log('✅ in iframe, sending test message')
  window.parent.postMessage({
    type: 'AR_READY',
    payload: { version: '1.0.0-test' }
  }, '*')
  console.log('✅ test message sent')
} else {
  console.error('❌ NOT in iframe! window.parent === window')
}
```

このテストメッセージがNext.js側のコンソールに表示されれば、通信は正常です。

## 解決方法

### 方法1: iframeが正しく読み込まれているか確認

Next.js側のコンソールで：

```javascript
const iframe = document.querySelector('iframe[src*="8thwall"]')
console.log('iframe存在:', !!iframe)
console.log('iframe src:', iframe?.src)
console.log('iframe contentWindow:', iframe?.contentWindow)

// iframeの読み込み状態を確認
iframe?.addEventListener('load', () => {
  console.log('✅ iframe loaded')
})
```

### 方法2: 環境変数を確認

`.env.local` ファイルに以下が設定されているか確認：

```env
NEXT_PUBLIC_8THWALL_EMBED_URL=https://tajin.8thwall.app/answer/
NEXT_PUBLIC_8THWALL_ORIGIN=https://tajin.8thwall.app
NEXT_PUBLIC_ALLOWED_ORIGIN=http://localhost:3000
```

**重要**: `NEXT_PUBLIC_ALLOWED_ORIGIN` はNext.jsアプリのorigin（開発環境では `http://localhost:3000`）を設定してください。

### 方法3: 8thwallのURLにクエリパラメータを追加

iframeのsrcに `appOrigin` を追加：

```tsx
const embedUrl = `${process.env.NEXT_PUBLIC_8THWALL_EMBED_URL || 'https://tajin.8thwall.app/answer/'}?appOrigin=${encodeURIComponent(window.location.origin)}`
```

### 方法4: 直接postMessageでテスト（フォールバック）

8thwall側の `catch-bird.js` で、bridgeが失敗した場合のフォールバックを追加（既に実装済み）。

## 次のステップ

1. **8thwallのコンソールで以下を確認:**
   - `🌉 bridge.js: notifyReady called` が表示されているか
   - `🌉 bridge.js: sendToApp called` が表示されているか
   - `window.parent === window` の結果

2. **結果を報告:**
   - どのログが表示されたか
   - `window.parent === window` の結果
   - エラーメッセージがあれば内容

これらの情報があれば、次の修正方法を提案できます。

