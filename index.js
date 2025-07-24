const axios = require('axios');
const cron = require('node-cron');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
require('dotenv').config();

// 配置
const config = {
  username: process.env.USERNAME,
  password: process.env.PASSWORD,
  loginPageUrl:
    'https://auth.mayohr.com/HRM/Account/Login?original_target=https%3A%2F%2Fapolloxe.mayohr.com%2Fta%3Fid%3Dwebpunch&lang=undefined',
  excpetionUrl:
    'https://apolloxe.mayohr.com/backend/pt/api/checkinRecords/excpetion',
  reCheckInUrl: 'https://apolloxe.mayohr.com/backend/pt/api/reCheckInApproval',
  companyId: '88730209-d208-481e-a5db-6cce94ff5a43',
  employeeId: '4f372090-37d0-445e-9660-ad859356c831',
};

// 日誌功能
const log = (message) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
};

let cookieString = '';
async function getCookies() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(config.loginPageUrl);

  // 填寫登入資訊
  const userName = 'input[name="userName"]';
  // 關鍵：在輸入前，等待元素出現並可見
  await page.waitForSelector(userName, { visible: true });
  await page.type(userName, config.username);

  const password = 'input[name="password"]';
  // 關鍵：在輸入前，等待元素出現並可見
  await page.waitForSelector(password, { visible: true });
  await page.type(password, config.password);

  // 點擊登入按鈕，使用 ARIA 選擇器，這是更現代且穩健的做法
  const loginSelector = 'aria/登入';
  await page.waitForSelector(loginSelector);
  await page.click(loginSelector);

  // 等待登入完成
  await page.waitForNavigation();
  await new Promise((r) => setTimeout(r, 2000));

  // 獲取所有 cookies
  const cookies = await page.cookies();
  await browser.close();

  return cookies;
}

// cookie 轉字串
const convertCookiesArrayToString = (cookiesArray) => {
  if (!Array.isArray(cookiesArray)) {
    return '';
  }

  return cookiesArray
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
};

