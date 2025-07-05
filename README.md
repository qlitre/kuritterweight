体重をLineBOTに送ると前日比を返してくれるプログラム。
これを用いて毎朝の体重ツイートを行っている。

## 処理の流れ

- LineBOTからwebhookをcloudflare x honoに送信
- メッセージから数値を取得
- D1から最新の重量（=前日）を取り出す
- 前日比を計算
- D1に受け取った重量を保存
- Lineにメッセージを返す

## MCP サーバー

クライアントから体重データにアクセスできるMCPサーバーが含まれている。

### 利用可能なツール

1. **getRecentWeight** - 最新の体重データ（直近7日分）を取得
2. **getMonthlyAverageWeight** - 月別の平均体重を取得
   - オプションで取得する月数を指定可能（最大60ヶ月）

### 使用方法

MCPクライアントから以下の設定で接続。

```json
{
  "mcpServers": {
    "kuritterweight-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://kuritterweight.qlitre.workers.dev/mcp"
      ]
    }
  }
}
```
