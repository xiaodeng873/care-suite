$confirmation = Read-Host "⚠️ 警告：此操作將刪除 Web 版檔案並重組目錄。請確保已備份。是否繼續？ (y/n)"
if ($confirmation -ne 'y') { exit }

Write-Host "🚀 開始重構..."

# 1. 刪除 Web 相關檔案
Write-Host "🗑️  正在清理 Web 檔案..."
$itemsToRemove = @(".bolt", "frontend", "src", "public", "dist", "node_modules", "index.html", "vite.config.ts", "tsconfig.app.json", "tsconfig.node.json", "tailwind.config.js", "postcss.config.js", "eslint.config.js", "package.json", "package-lock.json", "tsconfig.json", "README.md")

foreach ($item in $itemsToRemove) {
    if (Test-Path $item) {
        Remove-Item -Recurse -Force $item -ErrorAction SilentlyContinue
    }
}

# 2. 移動 Mobile 內容
Write-Host "📦 正在移動 Mobile 專案檔案..."
if (Test-Path "mobile") {
    Get-ChildItem -Path "mobile" -Recurse | Move-Item -Destination "." -Force -ErrorAction SilentlyContinue
    # 上面指令可能無法移動根層級檔案，確保移動 mobile/* 到 .
    Copy-Item -Path "mobile\*" -Destination "." -Recurse -Force
    Remove-Item -Recurse -Force "mobile"
}

Write-Host "✅ 重構完成！"
Write-Host "請執行 'npm install' 來安裝依賴。"
