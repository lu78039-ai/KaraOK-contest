document.addEventListener('DOMContentLoaded', () => {
    // This script will be loaded in index.html, so we only initialize it when the view is shown or on load
    // But since it's an SPA, we might need a function to init it
});

let currentOverwriteRegId = null;

function initRegister() {
    checkStatus();
    switchRegTab('new');
    setupNameCheck();
}

function setupNameCheck() {
    const container = document.getElementById('membersContainer');
    if (!container) return;

    // 使用事件委派監聽所有輸入框
    container.addEventListener('blur', async (e) => {
        if (e.target.matches('.m-class, .m-seat, .m-name')) {
            const row = e.target.closest('.member-input-row');
            const cls = row.querySelector('.m-class').value.trim();
            const seat = row.querySelector('.m-seat').value.trim();
            const name = row.querySelector('.m-name').value.trim();

            // 只有當三個欄位都有值且尚未進入覆蓋模式時才檢查
            if (cls && seat && name && !currentOverwriteRegId) {
                try {
                    const res = await fetch(`${GAS_API_URL}?action=checkStudentDetails&class=${encodeURIComponent(cls)}&seat=${encodeURIComponent(seat)}&name=${encodeURIComponent(name)}`);
                    const data = await res.json();
                    
                    if (data.status === 'found') {
                        const msg = `該學生（${cls}班 ${seat}號 ${name}）已經報名參賽，每個人只能參加一場賽事，你要進入修改資料頁面嗎?`;
                        if (confirm(msg)) {
                            // 跳轉到修改分頁
                            switchRegTab('edit');
                            document.getElementById('editMemberName').value = name;
                            // 清空新報名表單中該學生的姓名，避免重複觸發或誤送出
                            row.querySelector('.m-name').value = '';
                            showToast("請輸入報名序號以驗證身分");
                        } else {
                            // 如果不修改，則清空該行避免重複報名
                            row.querySelector('.m-name').value = '';
                            showToast("每人僅限報名一次", true);
                        }
                    }
                } catch (e) {
                    console.error("檢查重複失敗", e);
                }
            }
        }
    }, true);
}

// 移除自動載入函式，改由使用者輸入序號驗證後載入

function switchRegTab(tab) {
    const isNew = tab === 'new';
    document.getElementById('newRegSection').classList.toggle('hidden', !isNew);
    document.getElementById('editRegSection').classList.toggle('hidden', isNew);
    document.getElementById('tab-new').classList.toggle('active', isNew);
    document.getElementById('tab-edit').classList.toggle('active', !isNew);
    
    // 重置修改表單狀態
    if (!isNew) {
        document.getElementById('updateFormSection').classList.add('hidden');
        document.getElementById('searchSection').classList.remove('hidden');
    }
}

async function findMyRegistration() {
    const regIdInput = document.getElementById('editRegId').value;
    const name = document.getElementById('editMemberName').value;
    
    if (!regIdInput || !name) {
        showToast("請輸入序號與姓名", true);
        return;
    }

    try {
        const res = await fetch(`${GAS_API_URL}?action=findRegistration&regId=${regIdInput}&name=${encodeURIComponent(name)}`);
        const data = await res.json();
        
        if (data.status === 'success') {
            document.getElementById('editRegIdDisplay').textContent = data.regId;
            document.getElementById('editTeamName').value = data.teamName;
            document.getElementById('editSong').value = data.song;
            document.getElementById('editVideo').value = data.videoUrl;
            
            // 填寫組員
            const container = document.getElementById('editMembersContainer');
            container.innerHTML = '';
            data.members.forEach((m, idx) => {
                const div = document.createElement('div');
                div.className = 'member-input-row';
                div.style.cssText = 'display:grid; grid-template-columns: 0.8fr 0.8fr 1.2fr 40px; gap:8px; margin-bottom:8px;';
                const isFirst = idx === 0;
                div.innerHTML = `
                    <input type="text" class="m-class" placeholder="班級" value="${m.class}" required>
                    <input type="number" class="m-seat" placeholder="座號" value="${m.seat}" required>
                    <input type="text" class="m-name" placeholder="姓名" value="${m.name}" required>
                    ${isFirst ? '<div style="width:40px;"></div>' : '<button type="button" class="nav-btn" style="width:auto; padding:0; color:var(--danger-color); font-size:1.2rem;" onclick="this.parentElement.remove()">✕</button>'}
                `;
                container.appendChild(div);
            });

            document.getElementById('searchSection').classList.add('hidden');
            document.getElementById('updateFormSection').classList.remove('hidden');
            showToast("查詢成功，您現在可以修改任何欄位");
        } else {
            showToast(data.message, true);
        }
    } catch (e) {
        showToast("查詢失敗，請檢查連線", true);
    }
}

