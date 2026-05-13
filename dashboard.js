let currentRankingsData = null;
let scheduleOffset = 0;
let revealCount = 0; // 控制公布名次進度
const ROWS_PER_COL = 9; // 每欄顯示的隊伍數
const itemsToDisplay = ROWS_PER_COL * 2; // 一個畫面總共顯示 18 隊

function initDashboard() {
    revealCount = 0; // 每次進入看板都重置進度
    fetchRankings();
    
    // 按鈕綁定
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.onclick = fetchRankings;
    

    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.onclick = () => {
            // 確保 maxAward 至少為 3，防止因 undefined 導致判斷失效
            let maxAward = 3;
            if (currentRankingsData && typeof currentRankingsData.awardCount !== 'undefined') {
                maxAward = parseInt(currentRankingsData.awardCount);
            }
            
            if (revealCount < maxAward) { 
                revealCount++; 
                updateUI(); 
            } else { 
                alert('名次已全部公布！'); 
            }
        };
    }

    const resetRevealBtn = document.getElementById('resetRevealBtn');
    if (resetRevealBtn) {
        resetRevealBtn.onclick = () => {
            if (confirm('確定要重置揭曉狀態嗎？所有名次將重新被遮蓋。')) {
                revealCount = 0;
                updateUI();
            }
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

    // 1. 處理頒獎名額 (Winners List)
    // 1. 處理頒獎名額 (Winners List)
    // 讀取設定並限制在 1~5 名之間
    let awardCount = parseInt(data.awardCount) || 3;
    awardCount = Math.min(Math.max(awardCount, 1), 5);
    
    // 更新按鈕文字顯示進度
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
        revealBtn.innerHTML = revealCount >= awardCount ? `📢 全部名次已公佈` : `📢 公佈名次 (${revealCount}/${awardCount})`;
    }

    const winners = rankings.slice(0, awardCount);
    winners.forEach((item, index) => {
        // 增加容錯：如果後端尚未更新 rank，則以 index+1 代替
        const displayRank = item.rank || (index + 1);
        // 揭曉邏輯：從最後一名往前公佈。
        const isHidden = revealCount < (awardCount - index);
        const card = document.createElement('div');
        card.className = `podium-card rank-${displayRank <= 3 ? displayRank : 'other'} ${isHidden ? 'is-hidden' : ''}`;
        
        let medal = displayRank <= 3 ? (['🥇', '🥈', '🥉'][displayRank-1] || '⭐') : '⭐';

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
                const teamRank = item.rank || '-';
                row.innerHTML = `
                    <div class="s-badge">${teamRank}</div>
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
