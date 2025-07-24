# ApolloXE 自動補卡工具

這是一個 Node.js 腳本，用於自動登入 May-OHR 人力資源管理系統，並自動處理忘記打卡（上班/下班）的補卡申請。它旨在簡化手動補卡流程，提高效率。

## ✨ 功能

*   **自動登入**: 使用 Puppeteer 模擬瀏覽器行為，自動登入 May-OHR 系統並獲取會話 Cookie。
*   **自動獲取異常打卡紀錄**: 透過 API 抓取指定日期範圍內所有未打卡或未打下班卡的紀錄。
*   **自動提交補卡申請**: 針對異常紀錄，自動提交補卡申請，並附帶「忘記打卡」的理由。
*   **頻率控制**: 內建請求間隔延遲，避免觸發後端頻率偵測機制。
*   **靈活的日期區間**:
    *   預設執行時，自動處理過去一個月的補卡紀錄。
    *   支援透過命令列參數指定任意日期區間進行補卡。
*   **詳細日誌**: 提供清晰的執行日誌，包括補卡清單和完成補卡申請的統計。

## 🚀 快速開始

### 前置條件

在執行此專案之前，請確保你的系統已安裝以下軟體：

*   [Node.js](https://nodejs.org/en/) (建議 v16 或更高版本)
*   [npm](https://www.npmjs.com/) (通常隨 Node.js 一起安裝)

### 安裝

1.  **複製專案**:
    ```bash
    git clone https://github.com/your-username/apolloxe.git
    cd apolloxe
    ```
    (請將 `https://github.com/your-username/apolloxe.git` 替換為你的實際 GitHub 儲存庫地址)

2.  **安裝依賴**:
    ```bash
    npm install
    ```

### 配置

1.  **建立 `.env` 文件**:
    在專案的根目錄下建立一個名為 `.env` 的文件，並填入你的 May-OHR 登入帳號和密碼：

    ```
    USERNAME=你的MayOHR帳號
    PASSWORD=你的MayOHR密碼
    ```
    **重要**: `.env` 文件包含敏感資訊，請確保不要將其提交到版本控制系統中（已在 `.dockerignore` 和 `.gitignore` 中配置）。

### 使用

你可以透過以下方式執行腳本：

1.  **自動處理過去一個月的補卡紀錄 (預設)**:
    ```bash
    node index.js
    ```

2.  **指定日期區間進行補卡**:
    你可以提供兩個 `YYYY-MM-DD` 格式的日期作為命令列參數，分別代表開始日期和結束日期。

    ```bash
    node index.js 2025-06-01 2025-07-10
    ```
    如果日期格式不正確，腳本將會使用預設的過去一個月區間。

## 🐳 Docker 部署 (推薦)

為了更方便地部署和管理，你可以將此應用程式打包成 Docker 映像。

### 建立 Docker 映像

在專案根目錄下執行：

```bash
docker build -t apolloxe-auto-punch .
```

### 執行 Docker 容器

由於 `.env` 文件包含敏感資訊，我們建議將其掛載到容器中：

```bash
docker run --rm \
  --name apolloxe-punch-runner \
  -v /path/to/your/apolloxe/.env:/app/.env \
  apolloxe-auto-punch
```
**請務必將 `/path/to/your/apolloxe/.env` 替換為你在主機上 `.env` 文件的實際絕對路徑。**

## ⏰ 自動化排程 (Cron Job)

你可以在 Linux 系統 (例如 Raspberry Pi) 上使用 Cron 來設定每日自動執行此腳本。

1.  **編輯 Cron 表**:
    ```bash
    crontab -e
    ```

2.  **新增 Cron 任務**:
    在文件末尾新增以下一行，設定為每天午夜 00:00 執行：

    ```cron
    0 0 * * * /usr/bin/docker run --rm -v /path/to/your/apolloxe/.env:/app/.env apolloxe-auto-punch >> /var/log/apolloxe_punch.log 2>&1
    ```
    *   請確認 `/usr/bin/docker` 是你系統上 `docker` 命令的實際路徑 (可以使用 `which docker` 查詢)。
    *   再次確認 `-v` 後的 `.env` 文件路徑是正確的。
    *   `>> /var/log/apolloxe_punch.log 2>&1` 會將所有輸出重定向到日誌文件，方便追蹤。

## ⚠️ 注意事項與故障排除

*   **頻率偵測**: 如果遇到「請勿連續送單」的錯誤，表示後端偵測到高頻率請求。腳本已內建 3 秒延遲，如果仍有問題，可以嘗試在 `index.js` 中增加 `await new Promise((r) => setTimeout(r, 3000));` 的延遲時間。
*   **Puppeteer 依賴**: 在 Docker 環境中，如果 Puppeteer 無法啟動，可能是缺少瀏覽器運行時依賴。請檢查 `Dockerfile` 中是否包含了 `chromium` 及相關字體庫的安裝。
*   **時區**: 確保你的執行環境 (例如 Raspberry Pi) 的時區設定正確，以保證 Cron 任務在預期時間執行。
*   **日誌檢查**: 定期檢查日誌文件 (`/var/log/apolloxe_punch.log` 或腳本的控制台輸出)，以確保腳本正常運行。

## 📄 授權

此專案根據 [ISC License](LICENSE) 授權。
