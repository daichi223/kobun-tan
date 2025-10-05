# ビルド手順

WSL環境ではnpm installが非常に遅いため、Windows側でビルドすることを推奨します。

## Windows PowerShellまたはコマンドプロンプトでの手順

1. プロジェクトディレクトリに移動
```
cd C:\Users\daichi\Documents\kobun-tan
```

2. 依存関係をインストール（初回のみ）
```
npm install
```

3. ビルド実行
```
npm run build
```

4. distディレクトリが作成されます

5. Gitでdistをコミット・プッシュ
```
git add dist
git commit -m "build: distを更新"
git push
```

## 注意
- WSL環境ではnode_modulesのインストールが完了しないため
- Windows側で実行してください
