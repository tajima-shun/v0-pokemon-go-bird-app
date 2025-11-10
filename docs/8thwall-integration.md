# 8thwall統合ガイド

このドキュメントでは、8thwallのAR体験と既存のバードGOアプリを統合する方法について説明します。

## 統合アーキテクチャ

```
8thwall AR Experience (iframe) - メインマップ画面
    ↕ postMessage API
Next.js App (parent window)
    ↕ localStorage
図鑑データベース
```

**重要**: 既存のマップページ（`/`）が8thwallのAR体験に完全移行されました。CanvasMapViewは削除され、8thwallのiframeがメインのマップ表示として機能します。

## 通信プロトコル

### 8thwall → Next.js App

#### 鳥捕獲イベント
```javascript
// 8thwall側で3D鳥を認識・捕獲した時
window.parent.postMessage({
  type: "birdCaptured",
  birdData: {
    id: "sparrow_001",
    name: "Sparrow",
    nameJa: "スズメ",
    species: "Passer montanus",
    rarity: "common",
    imageUrl: "https://example.com/sparrow.jpg",
    description: "一般的な小鳥です",
    habitat: "都市、公園",
    confidence: 0.95
  },
  location: {
    lat: 35.6762,
    lng: 139.6503,
    accuracy: 10
  }
}, "https://your-app-domain.com");
```

**3D鳥の認識方法**:
- **タップ認識**: ユーザーが3D鳥オブジェクトをタップした時
- **距離認識**: ユーザーが3D鳥に近づいた時（自動認識）
- **視線認識**: ユーザーが3D鳥を見つめた時

#### 位置情報更新
```javascript
// 位置情報が更新された時
window.parent.postMessage({
  type: "locationUpdate",
  location: {
    lat: 35.6762,
    lng: 139.6503,
    accuracy: 10
  }
}, "https://your-app-domain.com");
```

#### エラー通知
```javascript
// エラーが発生した時
window.parent.postMessage({
  type: "error",
  error: "カメラへのアクセスが拒否されました"
}, "https://your-app-domain.com");
```

#### 準備完了通知
```javascript
// 8thwallが準備完了した時
window.parent.postMessage({
  type: "ready"
}, "https://your-app-domain.com");
```

### Next.js App → 8thwall

#### 捕獲確認
```javascript
// ユーザーが捕獲を確認した時
window.parent.postMessage({
  type: "captureConfirmed",
  birdId: "sparrow_001"
}, "https://tajin.8thwall.app");
```

#### 捕獲キャンセル
```javascript
// ユーザーが捕獲をキャンセルした時
window.parent.postMessage({
  type: "captureCancelled"
}, "https://tajin.8thwall.app");
```

#### データ同期
```javascript
// 既存のデータを8thwallに送信
window.parent.postMessage({
  type: "syncData",
  userLocation: {
    lat: 35.6762,
    lng: 139.6503
  },
  caughtBirds: ["sparrow_001", "crow_002", "pigeon_003"]
}, "https://tajin.8thwall.app");
```

## 8thwall側の実装例

### 基本的なメッセージリスナー
```javascript
// 8thwall側でNext.jsからのメッセージをリッスン
window.addEventListener('message', function(event) {
  // セキュリティチェック
  if (event.origin !== "https://your-app-domain.com") {
    return;
  }
  
  const data = event.data;
  
  switch(data.type) {
    case 'syncData':
      // 既存の捕獲データを取得
      handleSyncData(data.userLocation, data.caughtBirds);
      break;
    case 'captureConfirmed':
      // 捕獲確認の処理
      handleCaptureConfirmed(data.birdId);
      break;
    case 'captureCancelled':
      // 捕獲キャンセルの処理
      handleCaptureCancelled();
      break;
  }
});
```

### 鳥認識と捕獲の実装例
```javascript
// 鳥を認識・捕獲した時の処理
function onBirdDetected(birdInfo, userLocation) {
  // 既に捕獲済みかチェック
  if (isAlreadyCaught(birdInfo.id)) {
    return;
  }
  
  // 親ウィンドウに捕獲イベントを送信
  window.parent.postMessage({
    type: "birdCaptured",
    birdData: {
      id: birdInfo.id,
      name: birdInfo.commonName,
      nameJa: birdInfo.japaneseName,
      species: birdInfo.scientificName,
      rarity: determineRarity(birdInfo),
      imageUrl: birdInfo.imageUrl,
      description: birdInfo.description,
      habitat: birdInfo.habitat,
      confidence: birdInfo.recognitionConfidence
    },
    location: {
      lat: userLocation.latitude,
      lng: userLocation.longitude,
      accuracy: userLocation.accuracy
    }
  }, "https://your-app-domain.com");
}

// レアリティの決定
function determineRarity(birdInfo) {
  const confidence = birdInfo.recognitionConfidence;
  const rarity = birdInfo.rarity;
  
  if (rarity) return rarity;
  
  if (confidence >= 0.9) return "common";
  if (confidence >= 0.7) return "uncommon";
  if (confidence >= 0.5) return "rare";
  return "legendary";
}
```

## データ形式

### BirdCaptureData
```typescript
interface BirdCaptureData {
  id: string;                    // 一意の識別子
  name: string;                  // 英語名
  nameJa?: string;               // 日本語名
  species?: string;              // 学名
  rarity: "common" | "uncommon" | "rare" | "legendary";
  imageUrl?: string;             // 画像URL
  description?: string;          // 説明文
  habitat?: string;              // 生息地
  confidence?: number;           // 認識信頼度 (0-1)
}
```

### LocationData
```typescript
interface LocationData {
  lat: number;                   // 緯度
  lng: number;                   // 経度
  accuracy?: number;             // 精度（メートル）
}
```

## セキュリティ考慮事項

1. **オリジンチェック**: すべてのメッセージでオリジンを検証
2. **データ検証**: 受信したデータの形式と内容を検証
3. **HTTPS**: 本番環境では必ずHTTPSを使用
4. **CSP**: Content Security Policyでiframeの許可を設定

## トラブルシューティング

### よくある問題

1. **メッセージが届かない**
   - オリジンが正しく設定されているか確認
   - iframeの読み込み完了を待っているか確認

2. **位置情報が取得できない**
   - ブラウザの位置情報許可を確認
   - HTTPS環境で動作しているか確認

3. **画像が表示されない**
   - CORS設定を確認
   - 画像URLが有効か確認

### デバッグ方法

```javascript
// メッセージの送受信をログ出力
window.addEventListener('message', function(event) {
  console.log('Received message:', event.data);
  console.log('From origin:', event.origin);
});

// メッセージ送信時のログ
function sendMessage(data) {
  console.log('Sending message:', data);
  window.parent.postMessage(data, "https://your-app-domain.com");
}
```

## 実装チェックリスト

- [ ] 8thwall側でメッセージリスナーを実装
- [ ] 鳥認識・捕獲時のメッセージ送信を実装
- [ ] 位置情報の取得・送信を実装
- [ ] エラーハンドリングを実装
- [ ] 既存データの同期を実装
- [ ] セキュリティチェックを実装
- [ ] デバッグログを実装
- [ ] テスト環境での動作確認
- [ ] 本番環境での動作確認

