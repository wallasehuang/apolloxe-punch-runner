# 使用 Node.js 20 的 Alpine Linux 版本作為基礎映像
# Alpine 版本體積小，適合 Docker 部署
# 確保選擇適合 Raspberry Pi (ARMv7 或 ARM64) 的映像，node:20-alpine 通常會自動選擇正確的架構
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 將 package.json 和 package-lock.json 複製到工作目錄
# 這樣可以利用 Docker 的層快取，如果依賴沒有改變，就不需要重新安裝
COPY package*.json ./

# 安裝專案依賴
RUN npm install --production

# 將所有應用程式檔案複製到工作目錄
COPY . .

# 暴露應用程式可能使用的端口 (如果你的應用程式有提供 Web 服務，雖然這個腳本沒有)
# EXPOSE 3000

# 定義容器啟動時執行的命令
# 這裡我們直接執行 index.js 腳本
CMD ["node", "index.js"]