function addMemberFieldToEdit() {
    const container = document.getElementById('editMembersContainer');
    const div = document.createElement('div');
    div.className = 'member-input-row';
    div.style.cssText = 'display:grid; grid-template-columns: 0.8fr 0.8fr 1.2fr 40px; gap:8px; margin-bottom:8px;';
    div.innerHTML = `
        <input type="text" class="m-class" placeholder="班級" required>
        <input type="number" class="m-seat" placeholder="座號" required>
        <input type="text" class="m-name" placeholder="姓名" required>
        <button type="button" class="nav-btn" style="width:auto; padding:0; color:var(--danger-color); font-size:1.2rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

async function submitFullRegistrationUpdate() {
    const regId = document.getElementById('editRegIdDisplay').textContent;
    const teamName = document.getElementById('editTeamName').value;
    const song = document.getElementById('editSong').value;
    const videoUrl = document.getElementById('editVideo').value;
    
    const members = Array.from(document.querySelectorAll('#editMembersContainer .member-input-row')).map(row => ({
        class: row.querySelector('.m-class').value,
        seat: row.querySelector('.m-seat').value,
        name: row.querySelector('.m-name').value
    }));

    if (!teamName || !song || members.length === 0) {
        showToast("請填寫完整資訊", true);
        return;
    }

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'register', // 直接使用 register action，帶入 overwriteRegId
                overwriteRegId: regId,
                teamName: teamName,
                song: song,
                videoUrl: videoUrl,
                members: members
            })
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            showToast("更新成功！系統已覆蓋原始報名資料");
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast("更新失敗：" + result.message, true);
        }
    } catch (e) {
        showToast("系統錯誤", true);
    }
}

// 新增成員欄位
function addMemberField() {
    const container = document.getElementById('membersContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'member-input-row';
    div.style.cssText = 'display:grid; grid-template-columns: 0.8fr 0.8fr 1.2fr 40px; gap:8px; margin-bottom:8px;';
    div.innerHTML = `
        <input type="text" class="m-class" placeholder="班級" required>
        <input type="number" class="m-seat" placeholder="座號" required>
        <input type="text" class="m-name" placeholder="姓名" required>
        <button type="button" class="nav-btn" style="width:auto; padding:0; color:var(--danger-color); font-size:1.2rem;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

async function checkStatus() {
    try {
        const res = await fetch(`${GAS_API_URL}?action=getRegistrationStatus`);
        const data = await res.json();
        
        const banner = document.getElementById('statusBanner');
        if (data.isOpen) {
            banner.textContent = `🟢 報名進行中 (截止時間：${data.deadline})`;
            banner.className = 'status-banner status-open';
        } else {
            document.getElementById('registerBox').classList.add('hidden');
            document.getElementById('closedScreen').classList.remove('hidden');
            document.getElementById('deadlineInfo').textContent = `截止時間：${data.deadline}`;
            banner.textContent = `🔴 報名已截止`;
            banner.className = 'status-banner status-closed';
        }
        banner.classList.remove('hidden');
    } catch (e) {
        showToast("無法取得報名狀態", true);
    }
}

function closePreview() {
    document.getElementById('previewScreen').classList.add('hidden');
    document.getElementById('registerBox').classList.remove('hidden');
}

function showRegisterPreview() {
    const form = document.getElementById('registerForm');
    if (!form.reportValidity()) return;

    const members = Array.from(document.querySelectorAll('#registerView .member-input-row')).map(row => ({
        class: row.querySelector('.m-class').value,
        seat: row.querySelector('.m-seat').value,
        name: row.querySelector('.m-name').value
    }));
    
    document.getElementById('p-team').textContent = document.getElementById('teamName').value;
    document.getElementById('p-song').textContent = document.getElementById('song').value;
    document.getElementById('p-video').textContent = document.getElementById('videoUrl').value || '未提供';
    
    const listHtml = members.map(m => `${m.class}班 ${m.seat}號 ${m.name}`).join('、');
    document.getElementById('p-members-list').innerHTML = listHtml;

    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('previewScreen').classList.remove('hidden');
}

async function submitRegistration() {
    const btn = document.getElementById('confirmSubmitBtn');
    btn.disabled = true;
    btn.textContent = '寫入中...';

    const members = Array.from(document.querySelectorAll('#registerView .member-input-row')).map(row => ({
        class: row.querySelector('.m-class').value,
        seat: row.querySelector('.m-seat').value,
        name: row.querySelector('.m-name').value
    }));

    const payload = {
        action: 'register',
        teamName: document.getElementById('teamName').value,
        song: document.getElementById('song').value,
        videoUrl: document.getElementById('videoUrl').value,
        members: members,
        overwriteRegId: currentOverwriteRegId // 如果有值，後台會進行覆蓋
    };

    try {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.status === 'success') {
            document.getElementById('previewScreen').classList.add('hidden');
            document.getElementById('successScreen').classList.remove('hidden');
            document.getElementById('regIdDisplay').textContent = result.regId;
            
            // 重置狀態
            currentOverwriteRegId = null;
        } else {
            showToast("報名失敗：" + result.message, true);
            btn.disabled = false;
            btn.textContent = '確認送出報名';
        }
    } catch (error) {
        showToast("伺服器連線失敗", true);
        btn.disabled = false;
        btn.textContent = '確認送出報名';
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${isError ? 'toast-error' : 'toast-success'}`;
    setTimeout(() => toast.className = 'toast', 3000);
}
