let currentRankingsData = null;
let scheduleOffset = 0;
let revealCount = 0; // 控制公布名次進度 (0-5)
let isGlobalReveal = false; // 是否全域顯示排行 (不使用遮罩)
const ROWS_PER_COL = 9; // 每欄顯示的隊伍數
const itemsToDisplay = ROWS_PER_COL * 2; // 一個畫面總共顯示 18 隊

function initDashboard() {
    fetchRankings();
    
    // 按鈕綁定
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.onclick = fetchRankings;
    
    const toggleRevealBtn = document.getElementById('toggleRevealBtn');
    if (toggleRevealBtn) {
        toggleRevealBtn.onclick = (e) => {
            if (!isGlobalReveal && revealCount > 0) {
                revealCount = 0;
                updateUI();
                return;
            }
            isGlobalReveal = !isGlobalReveal;
            e.target.textContent = isGlobalReveal ? '🔒 隱藏排行' : '👁️ 顯示排行';
            if (!isGlobalReveal) revealCount = 0;
            updateUI();
        };
    }

    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.onclick = () => {
            if (isGlobalReveal) { alert('目前已設定為全域顯示。'); return; }
            if (revealCount < 5) { revealCount++; updateUI(); }
            else { alert('名次已全部公布！'); }
        };
    }

    // 1. 每 30 秒抓取一次新資料 (確保總分同步)
    if (window.fetchInterval) clearInterval(window.fetchInterval);
    window.fetchInterval = setInterval(fetchRankings, 30000);

    // 2. 每 15 秒進行一次名單輪動 (Paging)
    if (window.rotateInterval) clearInterval(window.rotateInterval);
    window.rotateInterval = setInterval(rotateSchedule, 15000);
}

function updateUI() {
    if (currentRankingsData) renderDashboard(currentRankingsData);
}

async function fetchRankings() {
    try {
        const response = await fetch(`${GAS_API_URL}?action=getRankings&t=${Date.now()}`);
        const data = await response.json(); 
        currentRankingsData = data;
        renderDashboard(data);
    } catch (error) {
        console.error('Fetch error:', error);
        const winners = document.getElementById('winnersList');
        if (winners) winners.innerHTML = '<div class="podium-card">無法連線至伺服器</div>';
    }
}

function rotateSchedule() {
    if (!currentRankingsData || !currentRankingsData.fullList) return;
    
    const totalTeams = currentRankingsData.fullList.length;
    // 只有當總隊伍數大於一個畫面可容納的空間 (18 隊) 時才輪動
    if (totalTeams > itemsToDisplay) {
        scheduleOffset += itemsToDisplay;
        if (scheduleOffset >= totalTeams) {
            scheduleOffset = 0;
        }
        renderDashboard(currentRankingsData);
    } else {
        // 如果不足 18 隊，確保 offset 回歸 0
        if (scheduleOffset !== 0) {
            scheduleOffset = 0;
            renderDashboard(currentRankingsData);
        }
    }
}

function renderDashboard(data) {
    const winnersList = document.getElementById('winnersList');
    const scheduleList1 = document.getElementById('scheduleList1');
    const scheduleList2 = document.getElementById('scheduleList2');

    const rankings = data.rankings || [];
    const fullList = data.fullList || [];

    if (winnersList) winnersList.innerHTML = '';
    if (scheduleList1) scheduleList1.innerHTML = '';
    if (scheduleList2) scheduleList2.innerHTML = '';

    if (rankings.length === 0) {
        if (winnersList) winnersList.innerHTML = '<div class="podium-card" style="justify-content:center;">目前尚無評分資料</div>';
        return;
    }

    // 1. 處理前五名 (Winners List)
    const top5 = rankings.slice(0, 5);
    top5.forEach((item, index) => {
        const rank = index + 1;
        const isHidden = !isGlobalReveal && (revealCount < (5 - index));
        const card = document.createElement('div');
        card.className = `podium-card rank-${rank <= 3 ? rank : 'other'} ${isHidden ? 'is-hidden' : ''}`;
        
        let medal = '⭐';
        if (rank === 1) medal = '🥇';
        if (rank === 2) medal = '🥈';
        if (rank === 3) medal = '🥉';

        card.innerHTML = `
            ${isHidden ? '<div class="podium-mask"></div>' : ''}
            <div class="podium-rank">${medal}</div>
            <div class="podium-info">
                <div class="podium-header">
                    <div class="podium-team">${item.teamName}</div>
                    <div class="podium-order">出場序：${item.order}</div>
                </div>
                <div class="podium-members">成員：${item.name || ''}</div>
                ${item.song ? `<div class="podium-song">《${item.song}》</div>` : ''}
            </div>
        `;
        if (winnersList) winnersList.appendChild(card);
    });

    // 2. 處理全體賽程 (分欄顯示)
    const totalTeams = fullList.length;
    if (totalTeams > 0) {
        // 取得當前頁面的隊伍資料
        const pageData = fullList.slice(scheduleOffset, scheduleOffset + itemsToDisplay);
        const col1Data = pageData.slice(0, ROWS_PER_COL);
        const col2Data = pageData.slice(ROWS_PER_COL, itemsToDisplay);
        
        const renderSchedule = (list, container) => {
            if (!container) return;
            list.forEach(item => {
                const row = document.createElement('div');
                row.className = 'schedule-row';
                row.innerHTML = `
                    <div class="s-badge">${item.order || '-'}</div>
                    <div class="s-content">
                        <div class="s-main">
                            <span class="s-team">${item.teamName || '未具名隊伍'}</span>
                            <span class="s-sep">|</span>
                            <span class="s-members">${item.name || ''}</span>
                        </div>
                        <div class="s-song">
                            <span class="s-icon">🎵</span>
                            <span class="s-song-name">《${item.song || '未指定'}》</span>
                        </div>
                    </div>
                `;
                container.appendChild(row);
            });
        };

        renderSchedule(col1Data, scheduleList1);
        renderSchedule(col2Data, scheduleList2);
    }
}
