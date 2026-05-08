let currentAdminData = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchAdminData();

    document.getElementById('refreshBtn').addEventListener('click', fetchAdminData);
    document.getElementById('lotteryBtn').addEventListener('click', handleLottery);
    document.getElementById('sortByOrderBtn').addEventListener('click', sortByOrder);
    document.getElementById('sortRegIdBtn').addEventListener('click', sortByRegId);
    document.getElementById('saveBtn').addEventListener('click', saveOrders);
    document.getElementById('printBtn').addEventListener('click', () => window.print());
});

async function fetchAdminData() {
    showLoading(true);
    try {
        const response = await fetch(`${GAS_API_URL}?action=getAdminData&t=${Date.now()}`);
        const data = await response.json();
        currentAdminData = data.adminData || [];
        
        // 預設依出場序排序
        sortByOrder(false); 
    } catch (error) {
        console.error(error);
        showToast('載入失敗', 'error');
    } finally {
        showLoading(false);
    }
}

function renderAdminTable(data) {
    const body = document.getElementById('adminBody');
    body.innerHTML = '';

    data.forEach((team, index) => {
        const tr = document.createElement('tr');
        
        const memberHtml = team.members.map(m => 
            `<span class="member-tag">${m.class} / ${m.seat} / ${m.name}</span>`
        ).join(' ');

        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center;">
                    <div class="print-only-order">${team.order}</div>
                    <input type="number" class="order-input" value="${team.order}" 
                        data-regid="${team.regId}" data-index="${index}" min="1">
                    <div style="margin-left:10px;">
                        <button class="move-btn" onclick="moveTeam(${index}, -1)">▲</button>
                        <button class="move-btn" onclick="moveTeam(${index}, 1)">▼</button>
                    </div>
                </div>
            </td>
            <td>${team.regId}</td>
            <td>
                <div style="font-weight:700;">${team.teamName}</div>
                <div style="font-size:0.85rem; color:#a0aec0;">🎵 ${team.song || '未指定'}</div>
            </td>
            <td>${memberHtml}</td>
        `;
        body.appendChild(tr);
    });

    // 為所有輸入框綁定事件
    document.querySelectorAll('.order-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const oldIndex = parseInt(e.target.dataset.index);
            const newOrder = parseInt(e.target.value);
            if (isNaN(newOrder) || newOrder < 1) {
                e.target.value = currentAdminData[oldIndex].order;
                return;
            }
            jumpToOrder(oldIndex, newOrder);
        });
    });
}

function jumpToOrder(oldIndex, newOrder) {
    // 取得目標位置
    const targetIndex = Math.min(Math.max(newOrder - 1, 0), currentAdminData.length - 1);
    if (oldIndex === targetIndex) return;

    // 直接修改當前陣列中的出場序 (WYSIWYG)
    // 這裡我們假設使用者是在「依出場序」的狀態下操作最直覺
    const team = currentAdminData.splice(oldIndex, 1)[0];
    currentAdminData.splice(targetIndex, 0, team);

    // 重新編號：出場序 = 陣列索引 + 1
    currentAdminData.forEach((t, idx) => {
        t.order = idx + 1;
    });

    renderAdminTable(currentAdminData);
}

function moveTeam(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentAdminData.length) return;

    // 交換位置
    const temp = currentAdminData[index];
    currentAdminData[index] = currentAdminData[newIndex];
    currentAdminData[newIndex] = temp;

    // 重新更新出場序數字 (依據目前陣列順序重新連號)
    currentAdminData.forEach((team, idx) => {
        team.order = idx + 1;
    });

    renderAdminTable(currentAdminData);
}

function handleLottery() {
    if (!confirm('確定要重新隨機抽籤嗎？這會打亂目前的出場順序。')) return;

    // 洗牌算法 (Fisher-Yates)
    for (let i = currentAdminData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentAdminData[i], currentAdminData[j]] = [currentAdminData[j], currentAdminData[i]];
    }

    // 重新分配連號序號
    currentAdminData.forEach((team, index) => {
        team.order = index + 1;
    });

    renderAdminTable(currentAdminData);
    showToast('隨機抽籤完成，請記得按下儲存', 'success');
}

function sortByRegId() {
    // 僅排序，不重新編號 (抽籤結果跟著移動)
    currentAdminData.sort((a, b) => {
        return (parseInt(a.regId) || 0) - (parseInt(b.regId) || 0);
    });

    renderAdminTable(currentAdminData);
    showToast('已依報名序排列 (保留出場序)', 'success');
}

function sortByOrder(showToastMsg = true) {
    // 依據目前的 order 屬性排序
    currentAdminData.sort((a, b) => {
        const oA = parseInt(a.order) || 999;
        const oB = parseInt(b.order) || 999;
        return oA - oB;
    });

    renderAdminTable(currentAdminData);
    if (showToastMsg) showToast('已依出場序排列', 'success');
}

async function saveOrders() {
    const inputs = document.querySelectorAll('.order-input');
    const orders = {};
    
    inputs.forEach(input => {
        const regId = input.dataset.regid;
        const val = input.value.trim();
        if (regId && val !== '') {
            orders[regId] = val;
        }
    });

    showLoading(true);
    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateOrders',
                orders: orders
            })
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast('儲存成功', 'success');
            fetchAdminData(); // 重新整理
        } else {
            showToast('儲存失敗：' + result.message, 'error');
        }
    } catch (error) {
        showToast('連線失敗', 'error');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show toast-${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
