document.addEventListener('DOMContentLoaded', async () => {
    const printDate = document.getElementById('printDate');
    const now = new Date();
    printDate.textContent = `製表時間：${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    await loadReportData();

    // 顯示/隱藏評審明細切換
    let showJudges = true;
    const toggleBtn = document.getElementById('toggleJudgesBtn');
    toggleBtn.addEventListener('click', () => {
        showJudges = !showJudges;
        const judgeCells = document.querySelectorAll('.judge-cell');
        judgeCells.forEach(cell => {
            if (showJudges) cell.classList.remove('hidden');
            else cell.classList.add('hidden');
        });
        toggleBtn.innerHTML = showJudges ? '👁️ 隱藏評審明細' : '👁️ 顯示評審明細';
    });
});

async function loadReportData() {
    const loading = document.getElementById('loading');
    const tableWrapper = document.getElementById('tableWrapper');
    const headerRow = document.getElementById('headerRow');
    const body = document.getElementById('reportContent');

    try {
        const response = await fetch(`${GAS_API_URL}?action=getRankings&t=${Date.now()}`);
        const data = await response.json();
        const rankings = data.rankings || [];

        if (rankings.length === 0) {
            loading.textContent = '目前尚無評分資料。';
            return;
        }

        // 1. 取得所有出現過的評審姓名，用於動態表頭
        const judgeNames = new Set();
        rankings.forEach(r => {
            if (r.judgeScores) {
                Object.keys(r.judgeScores).forEach(name => judgeNames.add(name));
            }
        });
        const sortedJudges = Array.from(judgeNames).sort();

        // 2. 建立表頭
        let headerHtml = `
            <th style="width: 60px;">出場序</th>
            <th class="team-col">隊伍名稱</th>
            <th>參賽成員</th>
            <th>參賽曲目</th>
        `;
        
        sortedJudges.forEach(name => {
            headerHtml += `<th class="judge-cell">${name}</th>`;
        });

        headerHtml += `
            <th class="total-col">總分</th>
            <th class="total-col">平均</th>
            <th style="width: 60px;">名次</th>
        `;
        headerRow.innerHTML = headerHtml;

        // 3. 排序資料 (依平均分由高到低)
        const sortedData = rankings.sort((a, b) => (b.average || 0) - (a.average || 0));

        // 4. 填充內容
        body.innerHTML = '';
        sortedData.forEach((item, index) => {
            const tr = document.createElement('tr');
            
            // 計算名次 (根據分數排名而非目前排序)
            // 注意：rankings 原本就是依總分排名的，所以我們可以從原始資料中找到排名
            // 或者我們重新計算。這裡假設 rankings 已經是由高到低排好的。
            // 但因為我們現在依「出場序」表列，所以我們需要保留原始的排名資訊。
            const rank = item.rank || findRank(rankings, item.teamName);

            let rowHtml = `
                <td>${item.order || '-'}</td>
                <td class="team-col">${item.teamName}</td>
                <td style="font-size: 0.85rem;">${item.name || ''}</td>
                <td style="font-size: 0.85rem;">${item.song || ''}</td>
            `;

            // 各評審分數
            sortedJudges.forEach(name => {
                let score = (item.judgeScores && item.judgeScores[name]) ? item.judgeScores[name] : '-';
                if (typeof score === 'number') score = score.toFixed(1);
                rowHtml += `<td class="score-col judge-cell">${score}</td>`;
            });

            rowHtml += `
                <td class="total-col">${item.totalSum.toFixed(1)}</td>
                <td class="total-col">${item.average.toFixed(1)}</td>
                <td style="font-weight: 800;">${rank}</td>
            `;

            tr.innerHTML = rowHtml;
            body.appendChild(tr);
        });

        loading.classList.add('hidden');
        tableWrapper.classList.remove('hidden');

    } catch (error) {
        console.error(error);
        loading.textContent = '資料載入失敗，請檢查網路連線或 API 設定。';
    }
}

// 輔助函式：在原始排名列表中尋找該隊的名次
function findRank(originalRankings, teamName) {
    // 假設原始 rankings 是依分數由高到低排列的
    const idx = originalRankings.findIndex(r => r.teamName === teamName);
    return idx !== -1 ? idx + 1 : '-';
}
