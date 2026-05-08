let currentRankingsData = null;
let scheduleOffset = 0;
let filteredTeams = [];
let revealCount = 0; // 控制公布名次進度 (0-5)
let isGlobalReveal = false; // 是否全域顯示排行 (不使用遮罩)
const ROWS_PER_COL = 9; // 每欄顯示的隊伍數，可依螢幕調整


document.addEventListener('DOMContentLoaded', () => {
    fetchRankings().then(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('print') === 'true') {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    });
    
    document.getElementById('refreshBtn').addEventListener('click', fetchRankings);
    
    // 全域顯示/隱藏排行按鈕
    document.getElementById('toggleRevealBtn').addEventListener('click', (e) => {
        // 如果目前是逐步揭曉模式，且已經有揭曉進度
        if (!isGlobalReveal && revealCount > 0) {
            // 先進行全部隱藏（重置進度），不跳出確認
            revealCount = 0;
            updateUIWithCurrentData();
            return;
        }

        // 正常切換邏輯
        isGlobalReveal = !isGlobalReveal;
        e.target.textContent = isGlobalReveal ? '🔒 隱藏排行' : '👁️ 顯示排行';
        
        // 如果切換回「隱藏」模式，則重置揭曉進度
        if (!isGlobalReveal) {
            revealCount = 0;
        }
        
        updateUIWithCurrentData();
    });

    // 公布名次按鈕邏輯
    document.getElementById('revealBtn').addEventListener('click', () => {
        if (isGlobalReveal) {
            alert('目前已設定為全域顯示。');
            return;
        }
        if (revealCount < 5) {
            revealCount++;
            updateUIWithCurrentData();
        } else {
            alert('名次已全部公布！');
        }
    });

    setInterval(fetchRankings, 30000);
});

function updateUIWithCurrentData() {
    if (currentRankingsData) {
        renderDashboard(currentRankingsData);
    }
}

async function fetchRankings() {
    try {
        // 加入時間戳記確保重新整理時抓到最新總分
        const response = await fetch(`${GAS_API_URL}?action=getRankings&t=${Date.now()}`);
        const data = await response.json(); 
        currentRankingsData = data;
        renderDashboard(data);
    } catch (error) {
        console.error('Fetch error:', error);
        document.getElementById('winnersList').innerHTML = '<div class="podium-card">無法連線至伺服器</div>';
    }
}

function renderDashboard(data) {
    const winnersList = document.getElementById('winnersList');
    const scheduleList1 = document.getElementById('scheduleList1');
    const scheduleList2 = document.getElementById('scheduleList2');

    const rankings = data.rankings || [];
    const fullList = data.fullList || [];

        winnersList.innerHTML = '';
        scheduleList1.innerHTML = '';
        scheduleList2.innerHTML = '';

        if (rankings.length === 0) {
            winnersList.innerHTML = '<div class="podium-card" style="justify-content:center;">目前尚無評分資料</div>';
            return;
        }

        // 1. 處理前五名 (Winners List)
        const top5 = rankings.slice(0, 5);
        top5.forEach((item, index) => {
            const rank = index + 1;
            const isHidden = !isGlobalReveal && (revealCount < (5 - index)); // 由第五名 (index 4) 開始公布, 全域顯示時不隱藏
            
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
            winnersList.appendChild(card);
        });

        // 2. 處理全體賽程 (不篩選前五名)
        filteredTeams = fullList; // 恢復顯示所有隊伍

        const totalTeams = filteredTeams.length;
        const itemsToDisplay = ROWS_PER_COL * 2;

        // 如果隊伍數超過顯示上限，則每 30 秒跳轉至下一頁
        if (totalTeams > itemsToDisplay) {
            if (currentRankingsData !== null) {
                // 每次跳轉一整個畫面 (18 隊)
                scheduleOffset += itemsToDisplay;
                if (scheduleOffset >= totalTeams) {
                    scheduleOffset = 0;
                }
            }
        } else {
            scheduleOffset = 0;
        }

        const renderSchedule = (data, container) => {
            container.innerHTML = ''; 
            data.forEach(item => {
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

        if (totalTeams > 0) {
            // 取得當前頁面的 18 隊資料，不使用 modulo 避免單頁重複
            const pageData = filteredTeams.slice(scheduleOffset, scheduleOffset + itemsToDisplay);
            const col1Data = pageData.slice(0, ROWS_PER_COL);
            const col2Data = pageData.slice(ROWS_PER_COL, itemsToDisplay);
            
            renderSchedule(col1Data, scheduleList1);
            renderSchedule(col2Data, scheduleList2);
        }
}
