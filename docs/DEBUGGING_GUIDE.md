# デバッグガイド: 8thwall捕獲イベントの確認方法

## 重要な注意点

**8thwallはiframe内で動作するため、2つの異なるコンソールがあります：**
1. **親ウィンドウ（Next.jsアプリ）のコンソール**
2. **iframe内（8thwall）のコンソール**

## 確認手順

### ステップ1: ブラウザの開発者ツールを開く

1. Chrome/Edge: `F12` または `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. Firefox: `F12` または `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)

### ステップ2: iframe内のコンソールを確認する方法

#### 方法A: 8thwallのURLを直接開く

1. 新しいタブで `https://tajin.8thwall.app/answer/` を開く
2. 開発者ツールを開く
3. Consoleタブで以下を確認：
   - `📱 app.js: starting imports...`
   - `🌉 bridge.js: bridge exported to window.bridge`
   - 鳥をクリックしたときに `🐦 catch-bird: _onHit called`

#### 方法B: iframeのコンテキストを切り替える（Chrome/Edge）

1. 開発者ツールのConsoleタブで、左上のドロップダウンをクリック
2. `top` から `iframe[name="..."][src="..."]` を選択
3. これでiframe内のコンソールログが見えます

#### 方法C: 親ウィンドウからiframe内のコンソールにアクセス

親ウィンドウのコンソールで以下を実行：

```javascript
// iframe要素を取得
const iframe = document.querySelector('iframe[src*="8thwall"]')

// iframe内のwindowにアクセス（CORS制限がある場合あり）
try {
  const iframeWindow = iframe.contentWindow
  console.log('iframe window:', iframeWindow)
  // iframe内のconsole.logを確認するには、iframe内で実行する必要があります
} catch (e) {
  console.log('CORS制限によりアクセス不可:', e)
}
```

### ステップ3: 各段階での確認ポイント

#### 1. 初期化の確認

**親ウィンドウ（Next.js）のコンソールで確認：**
- `AR page: received message event` - メッセージイベントを受信
- `AR bridge: received message` - メッセージが検証済み
- `AR_READY` メッセージが表示される

**iframe内（8thwall）のコンソールで確認：**
- `📱 app.js: starting imports...`
- `🌉 bridge.js: bridge exported to window.bridge`
- `bridge: sending message to app` (AR_READYメッセージ)

#### 2. 鳥のクリック確認

**iframe内（8thwall）のコンソールで確認：**
- `🐦 catch-bird: _onHit called` - クリックイベントが検出された
- `🐦 catch-bird: capture success` - 捕獲成功
- `🐦 catch-bird: sending AR_BIRD_CAPTURED` - メッセージ送信準備完了
- `bridge: sending message to app` - メッセージ送信

**親ウィンドウ（Next.js）のコンソールで確認：**
- `AR page: received message event` - メッセージ受信
- `AR bridge: received message` - メッセージ検証成功
- `AR_BIRD_CAPTURED received, calling handleBirdCaptured` - ハンドラー呼び出し
- `handleBirdCaptured called with:` - 処理開始

### ステップ4: 問題の特定

#### ログが全く表示されない場合

1. **8thwallが正しくロードされているか確認**
   ```javascript
   // 親ウィンドウのコンソールで
   document.querySelector('iframe[src*="8thwall"]')?.src
   ```

2. **bridge.jsがロードされているか確認**
   ```javascript
   // iframe内のコンソールで（8thwallのURLを直接開いて）
   window.bridge
   ```

#### `catch-bird: _onHit called` が表示されない場合

- 鳥が正しくスポーンされているか確認
- `catch-bird`コンポーネントが正しくアタッチされているか確認
- クリックイベントが正しく登録されているか確認

#### `bridge: sending message to app` が表示されない場合

- `window.bridge` が存在するか確認
- `bridge.sendToApp` が関数か確認
- `window.parent` が存在するか確認（iframe内でない可能性）

#### 親ウィンドウでメッセージが受信されない場合

- `AR page: received message event` が表示されるか確認
- origin検証が失敗していないか確認（`AR bridge: origin mismatch` が表示されないか）
- メッセージの形式が正しいか確認（`AR bridge: validation error` が表示されないか）

## クイックチェックコマンド

### 親ウィンドウ（Next.js）のコンソールで実行：

```javascript
// メッセージリスナーが登録されているか確認
console.log('Message listeners:', getEventListeners(window).message)

// iframe要素を確認
const iframe = document.querySelector('iframe[src*="8thwall"]')
console.log('iframe:', iframe)
console.log('iframe src:', iframe?.src)
```

### iframe内（8thwall）のコンソールで実行：

```javascript
// bridgeが存在するか確認
console.log('window.bridge:', window.bridge)
console.log('window.parent:', window.parent)
console.log('window.parent === window:', window.parent === window)

// 手動でメッセージを送信してテスト
if (window.bridge && window.bridge.sendToApp) {
  window.bridge.sendToApp({
    type: 'AR_BIRD_CAPTURED',
    payload: {
      birdId: 'test-bird',
      species: 'crow',
      capturedAt: Date.now()
    }
  })
}
```

## よくある問題と解決方法

### 問題1: `window.bridge is undefined`

**原因**: bridge.jsがロードされていない、または遅延ロードされている

**解決方法**:
- `app.js`でbridge.jsが正しくインポートされているか確認
- 8thwallのビルドプロセスを確認

### 問題2: `not in iframe, cannot send message`

**原因**: 8thwallが直接開かれている（iframe内でない）

**解決方法**:
- 必ずNext.jsアプリからiframe経由で開く
- 直接URLを開いてテストする場合は、このエラーは無視してOK

### 問題3: `origin mismatch`

**原因**: origin検証が失敗している

**解決方法**:
- 環境変数 `NEXT_PUBLIC_8THWALL_ORIGIN` を設定
- 開発環境では `*` を使用することを確認

