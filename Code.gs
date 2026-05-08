function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 建立評審名單工作表 (包含密碼)
  let judgeSheet = ss.getSheetByName('Judges');
  if (!judgeSheet) {
    judgeSheet = ss.insertSheet('Judges');
    judgeSheet.appendRow(['評審姓名', '密碼']);
    // 請在試算表中自行填寫評審姓名與密碼
  }
  
  // 建立設定工作表
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('Settings');
    settingsSheet.appendRow(['項目名稱', '權重', '單項總分']);
    settingsSheet.appendRow(['唱功', 1.0, 100]);
    settingsSheet.appendRow(['演奏', 0.8, 100]);
    settingsSheet.appendRow(['台風', 1.2, 100]);
    settingsSheet.appendRow(['整體表現', 1.0, 100]);
  }
  
  // 建立系統配置工作表
  let configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    configSheet = ss.insertSheet('Config');
    configSheet.appendRow(['設定項目', '值']);
    configSheet.appendRow(['報名截止時間', '2026-12-31 23:59']);
    configSheet.appendRow(['顯示 4 名後分數', 'FALSE']);
  }
  
  // 建立學生資料工作表 (加入出場序)
  let studentSheet = ss.getSheetByName('Students');
  if (!studentSheet) {
    studentSheet = ss.insertSheet('Students');
    studentSheet.appendRow(['報名序號', '出場序', '班級', '座號', '姓名', '隊伍名稱', '曲目', '報名時間']);
    // 請在試算表中自行填寫參賽隊伍資料
  }
  
  // 建立計分工作表
  let scoreSheet = ss.getSheetByName('Scores');
  if (!scoreSheet) {
    scoreSheet = ss.insertSheet('Scores');
    scoreSheet.appendRow(['時間戳記', '評審名稱', '隊伍名稱', '唱功', '演奏', '台風', '整體表現', '總分']);
  }
  
  SpreadsheetApp.getUi().alert('✅ 系統資料架構已建立完成！請確認下方四個工作表。');
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getInitialData' || action === 'getAdminData') {
    const judges = getSheetData('Judges').map(j => ({ '評審姓名': j['評審姓名'] }));
    const data = getRankingsData();
    return ContentService.createTextOutput(JSON.stringify({
      judges: judges,
      students: data.fullList, 
      settings: getSheetData('Settings'),
      adminData: data.adminData // 詳細的報名管理資料
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'login') {
    const judgeName = e.parameter.username;
    const password = e.parameter.password;
    const judges = getSheetData('Judges');
    const user = judges.find(j => j['評審姓名'] === judgeName && String(j['密碼']) === password);
    return ContentService.createTextOutput(JSON.stringify({
      success: !!user,
      name: user ? user['評審姓名'] : null
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getMyScores') {
    const judgeName = e.parameter.judgeName;
    const allScores = getSheetData('Scores');
    const myScores = allScores.filter(s => s['評審名稱'] === judgeName);
    return ContentService.createTextOutput(JSON.stringify(myScores))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getRankings') {
    return ContentService.createTextOutput(JSON.stringify(getRankingsData()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getRegistrationStatus') {
    const config = getSheetData('Config');
    const deadlineStr = config.find(c => c['設定項目'] === '報名截止時間')?.['值'] || '';
    const now = new Date();
    const deadline = new Date(deadlineStr);
    const isOpen = deadlineStr ? (now < deadline) : true;
    
    // 獲取簡略的報名名單供確認
    const students = getSheetData('Students').map(s => ({
      class: s['班級'],
      name: s['姓名'],
      teamName: s['隊伍名稱'],
      song: s['曲目'],
      regId: s['報名序號']
    }));
    
    return ContentService.createTextOutput(JSON.stringify({
      isOpen: isOpen,
      deadline: deadlineStr,
      registrations: students
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid Action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'register') {
      const config = getSheetData('Config');
      const deadlineStr = config.find(c => c['設定項目'] === '報名截止時間')?.['值'] || '';
      if (deadlineStr && new Date() > new Date(deadlineStr)) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '報名已截止' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
      const studentData = getSheetData('Students');
      
      // 產生新的報名序號 (取最大值 + 1)
      let regId = 1;
      if (studentData.length > 0) {
        const ids = studentData.map(s => parseInt(s['報名序號'])).filter(id => !isNaN(id));
        if (ids.length > 0) {
          regId = Math.max(...ids) + 1;
        }
      }
      
      const timestamp = new Date();
      
      // 每一位成員寫入獨立的一行
      data.members.forEach(member => {
        studentSheet.appendRow([
          regId,
          '', // 出場序先留白
          member.class,
          member.seat,
          member.name,
          data.teamName,
          data.song,
          timestamp
        ]);
      });

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', regId: regId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'submitScore') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Scores');
      const settings = getSheetData('Settings');
      const weightMap = {};
      settings.forEach(row => { weightMap[String(row['項目名稱']).trim()] = parseFloat(row['權重']); });
      
      const inputJudge = String(data.judgeName || '').trim();
      const inputTeam = String(data.teamName || '').trim();
      
      // 動態計算總分 (根據傳入的 scores 物件與 Settings 中的權重)
      let totalScore = 0;
      const scoreValues = data.scores || {};
      settings.forEach(s => {
        const name = String(s['項目名稱']).trim();
        const score = parseFloat(scoreValues[name]) || 0;
        const weight = weightMap[name] || 1;
        totalScore += score * weight;
      });

      const allData = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      // 檢查是否已存在相同評審對相同隊伍的評分
      for (let i = 1; i < allData.length; i++) {
        const existingJudge = String(allData[i][1] || '').trim();
        const existingTeam = String(allData[i][2] || '').trim();
        if (existingJudge === inputJudge && existingTeam === inputTeam) {
          rowIndex = i + 1;
          break;
        }
      }

      // 準備寫入的資料行 (時間, 評審, 隊伍, 各項分數..., 總分)
      const rowData = [new Date(), inputJudge, inputTeam];
      settings.forEach(s => {
        const name = String(s['項目名稱']).trim();
        rowData.push(parseFloat(scoreValues[name]) || 0);
      });
      rowData.push(totalScore);

      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', calculatedTotal: totalScore }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'updateOrders') {
      const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
      const studentData = studentSheet.getDataRange().getValues();
      const headers = studentData[0];
      const colIdIdx = headers.indexOf('報名序號');
      const colOrderIdx = headers.indexOf('出場序');

      if (colIdIdx === -1 || colOrderIdx === -1) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '找不到必要欄位' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const orderMap = data.orders; // { regId: order }
      const updates = [];
      
      for (let i = 1; i < studentData.length; i++) {
        const regId = String(studentData[i][colIdIdx]);
        if (orderMap[regId] !== undefined) {
          studentSheet.getRange(i + 1, colOrderIdx + 1).setValue(orderMap[regId]);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      const cleanHeader = String(header).trim();
      obj[cleanHeader] = row[index] !== undefined ? row[index] : '';
    });
    return obj;
  });
}

function getRankingsData() {
  const scores = getSheetData('Scores');
  const judges = getSheetData('Judges').map(j => j['評審姓名']).filter(name => name && String(name).trim() !== '');
  const students = getSheetData('Students');
  
  if (students.length === 0) return { judges, rankings: [], fullList: [], showOthersScore: false };

  // 動態尋找欄位索引 (容錯處理)
  const keys = Object.keys(students[0]);
  const findKey = (variants) => keys.find(k => variants.some(v => k.includes(v))) || '';
  
  const colId = findKey(['報名序', 'ID', '序號']);
  const colOrder = findKey(['出場序', '次序']);
  const colTeam = findKey(['隊伍', '隊名']);
  const colName = findKey(['姓名', '人員']);
  const colSong = findKey(['曲目', '歌名']);
  const colClass = findKey(['班級']);

  // 建立隊伍基礎資料對照
  const teamMap = {}; 
  students.forEach(s => {
    const id = s[colId];
    if (id === undefined || id === null || id === '') return;
    
    const teamName = String(s[colTeam] || '未具名隊伍').trim();
    const groupKey = id + '_' + teamName; // 複合鍵防止 ID 重複

    if (!teamMap[groupKey]) {
      teamMap[groupKey] = {
        order: String(s[colOrder] || '-').trim(),
        teamName: teamName,
        songs: new Set(),
        classes: new Set(),
        names: []
      };
    }
    if (s[colSong]) teamMap[groupKey].songs.add(String(s[colSong]).trim());
    if (s[colClass]) teamMap[groupKey].classes.add(String(s[colClass]).trim());
    if (s[colName]) teamMap[groupKey].names.push(String(s[colName]).trim());
    // 確保出場序有值
    if (s[colOrder] && s[colOrder] !== '-') teamMap[groupKey].order = String(s[colOrder]).trim();
  });

  // 轉換為以「隊伍名稱」為對應鍵的資訊表
  const teamInfo = {};
  Object.keys(teamMap).forEach(key => {
    const t = teamMap[key];
    teamInfo[t.teamName] = {
      '隊伍名稱': t.teamName,
      '出場序': t.order || '-',
      '曲目': Array.from(t.songs).join(' / '),
      '班級': Array.from(t.classes).join('、'),
      '姓名': t.names.join('、'),
      '報名序號': key.split('_')[0]
    };
  });

  // 額外整理一份 adminData 給管理頁面，包含成員細節
  const adminDataMap = {};
  students.forEach(s => {
    const regId = String(s[colId] || '');
    if (!regId) return;
    if (!adminDataMap[regId]) {
      adminDataMap[regId] = {
        regId: regId,
        order: s[colOrder] || '',
        teamName: s[colTeam] || '',
        song: s[colSong] || '',
        members: []
      };
    }
    adminDataMap[regId].members.push({
      class: s[colClass] || '',
      seat: s[findKey(['座號'])] || '',
      name: s[colName] || ''
    });
  });
  const adminData = Object.values(adminDataMap).sort((a, b) => {
    const orderA = parseInt(a.order) || 999;
    const orderB = parseInt(b.order) || 999;
    return orderA - orderB || parseInt(a.regId) - parseInt(b.regId);
  });

  const totalJudgeCount = judges.length || 1;

  const summary = {};
  scores.forEach(row => {
    const team = String(row['隊伍名稱'] || row['隊名'] || '').trim();
    if (!team) return;
    const judge = String(row['評審名稱'] || row['評審姓名'] || '').trim();
    const total = parseFloat(row['總分']) || 0;
    
    if (!summary[team]) {
      const info = teamInfo[team] || {};
      summary[team] = {
        teamName: team,
        order: info['出場序'] || '-',
        song: info['曲目'] || '',
        regId: info['報名序號'] || '-',
        name: info['姓名'] || '',
        judgeScores: {},
        totalSum: 0,
        count: 0
      };
    }
    summary[team].judgeScores[judge] = total;
    summary[team].totalSum += total;
    summary[team].count += 1;
  });

  const results = Object.values(summary).map(item => {
    // 依據使用者要求：平均分數應該是除以「總評審人數」
    const avg = item.totalSum / totalJudgeCount;
    item.average = Math.round(avg * 10) / 10;
    item.totalSum = Math.round(item.totalSum * 10) / 10;
    return item;
  });

  // 依平均分排序 (由高到低)
  results.sort((a, b) => b.average - a.average);

  const config = getSheetData('Config');
  const showOthersScore = config.find(c => c['設定項目'] === '顯示 4 名後分數')?.['值'] === 'TRUE';

  // 準備全體隊伍清單 (確保 Key 與前端 dashboard.js 絕對對應)
  const fullList = Object.values(teamInfo).map(t => {
    return {
      order: t['出場序'] || '-',
      teamName: t['隊伍名稱'] || '未具名隊伍',
      name: t['姓名'] || '',
      song: t['曲目'] || '未指定',
      regId: t['報名序號'] || '-',
      class: t['班級'] || ''
    };
  }).sort((a, b) => {
    const orderA = parseInt(a.order) || 999;
    const orderB = parseInt(b.order) || 999;
    return orderA - orderB;
  });

  return {
    judges: judges,
    rankings: results,
    fullList: fullList,
    adminData: adminData,
    showOthersScore: showOthersScore
  };
}