// 設置 axios 實例，保持 cookies
const axiosInstance = axios.create({
  withCredentials: true,
  maxRedirects: 5,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

// 抓取需補卡清單
async function extractReCheckInList(startDate, endDate) {
  const data = await getExceptionsData(startDate, endDate);

  if (!data || data.length === 0 || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((record) => {
    const date = record.Date.split('T')[0];
    if (
      !record.Exceptions ||
      !Array.isArray(record.Exceptions) ||
      record.Exceptions.length === 0
    ) {
      return [];
    }

    // 為每個異常建立一個新的物件
    return record.Exceptions.map((exception) => ({
      date,
      ExceptionId: exception.ExceptionId,
    }));
  });
}

async function getExceptionsData(startDate, endDate) {
  try {
    const response = await axiosInstance.get(config.excpetionUrl, {
      params: {
        exceptionIds: '',
        companyId: '',
        employeeId: '',
        startDate,
        endDate,
        isNoAppliedForm: true,
      },
      headers: {
        // Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        Cookie: cookieString,
      },
    });

    return response.data.Data;
  } catch (error) {
    const errorMessage = error.response
      ? `狀態碼: ${error.response.status}, 錯誤: ${JSON.stringify(
          error.response.data
        )}`
      : error.message;

    log(`抓取異常紀錄錯誤: ${errorMessage}`);
  }
}

// 提交補卡申請
async function submitReCheckIn(dateTime, type, reason) {
  try {
    // 準備補卡資料
    const reCheckInData = {
      AttendanceOn: dateTime,
      AttendanceType: type,
      IsBehalf: false,
      LocationDetails: 'location',
      PunchesLocationId: '00000000-0000-0000-0000-000000000000',
      ReasonsForMissedClocking: reason,
    };

    log(`正在提交補卡申請: ${dateTime} ${type == 1 ? '上班' : '下班'}`);

    const response = await axiosInstance.post(
      config.reCheckInUrl,
      reCheckInData,
      {
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieString,
        },
      }
    );

    log(`補卡申請成功: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    const errorMessage = error.response
      ? `狀態碼: ${error.response.status}, 錯誤: ${JSON.stringify(
          error.response.data
        )}`
      : error.message;

    log(`補卡申請失敗: ${errorMessage}`);

    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      log('認證失敗，嘗試重新登入...');
    }
    return false; // 返回 false 表示失敗
  }
}

// 執行補卡程序
async function executeReCheckIn(exceptionList) {
  let successfulSubmissions = 0;
  try {
    // 上班時間
    // const startTime = '2025-06-02T01:30:00+00:00'; 9:30
    // 下班時間
    // const endTime = '2025-06-02T10:00:00+00:00'; 18:00

    for (const exception of exceptionList) {
      if (exception.ExceptionId === 'NoCheckIn') {
        const dateTime = exception.date + 'T01:30:00+00:00';
        const success = await submitReCheckIn(dateTime, 1, '忘記打卡');
        if (success) {
          successfulSubmissions++;
        }
      }

      if (exception.ExceptionId === 'NoCheckOut') {
        const dateTime = exception.date + 'T10:00:00+00:00';
        const success = await submitReCheckIn(dateTime, 2, '忘記打卡');
        if (success) {
          successfulSubmissions++;
        }
      }

      await new Promise((r) => setTimeout(r, 3000)); // 增加延遲以避免頻率偵測
    }
    return successfulSubmissions; // 返回成功提交的數量
  } catch (error) {
    log(`執行補卡程序失敗: ${error.message}`);
    return successfulSubmissions; // 即使失敗也返回目前成功提交的數量
  }
}

/**
 * 將日期物件格式化為 YYYY-MM-DD 字串
 * @param {Date} date - 日期物件
 * @returns {string} 格式化後的日期字串
 */
function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 獲取一個月前的日期 (YYYY-MM-DD 格式)
 * @returns {string} 一個月前的日期字串
 */
function getOneMonthAgoDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return getFormattedDate(date);
}

/**
 * 驗證日期字串是否為有效的 YYYY-MM-DD 格式
 * @param {string} dateString - 日期字串
 * @returns {boolean} 如果是有效日期則為 true，否則為 false
 */
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  const date = new Date(dateString);
  return date.toISOString().slice(0, 10) === dateString;
}

// 啟動程序
async function main() {
  try {
    log('自動補卡服務啟動中...');

    let startDate;
    let endDate;

    // 檢查命令列參數
    const args = process.argv.slice(2); // 獲取除了 node 和 index.js 之外的參數

    if (args.length === 2 && isValidDate(args[0]) && isValidDate(args[1])) {
      startDate = args[0];
      endDate = args[1];
      log(`使用自訂日期區間: ${startDate} 到 ${endDate}`);
    } else {
      endDate = getFormattedDate(new Date()); // 今天
      startDate = getOneMonthAgoDate(); // 一個月前
      log(`使用預設日期區間 (一個月前到今天): ${startDate} 到 ${endDate}`);
      if (args.length > 0) {
        log(
          '無效的日期參數。請使用 YYYY-MM-DD 格式，例如: node index.js 2023-01-01 2023-01-31'
        );
      }
    }

    log('正在獲取登入 Cookie...');
    const cookie = await getCookies();
    cookieString = convertCookiesArrayToString(cookie);
    log('成功獲取登入 Cookie。');

    log('正在抓取需補卡清單...');
    const reCheckInList = await extractReCheckInList(startDate, endDate);

    log(`需補卡清單共 ${reCheckInList.length} 筆。`);
    if (reCheckInList.length > 0) {
      log('詳細需補卡清單: ' + JSON.stringify(reCheckInList));
    } else {
      log('沒有需要補卡的項目。');
    }

    let completedReCheckIns = 0;
    if (reCheckInList.length > 0) {
      log('開始執行補卡程序...');
      completedReCheckIns = await executeReCheckIn(reCheckInList);
      log('補卡程序執行完畢。');
    }

    log(`
--- 補卡程序總結 ---
需補卡清單總數: ${reCheckInList.length} 筆
已完成補卡申請: ${completedReCheckIns} 筆
--------------------`);

    // 設置排程
    // setupSchedule();
  } catch (error) {
    log(`啟動服務失敗: ${error.message}`);
  }
}

main();
