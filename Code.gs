function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 建立評審名單工作表
  let judgeSheet = ss.getSheetByName('Judges');
  if (!judgeSheet) {
    judgeSheet = ss.insertSheet('Judges');
    judgeSheet.appendRow(['評審姓名', '密碼']);
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
    // 設定 B2 (報名截止時間的值) 為日期時間格式
    configSheet.getRange("B2").setNumberFormat("yyyy/MM/dd HH:mm");
  }
  
  // 建立學生資料工作表
  let studentSheet = ss.getSheetByName('Students');
  if (!studentSheet) {
    studentSheet = ss.insertSheet('Students');
    studentSheet.appendRow(['報名序號', '出場序', '班級', '座號', '姓名', '隊伍名稱', '曲目', '報名時間', '影片連結']);
  }
  // 設定時間格式 (Column H / 8)
  studentSheet.getRange("H:H").setNumberFormat("yyyy/M/d am/pm h:mm:ss");
  
  // 建立計分工作表
  let scoreSheet = ss.getSheetByName('Scores');
  if (!scoreSheet) {
    scoreSheet = ss.insertSheet('Scores');
    scoreSheet.appendRow(['時間戳記', '評審名稱', '隊伍名稱', '唱功', '演奏', '台風', '整體表現', '總分']);
  }
  // 設定時間格式 (Column A / 1)
  scoreSheet.getRange("A:A").setNumberFormat("yyyy/M/d am/pm h:mm:ss");
  
  SpreadsheetApp.getUi().alert('✅ 系統資料架構已建立完成！');
}

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getInitialData' || action === 'getAdminData') {
    const judges = getSheetData('Judges').map(j => ({ '評審姓名': j['評審姓名'] }));
    const data = getRankingsData();
    return ContentService.createTextOutput(JSON.stringify({
      judges: judges,
      students: data.fullList || [], 
      settings: getSheetData('Settings'),
      adminData: data.adminData || []
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
    
    // 解析截止時間
    let deadline = (deadlineStr instanceof Date) ? deadlineStr : new Date(deadlineStr);
    
    // 處理中文日期格式解析問題 (例如 "下午 23:59")
    if (deadlineStr && isNaN(deadline.getTime()) && typeof deadlineStr === 'string') {
      const sanitized = deadlineStr.replace('下午', 'PM').replace('上午', 'AM');
      deadline = new Date(sanitized);
    }
    
    // 只有在解析成功的情況下才進行比較，否則預設為開放
    const isOpen = (deadlineStr && !isNaN(deadline.getTime())) ? (now < deadline) : true;
    
    // 格式化截止時間顯示
    let displayDeadline = deadlineStr;
    if (!isNaN(deadline.getTime())) {
      displayDeadline = Utilities.formatDate(deadline, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    }

    const students = getSheetData('Students').map(s => ({
      class: s['班級'],
      name: s['姓名'],
      teamName: s['隊伍名稱'],
      song: s['曲目'],
      regId: s['報名序號']
    }));
    return ContentService.createTextOutput(JSON.stringify({
      isOpen: isOpen,
      deadline: displayDeadline,
      registrations: students
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'checkStudentDetails') {
    const studentData = getSheetData('Students');
    const cls = String(e.parameter.class).trim();
    const seat = String(e.parameter.seat).trim();
    const name = String(e.parameter.name).trim();
    const record = studentData.find(s => String(s['班級']).trim() === cls && String(s['座號']).trim() === seat && String(s['姓名']).trim() === name);
    if (record) {
      const regId = record['報名序號'];
      const teamMembers = studentData.filter(s => s['報名序號'] === regId);
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'found',
        regId: regId,
        teamName: record['隊伍名稱'],
        song: record['曲目'],
        videoUrl: record['影片連結'] || '',
        members: teamMembers.map(m => ({ class: m['班級'], seat: m['座號'], name: m['姓名'] }))
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'not_found' })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'findRegistration') {
    const studentData = getSheetData('Students');
    const regId = String(e.parameter.regId);
    const memberName = String(e.parameter.name).trim();
    const record = studentData.find(s => String(s['報名序號']) === regId && String(s['姓名']).trim() === memberName);
    if (record) {
      const allMembers = studentData.filter(s => String(s['報名序號']) === regId);
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        regId: regId,
        teamName: record['隊伍名稱'],
        song: record['曲目'],
        videoUrl: record['影片連結'] || '',
        members: allMembers.map(m => ({ class: m['班級'], seat: m['座號'], name: m['姓名'] }))
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '找不到報名資料或姓名不符' })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid Action' })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'register') {
      const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
      const timestamp = new Date();
      const studentData = getSheetData('Students');
      let regId;
      let existingOrder = '';
      if (data.overwriteRegId) {
        regId = data.overwriteRegId;
        const oldRecord = studentData.find(s => String(s['報名序號']) === String(regId));
        if (oldRecord) existingOrder = oldRecord['出場序'];
        const values = studentSheet.getDataRange().getValues();
        const colIdIdx = values[0].indexOf('報名序號');
        for (let i = values.length - 1; i >= 1; i--) {
          if (String(values[i][colIdIdx]) === String(regId)) {
            studentSheet.deleteRow(i + 1);
          }
        }
      } else {
        regId = studentData.length > 0 ? Math.max(...studentData.map(s => s['報名序號'] || 0)) + 1 : 1;
      }
      const videoLink = String(data.videoUrl || "").trim();
      data.members.forEach(member => {
        const lastRow = studentSheet.getLastRow() + 1;
        studentSheet.getRange(lastRow, 1, 1, 9).setValues([[regId, existingOrder, member.class, member.seat, member.name, data.teamName, data.song, timestamp, videoLink]]);
        // 強制設定時間格式
        studentSheet.getRange(lastRow, 8).setNumberFormat("yyyy/M/d am/pm h:mm:ss");
      });
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', regId: regId })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === 'submitScore') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Scores');
      const settings = getSheetData('Settings');
      const weightMap = {};
      settings.forEach(row => { weightMap[String(row['項目名稱']).trim()] = parseFloat(row['權重']); });
      const inputJudge = String(data.judgeName || '').trim();
      const inputTeam = String(data.teamName || '').trim();
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
      for (let i = 1; i < allData.length; i++) {
        if (String(allData[i][1] || '').trim() === inputJudge && String(allData[i][2] || '').trim() === inputTeam) {
          rowIndex = i + 1;
          break;
        }
      }
      const rowData = [new Date(), inputJudge, inputTeam];
      settings.forEach(s => { rowData.push(parseFloat(scoreValues[String(s['項目名稱']).trim()]) || 0); });
      rowData.push(totalScore);
      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
        rowIndex = sheet.getLastRow();
      }
      // 強制設定時間格式
      sheet.getRange(rowIndex, 1).setNumberFormat("yyyy/M/d am/pm h:mm:ss");
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === 'updateOrders') {
      const studentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
      const studentData = studentSheet.getDataRange().getValues();
      const colIdIdx = studentData[0].indexOf('報名序號');
      const colOrderIdx = studentData[0].indexOf('出場序');
      const orderMap = data.orders;
      for (let i = 1; i < studentData.length; i++) {
        const regId = String(studentData[i][colIdIdx]);
        if (orderMap[regId] !== undefined) {
          studentSheet.getRange(i + 1, colOrderIdx + 1).setValue(orderMap[regId]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
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
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => { obj[String(header).trim()] = row[index] !== undefined ? row[index] : ''; });
    return obj;
  });
}

function getRankingsData() {
  const scores = getSheetData('Scores');
  const judges = getSheetData('Judges').map(j => j['評審姓名']).filter(name => name && String(name).trim() !== '');
  const students = getSheetData('Students');
  
  if (students.length === 0) return { judges, rankings: [], fullList: [], adminData: [], showOthersScore: false };

  const keys = Object.keys(students[0]);
  const findKey = (variants) => keys.find(k => variants.some(v => k.includes(v))) || '';
  const colId = findKey(['報名序', 'ID', '序號']);
  const colOrder = findKey(['出場序', '次序']);
  const colTeam = findKey(['隊伍', '隊名']);
  const colName = findKey(['姓名', '人員']);
  const colSong = findKey(['曲目', '歌名']);
  const colClass = findKey(['班級']);

  const teamInfo = {};
  const adminDataMap = {};
  
  students.forEach(s => {
    const id = String(s[colId] || '');
    if (!id) return;
    const teamName = String(s[colTeam] || '未具名隊伍').trim();
    if (!teamInfo[teamName]) {
      teamInfo[teamName] = { '隊伍名稱': teamName, '出場序': s[colOrder] || '-', '曲目': s[colSong] || '', '姓名': [], '報名序號': id };
    }
    teamInfo[teamName].姓名.push(String(s[colName] || '').trim());
    
    if (!adminDataMap[id]) {
      adminDataMap[id] = { regId: id, order: s[colOrder] || '', teamName: teamName, song: s[colSong] || '', videoUrl: s['影片連結'] || '', members: [] };
    }
    adminDataMap[id].members.push({ class: s[colClass] || '', seat: s[findKey(['座號'])] || '', name: s[colName] || '' });
  });

  const totalJudgeCount = Math.max(judges.length, 1);
  const summary = {};
  scores.forEach(row => {
    const team = String(row['隊伍名稱'] || row['隊名'] || '').trim();
    const judge = String(row['評審名稱'] || '').trim();
    const score = parseFloat(row['總分']) || 0;
    
    if (!team) return;
    if (!summary[team]) {
      const info = teamInfo[team] || {};
      summary[team] = { 
        teamName: team, 
        order: info['出場序'] || '-', 
        song: info['曲目'] || '', 
        name: (info['姓名'] || []).join('、'), 
        totalSum: 0,
        judgeScores: {}
      };
    }
    summary[team].totalSum += score;
    if (judge) {
      summary[team].judgeScores[judge] = score;
    }
  });

  const rankings = Object.values(summary).map(item => {
    item.average = Math.round((item.totalSum / totalJudgeCount) * 10) / 10;
    return item;
  }).sort((a, b) => b.average - a.average);

  const fullList = Object.values(teamInfo).map(t => ({
    order: t['出場序'] || '-', teamName: t['隊伍名稱'], name: t['姓名'].join('、'), song: t['曲目'], regId: t['報名序號']
  })).sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999));

  const config = getSheetData('Config');
  const showOthersScore = config.find(c => c['設定項目'] === '顯示 4 名後分數')?.['值'] === 'TRUE';

  return { judges, rankings, fullList, adminData: Object.values(adminDataMap), showOthersScore };
}
