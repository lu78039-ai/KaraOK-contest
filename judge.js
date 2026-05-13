let currentSettings = [];
let allStudents = [];
let loggedInJudge = null;
let currentTeam = null;
let currentTeamObj = null;

function initJudge() {
    checkLogin();
    setupCoreEvents();
}

// Remove the automatic listener as it will be handled by the SPA router
// document.addEventListener('DOMContentLoaded', () => { ... });

async function checkLogin() {
    const savedJudge = localStorage.getItem('karaoke_judge');
    if (savedJudge) {
        loggedInJudge = savedJudge;
        await showApp();
    } else {
        await showLogin();
    }
}

async function showLogin() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('judgeApp').classList.add('hidden');
    try {
        const response = await fetch(`${GAS_API_URL}?action=getInitialData`);
        const data = await response.json();
        populateJudgeLoginSelect(data.judges);
    } catch (e) {
        showToast("無法載入評審名單", true);
    }
}

function populateJudgeLoginSelect(judges) {
    const select = document.getElementById('username');
    select.innerHTML = '<option value="">請選擇您的姓名</option>';
    if (!judges) return;
    judges.forEach(j => {
        const option = document.createElement('option');
        option.value = j['評審姓名'];
        option.textContent = j['評審姓名'];
        select.appendChild(option);
    });
}

async function showApp() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('judgeApp').classList.remove('hidden');
    document.getElementById('currentJudgeDisplay').textContent = `評審：${loggedInJudge}`;
    await loadInitialData();
    switchView('teamList');
}

async function loadInitialData() {
    try {
        const response = await fetch(`${GAS_API_URL}?action=getInitialData`);
        const data = await response.json();
        allStudents = data.students;
        currentSettings = data.settings;
        renderTeamList();
    } catch (error) {
        showToast("資料載入失敗", true);
    }
}

function setupCoreEvents() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        try {
            const url = `${GAS_API_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.success) {
                loggedInJudge = result.name;
                localStorage.setItem('karaoke_judge', loggedInJudge);
                showApp();
            } else {
                showToast("姓名或密碼錯誤", true);
            }
        } catch (e) {
            showToast("登入失敗", true);
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('karaoke_judge');
        location.reload();
    });

    document.getElementById('backToTeams').addEventListener('click', () => {
        switchView('teamList');
    });

    document.getElementById('scoreForm').addEventListener('submit', handleScoreSubmit);
    
    document.getElementById('scoringQuickJump').addEventListener('change', (e) => {
        const teamName = e.target.value;
        if (!teamName) return;
        const stu = allStudents.find(s => s.teamName === teamName);
        if (stu) startScoring(stu);
    });
}

function switchView(viewName) {
    const teamListView = document.getElementById('teamListView');
    const scoringView = document.getElementById('scoringView');
    
    teamListView.classList.toggle('hidden', viewName !== 'teamList');
    scoringView.classList.toggle('hidden', viewName !== 'scoring');
    
    // 處理導覽選單顯示
    const scoringQuickJump = document.getElementById('scoringQuickJump');
    const judgeHeaderInfo = document.getElementById('judgeHeaderInfo');
    
    if (viewName === 'teamList') {
        scoringQuickJump.classList.add('hidden');
        document.getElementById('viewTitle').textContent = '今日比賽隊伍';
        renderTeamList();
    } else if (viewName === 'scoring') {
        scoringQuickJump.classList.remove('hidden');
        
        const order = currentTeamObj ? `[出場序 ${currentTeamObj.order}] ` : '';
        const song = currentTeamObj?.song ? ` - 《${currentTeamObj.song}》` : '';
        document.getElementById('viewTitle').textContent = `${order}${currentTeam}${song}`;
    }
    
    // 確保評審資訊始終顯示
    judgeHeaderInfo.classList.remove('hidden');
    
    document.getElementById('backToTeams').classList.toggle('hidden', viewName !== 'scoring');
}

async function renderTeamList() {
    const header = document.getElementById('teamListHeader');
    const body = document.getElementById('teamListBody');
    const scoreJumpSelect = document.getElementById('scoringQuickJump');
    
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;">載入中...</td></tr>';
    
    try {
        const res = await fetch(`${GAS_API_URL}?action=getMyScores&judgeName=${encodeURIComponent(loggedInJudge)}`);
        const scoredData = await res.json();
        
        // Header
        header.innerHTML = '<th>出場序 / 隊伍</th>';
        currentSettings.forEach(s => {
            const th = document.createElement('th');
            th.textContent = s['項目名稱'] || s['項目'];
            th.style.textAlign = 'center';
            header.appendChild(th);
        });
        header.innerHTML += '<th style="text-align:center;">總分</th><th style="text-align:center;">操作</th>';

        // Sorting
        allStudents.sort((a, b) => (parseInt(a.order) || 0) - (parseInt(b.order) || 0));

        // Jump Selects
        scoreJumpSelect.innerHTML = '<option value="">切換隊伍...</option>';
        body.innerHTML = '';
        
        allStudents.forEach(stu => {
            const teamName = stu.teamName;
            const scoreRecord = scoredData.find(s => s['隊伍名稱'] === teamName);
            
            // Populate Jump Select
            const opt2 = document.createElement('option');
            opt2.value = teamName;
            opt2.textContent = `NO.${stu.order} ${teamName}`;
            scoreJumpSelect.appendChild(opt2);
 
            const tr = document.createElement('tr');
            if (scoreRecord) tr.classList.add('scored-row');
            
            let html = `
                <td style="width:25%; vertical-align:top;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                        <span style="background:var(--primary-color); color:white; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:800;">${stu.order || '-'}</span>
                        <span style="font-size:1.1rem; font-weight:900; color:white;">${teamName}</span>
                        <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal;">| ${stu.name}</span>
                    </div>
                    <div style="font-size:0.95rem; color:var(--secondary-color); font-weight:700;">
                        🎵 《${stu.song || '未填寫'}》
                    </div>
                </td>
            `;

            currentSettings.forEach(s => {
                const name = s['項目名稱'] || s['項目'];
                let val = scoreRecord ? scoreRecord[name] : '-';
                if (typeof val === 'number') val = val.toFixed(1);
                html += `<td style="text-align:center;">${val}</td>`;
            });

            const total = scoreRecord ? parseFloat(scoreRecord['總分']).toFixed(1) : '-';
            const statusText = scoreRecord ? '修改' : '評分';
            
            html += `
                <td style="text-align:center; font-weight:800; color:var(--success-color);">${total}</td>
                <td style="text-align:center;">
                    <button class="nav-btn" style="padding:8px 12px; width:auto;" onclick='startScoring(${JSON.stringify(stu)}, ${scoreRecord ? JSON.stringify(scoreRecord) : 'null'})'>
                        ${statusText}
                    </button>
                </td>
            `;
            tr.innerHTML = html;
            body.appendChild(tr);
        });
    } catch (e) {
        body.innerHTML = '<tr><td colspan="10">讀取失敗</td></tr>';
    }
}

function startScoring(stu, existingData = null) {
    currentTeam = stu.teamName;
    currentTeamObj = stu;
    switchView('scoring');
    
    // 同步下拉選單
    document.getElementById('scoringQuickJump').value = currentTeam;
    
    buildCriteriaGrid(currentSettings, existingData);
}

function buildCriteriaGrid(settings, existingData) {
    const grid = document.getElementById('criteriaGrid');
    grid.innerHTML = '';
    
    // 根據項目數量自動分配佈局類別 (iPad 優化)
    grid.className = 'criteria-grid';
    const count = settings.length;
    if (count <= 2) {
        grid.classList.add('grid-2x1');
    } else if (count <= 4) {
        grid.classList.add('grid-2x2');
    } else {
        grid.classList.add('grid-3x2');
    }

    settings.forEach(setting => {
        const name = setting['項目名稱'] || setting['項目'];
        const weight = setting['權重'] || 1;
        const maxScore = setting['單項總分'] || 100;
        if(!name) return;

        const idMap = { '唱功': 'vocal', '演奏': 'instrument', '台風': 'stage', '整體表現': 'overall' };
        const id = idMap[name] || name;
        const val = existingData ? (existingData[name] || 0) : Math.round(maxScore * 0.8);

        const card = document.createElement('div');
        card.className = 'criteria-card';
        card.innerHTML = `
            <h4>${name} <span class="weight-badge">權重 x${weight}</span></h4>
            <input type="range" id="${id}" name="${id}" min="0" max="${maxScore}" value="${val}" step="0.1" data-weight="${weight}">
            <div class="score-display">${val} <span style="font-size:0.9rem; color:var(--text-muted);">/ ${maxScore}</span></div>
        `;
        grid.appendChild(card);

        const slider = card.querySelector('input[type="range"]');
        const display = card.querySelector('.score-display');
        
        const updateSliderProgress = (s) => {
            const percent = (s.value - s.min) / (s.max - s.min) * 100;
            s.style.background = `linear-gradient(to right, #6C8ED9 ${percent}%, #3B4048 ${percent}%)`;
        };

        slider.addEventListener('input', (e) => {
            display.innerHTML = `${e.target.value} <span>/ ${maxScore}</span>`;
            updateSliderProgress(e.target);
            calculatePreviewTotal();
        });
        
        // 初始化進度條顏色
        updateSliderProgress(slider);
    });
    calculatePreviewTotal();
}

function calculatePreviewTotal() {
    const sliders = document.querySelectorAll('.criteria-card input[type="range"]');
    let total = 0;
    sliders.forEach(slider => {
        total += parseFloat(slider.value) * parseFloat(slider.dataset.weight);
    });
    document.getElementById('previewTotal').textContent = total.toFixed(1);
}

async function handleScoreSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    const scores = {};
    currentSettings.forEach(s => {
        const name = s['項目名稱'] || s['項目'];
        const idMap = { '唱功': 'vocal', '演奏': 'instrument', '台風': 'stage', '整體表現': 'overall' };
        const id = idMap[name] || name;
        scores[name] = document.getElementById(id)?.value || 0;
    });

    const payload = {
        action: 'submitScore',
        judgeName: loggedInJudge,
        teamName: currentTeam,
        scores: scores
    };

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast("成績已儲存");
            switchView('teamList');
        }
    } catch (error) {
        showToast("儲存失敗", true);
    } finally {
        btn.disabled = false;
        btn.textContent = '送出評分';
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => toast.className = 'toast', 3000);
}
