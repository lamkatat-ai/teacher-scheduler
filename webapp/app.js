/**
 * SmartScheduler - 教師排課系統
 * 核心應用程式邏輯
 */

// ========================================
// 全域狀態
// ========================================
let isLoggedIn = false;
let autoSaveTimer = null;
let lastSavedData = null;

const AppState = {
    teachers: [],
    classes: [],
    subjects: [],
    schedules: [],
    departmentMeetings: {},
    customMeetings: [],
    teacherMeetings: {},
    currentUser: null,
    isDirty: false,  // 追蹤是否有未保存的變更
    settings: {
        periodsPerDay: 9,
        daysPerWeek: 5,
        periodsPerDayOfWeek: {
            0: 8,  // 週一：8 節
            1: 8,  // 週二：8 節
            2: 7,  // 週三：7 節
            3: 8,  // 週四：8 節
            4: 9   // 週五：9 節
        },
        priorityStrategy: 'balance',
        maxAttempts: 500
    }
};

// ========================================
// 常量定義
// ========================================
const DIVISIONS = {
    'kindergarten': { name: '幼稚園', grades: ['K1', 'K2', 'K3'], color: '#ffe6e6' },
    'primary-cn': { name: '小學中文部', grades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], color: '#e8f5e9' },
    'primary-en': { name: '小學英文部', grades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], color: '#e3f2fd' },
    'secondary-cn': { name: '中學中文部', grades: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], color: '#fff3e0' },
    'secondary-en': { name: '中學英文部', grades: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], color: '#f3e5f5' }
};

const DAY_NAMES = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

// 科組定義
const DEPARTMENTS = {
    'english': { name: '英文科組', color: '#3498db', icon: 'fa-language', meetingTime: null },
    'chinese': { name: '中文科組', color: '#e74c3c', icon: 'fa-book', meetingTime: null },
    'math': { name: '數學科組', color: '#2ecc71', icon: 'fa-calculator', meetingTime: null },
    'history-geo': { name: '史地科組', color: '#f39c12', icon: 'fa-globe', meetingTime: null },
    'religion-civic': { name: '宗教與公民科組', color: '#9b59b6', icon: 'fa-pray', meetingTime: null },
    'pe': { name: '體育科組', color: '#1abc9c', icon: 'fa-running', meetingTime: null },
    'art-music': { name: '視藝及音樂科組', color: '#e67e22', icon: 'fa-palette', meetingTime: null },
    'cultivation': { name: '培育組', color: '#16a085', icon: 'fa-seedling', meetingTime: null },
    'student-dev': { name: '學生發展及升學組', color: '#27ae60', icon: 'fa-graduation-cap', meetingTime: null },
    'image': { name: '形象組', color: '#8e44ad', icon: 'fa-camera', meetingTime: null },
    'curriculum': { name: '課程組', color: '#c0392b', icon: 'fa-chalkboard', meetingTime: null },
    'admin': { name: '行政組', color: '#7f8c8d', icon: 'fa-cogs', meetingTime: null },
    'secondary-core': { name: '中學核心組', color: '#d35400', icon: 'fa-star', meetingTime: null },
    'secondary-admin-head': { name: '中學行政及科組長', color: '#8e44ad', icon: 'fa-user-tie', meetingTime: null },
    'other': { name: '其他科組', color: '#95a5a6', icon: 'fa-folder', meetingTime: null }
};

const DEFAULT_SUBJECTS = [
    { id: 'subj_1', name: '中文', code: 'CH', color: '#e74c3c', department: 'chinese' },
    { id: 'subj_2', name: '英文', code: 'EN', color: '#3498db', department: 'english' },
    { id: 'subj_3', name: '數學', code: 'MA', color: '#2ecc71', department: 'math' },
    { id: 'subj_4', name: '科學', code: 'SC', color: '#9b59b6', department: 'other' },
    { id: 'subj_5', name: '音樂', code: 'MU', color: '#f39c12', department: 'other' },
    { id: 'subj_6', name: '美術', code: 'AR', color: '#e67e22', department: 'other' },
    { id: 'subj_7', name: '體育', code: 'PE', color: '#1abc9c', department: 'other' },
    { id: 'subj_8', name: '宗教', code: 'RE', color: '#34495e', department: 'other' }
];

// ========================================
// 本地存儲
// ========================================
const Storage = {
    save(key, data) {
        try {
            localStorage.setItem('scheduler_' + key, JSON.stringify(data));
        } catch (e) {
            console.error('Storage save error:', e);
        }
    },
    load(key, defaultValue) {
        try {
            const data = localStorage.getItem('scheduler_' + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage load error:', e);
            return defaultValue;
        }
    },
    clear() {
        Object.keys(localStorage)
            .filter(function(k) { return k.startsWith('scheduler_'); })
            .forEach(function(k) { localStorage.removeItem(k); });
    }
};

// ========================================
// Toast 通知
// ========================================
function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = '<i class="fas ' + icons[type] + '"></i><span class="toast-message">' + message + '</span>';
    container.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'toastSlide 0.3s ease reverse';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

// ========================================
// 工具函數
// ========================================
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getDivisionName(divisionId) {
    return DIVISIONS[divisionId] ? DIVISIONS[divisionId].name : divisionId;
}

function getSubjectColor(subjectId) {
    var subject = AppState.subjects.find(function(s) { return s.id === subjectId; });
    return subject ? subject.color : '#666';
}

function getSubjectName(subjectId) {
    var subject = AppState.subjects.find(function(s) { return s.id === subjectId; });
    return subject ? subject.name : subjectId;
}

function getTeacherName(teacherId) {
    var teacher = AppState.teachers.find(function(t) { return t.id === teacherId; });
    return teacher ? teacher.name : teacherId;
}

function getClassName(classId) {
    var cls = AppState.classes.find(function(c) { return c.id === classId; });
    return cls ? cls.name : classId;
}

function getClassInfo(classId) {
    return AppState.classes.find(function(c) { return c.id === classId; });
}

// ========================================
// 初始化
// ========================================
function initializeApp() {
    // 檢查是否已登入
    const savedLogin = sessionStorage.getItem('scheduler_logged_in');
    if (savedLogin === 'true') {
        isLoggedIn = true;
        loadData();
        setupEventListeners();
        renderAll();
        updateSaveButtonState();
        setupAutoSave();
        updateHeaderForLoggedIn();
        document.body.style.display = '';
    } else {
        // 顯示登入畫面
        document.body.style.display = 'none';
        showLoginModal();
        setupEventListeners();
    }
}

// 顯示登入 Modal
function showLoginModal() {
    document.body.style.display = '';
    document.getElementById('loginModal').classList.add('active');
}

// 處理登入
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            isLoggedIn = true;
            AppState.currentUser = result.user;
            sessionStorage.setItem('scheduler_logged_in', 'true');
            sessionStorage.setItem('scheduler_user', JSON.stringify(result.user));
            
            document.getElementById('loginModal').classList.remove('active');
            errorEl.style.display = 'none';
            
            loadData();
            setupEventListeners();
            renderAll();
            updateSaveButtonState();
            setupAutoSave();
            updateHeaderForLoggedIn();
            
            showToast('歡迎 ' + result.user.name + '！', 'success');
        } else {
            errorEl.textContent = result.message || '電郵或密碼錯誤';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = '連接伺服器失敗，請稍後再試';
        errorEl.style.display = 'block';
    }
}

// 登出
function logout() {
    if (!confirm('確定要登出嗎？')) return;
    
    isLoggedIn = false;
    sessionStorage.removeItem('scheduler_logged_in');
    sessionStorage.removeItem('scheduler_user');
    
    // 停止自動儲存
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
    
    // 重置 Header
    const headerRight = document.querySelector('.header-right');
    headerRight.innerHTML = `
        <button class="btn btn-primary" onclick="showLoginModal()" style="margin-left:auto;">
            <i class="fas fa-sign-in-alt"></i> 登入
        </button>
    `;
    
    // 顯示登入畫面
    showLoginModal();
}

// 更新 Header（登入後）
function updateHeaderForLoggedIn() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    
    headerRight.innerHTML = `
        <span style="color:var(--gray-600);font-size:0.9rem;margin-right:1rem;">
            <i class="fas fa-user"></i> ${AppState.currentUser?.name || '用戶'}
        </span>
        <button class="btn btn-outline" id="exportCSVBtn" title="導出 CSV">
            <i class="fas fa-file-csv"></i> CSV
        </button>
        <button class="btn btn-outline" id="printBtn" title="打印">
            <i class="fas fa-print"></i> 列印
        </button>
        <button class="btn btn-danger" id="clearDataBtn" title="清除所有數據">
            <i class="fas fa-trash"></i> 清除數據
        </button>
        <button class="btn btn-success" id="saveScheduleBtn" title="儲存排課">
            <i class="fas fa-save"></i> 儲存
        </button>
        <div id="saveStatus" class="save-status"></div>
        <button class="btn btn-secondary" id="logoutBtn" title="登出" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i> 登出
        </button>
    `;
    
    // 重新綁定事件
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
    document.getElementById('printBtn').addEventListener('click', printSchedule);
    document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
    document.getElementById('saveScheduleBtn').addEventListener('click', saveScheduleToServer);
}

// ========================================
// 自動儲存
// ========================================
function setupAutoSave() {
    // 保存當前數據快照
    lastSavedData = getCurrentDataSnapshot();
    
    // 每 30 秒自動檢測變更並儲存
    autoSaveTimer = setInterval(function() {
        if (!isLoggedIn) return;
        
        const currentData = getCurrentDataSnapshot();
        
        if (JSON.stringify(currentData) !== JSON.stringify(lastSavedData)) {
            // 數據有變更，自動儲存
            saveScheduleToServerSilent();
            lastSavedData = currentData;
            console.log('✅ 自動儲存已觸發');
        }
    }, 30000); // 30 秒檢查一次
}

function getCurrentDataSnapshot() {
    return {
        teachers: AppState.teachers.length,
        classes: AppState.classes.length,
        subjects: AppState.subjects.length,
        schedules: AppState.schedules.length,
        departmentMeetings: AppState.departmentMeetings,
        customMeetings: AppState.customMeetings,
        settings: AppState.settings
    };
}

// 靜默自動儲存（不顯示提示）
async function saveScheduleToServerSilent() {
    try {
        await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                schedules: AppState.schedules,
                teachers: AppState.teachers,
                classes: AppState.classes,
                subjects: AppState.subjects,
                departmentMeetings: AppState.departmentMeetings,
                customMeetings: AppState.customMeetings,
                settings: AppState.settings,
                updated_by: AppState.currentUser ? AppState.currentUser.id : null
            })
        });
        markClean();
    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}

function loadData() {
    AppState.teachers = Storage.load('teachers', []);
    AppState.classes = Storage.load('classes', []);
    AppState.subjects = Storage.load('subjects', DEFAULT_SUBJECTS);
    AppState.schedules = Storage.load('schedules', []);
    AppState.departmentMeetings = Storage.load('departmentMeetings', {});
    AppState.customMeetings = Storage.load('customMeetings', []);
    AppState.settings = Storage.load('settings', AppState.settings);
}

function saveData() {
    Storage.save('teachers', AppState.teachers);
    Storage.save('classes', AppState.classes);
    Storage.save('subjects', AppState.subjects);
    Storage.save('schedules', AppState.schedules);
    Storage.save('departmentMeetings', AppState.departmentMeetings);
    Storage.save('customMeetings', AppState.customMeetings);
    Storage.save('settings', AppState.settings);
}

// 標記數據為已修改（dirty）
function markDirty() {
    AppState.isDirty = true;
    updateSaveButtonState();
}

// 標記數據為已保存
function markClean() {
    AppState.isDirty = false;
    updateSaveButtonState();
}

// 更新儲存按鈕狀態
function updateSaveButtonState() {
    const saveBtn = document.getElementById('saveScheduleBtn');
    const saveStatus = document.getElementById('saveStatus');
    
    if (saveBtn) {
        if (AppState.isDirty) {
            saveBtn.classList.add('unsaved');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> 儲存*';
        } else {
            saveBtn.classList.remove('unsaved');
            saveBtn.innerHTML = '<i class="fas fa-save"></i> 儲存';
        }
    }
    
    if (saveStatus) {
        if (AppState.isDirty) {
            saveStatus.textContent = '有未保存的變更';
            saveStatus.classList.add('unsaved');
        } else {
            saveStatus.textContent = '';
            saveStatus.classList.remove('unsaved');
        }
    }
}

// 儲存排課數據到伺服器
async function saveScheduleToServer() {
    const saveBtn = document.getElementById('saveScheduleBtn');
    const originalText = saveBtn.innerHTML;
    
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 儲存中...';
    saveBtn.disabled = true;
    
    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                schedules: AppState.schedules,
                teachers: AppState.teachers,
                classes: AppState.classes,
                subjects: AppState.subjects,
                departmentMeetings: AppState.departmentMeetings,
                customMeetings: AppState.customMeetings,
                settings: AppState.settings,
                updated_by: AppState.currentUser ? AppState.currentUser.id : null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            markClean();
            saveBtn.innerHTML = '<i class="fas fa-check"></i> 已儲存';
            showToast('✅ 數據已儲存到伺服器', 'success');
            
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
                updateSaveButtonState();
            }, 2000);
        } else {
            throw new Error('儲存失敗');
        }
    } catch (error) {
        console.error('儲存失敗:', error);
        saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 儲存失敗';
        showToast('❌ 儲存失敗，請重試', 'error');
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
            updateSaveButtonState();
        }, 2000);
    }
}

// 頁面關閉前檢查未保存變更
window.addEventListener('beforeunload', function(e) {
    if (AppState.isDirty) {
        e.preventDefault();
        e.returnValue = '你有未保存的變更，確定要離開嗎？';
        return '你有未保存的變更，確定要離開嗎？';
    }
});

// ========================================
// 事件監聽
// ========================================
function setupEventListeners() {
    var self = this;
    
    // 登入表單
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Tab 導航
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchTab(btn.dataset.tab);
        });
    });
    
    // 教師管理
    document.getElementById('addTeacherBtn').addEventListener('click', function() { openTeacherModal(); });
    document.getElementById('saveTeacherBtn').addEventListener('click', saveTeacher);
    document.getElementById('teacherSearch').addEventListener('input', renderTeachers);
    document.getElementById('teacherDivisionFilter').addEventListener('change', renderTeachers);
    if (document.getElementById('teacherDepartmentFilter')) {
        document.getElementById('teacherDepartmentFilter').addEventListener('change', renderTeachers);
    }
    
    // 班級管理
    document.getElementById('addClassBtn').addEventListener('click', function() { openClassModal(); });
    document.getElementById('saveClassBtn').addEventListener('click', saveClass);
    document.getElementById('classSearch').addEventListener('input', renderClasses);
    document.getElementById('classDivisionFilter').addEventListener('change', renderClasses);
    
    // 科目設置
    document.getElementById('addSubjectBtn').addEventListener('click', function() { openSubjectModal(); });
    document.getElementById('saveSubjectBtn').addEventListener('click', saveSubject);
    
    // 會議設置
    document.getElementById('saveMeetingsBtn').addEventListener('click', saveMeetings);
    
    // 排課引擎
    document.getElementById('generateScheduleBtn').addEventListener('click', generateSchedule);
    document.getElementById('detectConflictsBtn').addEventListener('click', detectConflicts);
    document.getElementById('periodsPerDay').addEventListener('change', function(e) {
        AppState.settings.periodsPerDay = parseInt(e.target.value);
        saveData();
        markDirty();
    });
    document.getElementById('daysPerWeek').addEventListener('change', function(e) {
        AppState.settings.daysPerWeek = parseInt(e.target.value);
        saveData();
        markDirty();
    });
    document.getElementById('priorityStrategy').addEventListener('change', function(e) {
        AppState.settings.priorityStrategy = e.target.value;
        saveData();
        markDirty();
    });
    document.getElementById('maxAttempts').addEventListener('change', function(e) {
        AppState.settings.maxAttempts = parseInt(e.target.value);
        saveData();
        markDirty();
    });
    
    // 導出功能
    document.getElementById('exportCSVBtn').addEventListener('click', exportToCSV);
    document.getElementById('printBtn').addEventListener('click', printSchedule);
    document.getElementById('clearDataBtn').addEventListener('click', clearAllData);
    
    // 儲存按鈕
    document.getElementById('saveScheduleBtn').addEventListener('click', saveScheduleToServer);
    
    // 查看課表
    document.querySelectorAll('.toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            renderScheduleView();
        });
    });
    document.getElementById('viewDivisionFilter').addEventListener('change', updateClassFilter);
    document.getElementById('viewClassFilter').addEventListener('change', renderScheduleView);
    document.getElementById('viewTeacherFilter').addEventListener('change', renderScheduleView);
    
    // 班級需求設置
    document.getElementById('saveRequirementsBtn').addEventListener('click', saveClassRequirements);
    
    // Modal 關閉
    document.querySelectorAll('.modal-close, .modal-cancel, .modal-overlay').forEach(function(el) {
        el.addEventListener('click', closeModals);
    });
    
    // 班級學部變化時更新年級選項
    document.getElementById('classDivision').addEventListener('change', updateGradeOptions);
}

// ========================================
// Tab 切換
// ========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(function(content) {
        content.classList.toggle('active', content.id === tabId);
    });
    
    if (tabId === 'view') {
        updateViewFilters();
        renderScheduleView();
    }
}

// ========================================
// 渲染函數
// ========================================
function renderAll() {
    renderStats();
    renderDashboard();
    renderTeachers();
    renderClasses();
    renderSubjects();
    renderMeetings();
    renderScheduleSettings();
}

function renderStats() {
    document.getElementById('statTeachers').textContent = AppState.teachers.length;
    document.getElementById('statClasses').textContent = AppState.classes.length;
    document.getElementById('statSubjects').textContent = AppState.subjects.length;
    document.getElementById('statPeriods').textContent = AppState.settings.periodsPerDay;
}

function renderDashboard() {
    // 學部分佈
    var divisionStats = document.getElementById('divisionStats');
    var divisions = {};
    AppState.classes.forEach(function(cls) {
        divisions[cls.division] = (divisions[cls.division] || 0) + 1;
    });
    
    var html = '';
    Object.entries(divisions).forEach(function(entry) {
        html += '<div class="division-stat-item"><span class="division-badge ' + entry[0] + '">' + getDivisionName(entry[0]) + '</span><span class="division-count">' + entry[1] + ' 班</span></div>';
    });
    divisionStats.innerHTML = html || '<p class="tip-item"><i class="fas fa-info-circle"></i><p>暫無班級數據</p></p>';
    
    // 科組統計
    var departmentStats = document.getElementById('departmentStats');
    if (departmentStats) {
        var departments = {};
        AppState.teachers.forEach(function(teacher) {
            var dept = teacher.department || 'other';
            departments[dept] = (departments[dept] || 0) + 1;
        });
        
        var deptHtml = '';
        Object.entries(departments).forEach(function(entry) {
            var deptInfo = DEPARTMENTS[entry[0]] || DEPARTMENTS['other'];
            deptHtml += '<div class="division-stat-item"><span class="department-badge" style="background:' + deptInfo.color + '20;color:' + deptInfo.color + ';padding:0.25rem 0.75rem;border-radius:4px;"><i class="fas ' + deptInfo.icon + '"></i> ' + deptInfo.name + '</span><span class="division-count">' + entry[1] + ' 人</span></div>';
        });
        departmentStats.innerHTML = deptHtml || '<p class="tip-item"><i class="fas fa-info-circle"></i><p>暫無教師數據</p></p>';
    }
    
    // 系統提示
    var systemTips = document.getElementById('systemTips');
    var tips = [];
    
    if (AppState.teachers.length === 0) tips.push('建議：先添加教師信息');
    if (AppState.classes.length === 0) tips.push('建議：添加班級以便進行排課');
    if (AppState.classes.length > 0 && AppState.teachers.length === 0) tips.push('警告：沒有教師無法完成排課');
    if (AppState.schedules.length > 0) tips.push('課表已生成：' + AppState.schedules.length + ' 個班級');
    
    html = '';
    tips.forEach(function(tip) {
        html += '<div class="tip-item"><i class="fas fa-lightbulb"></i><p>' + tip + '</p></div>';
    });
    systemTips.innerHTML = html || '<div class="tip-item"><i class="fas fa-check-circle"></i><p>系統就緒，可以開始排課</p></div>';
}

// ========================================
// 教師管理
// ========================================
function renderTeachers() {
    var tbody = document.getElementById('teachersTableBody');
    var search = document.getElementById('teacherSearch').value.toLowerCase();
    var divisionFilter = document.getElementById('teacherDivisionFilter').value;
    var departmentFilter = document.getElementById('teacherDepartmentFilter') ? document.getElementById('teacherDepartmentFilter').value : '';
    
    var filtered = AppState.teachers.filter(function(t) {
        var matchSearch = t.name.toLowerCase().includes(search) ||
            t.subjects.some(function(s) { return getSubjectName(s).toLowerCase().includes(search); });
        var matchDivision = !divisionFilter || t.division === divisionFilter;
        var matchDepartment = !departmentFilter || 
            (t.departments && t.departments.includes(departmentFilter)) ||
            t.department === departmentFilter;
        return matchSearch && matchDivision && matchDepartment;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-table-text"><i class="fas fa-chalkboard-teacher"></i><p>暫無教師資料</p></div></td></tr>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(teacher) {
        var subjects = teacher.subjects.map(function(s) {
            var color = getSubjectColor(s);
            return '<span class="subject-tag" style="background:' + color + '20;color:' + color + '">' + getSubjectName(s) + '</span>';
        }).join('');
        
        var homeroomBadge = teacher.isHomeroomTeacher ? 
            '<span class="homeroom-badge" style="background:#9b59b6;color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;margin-left:0.5rem;">班主任</span>' : '';
        
        // 小學餘暇活動徽章
        var leisureBadge = teacher.primaryLeisure ? 
            '<span class="leisure-badge" style="background:#ff9800;color:white;padding:0.25rem 0.5rem;border-radius:4px;font-size:0.75rem;margin-left:0.25rem;"><i class="fas fa-gamepad"></i> 小學餘暇</span>' : '';
        
        // 科組徽章（支持多個）
        var deptBadges = '';
        if (teacher.departments && teacher.departments.length > 0) {
            deptBadges = teacher.departments.map(function(deptId) {
                var deptInfo = DEPARTMENTS[deptId] || DEPARTMENTS['other'];
                return '<span class="department-badge" style="background:' + deptInfo.color + '20;color:' + deptInfo.color + ';padding:0.15rem 0.4rem;border-radius:3px;font-size:0.7rem;margin-right:0.25rem;"><i class="fas ' + deptInfo.icon + '"></i> ' + deptInfo.name + '</span>';
            }).join('');
        }
        
        var availability = calculateAvailability(teacher);
        var availabilityClass = availability > 80 ? 'full' : availability > 50 ? 'partial' : 'limited';
        
        var constraints = teacher.constraints ? 
            '<div class="constraints-tags"><span class="constraint-tag">' + teacher.constraints + '</span></div>' : '-';
        
        html += '<tr><td><strong>' + teacher.name + '</strong>' + homeroomBadge + leisureBadge + '</td><td>' + deptBadges + '</td><td>' + subjects + '</td><td><span class="division-badge ' + teacher.division + '">' + getDivisionName(teacher.division) + '</span></td><td><span class="availability-badge ' + availabilityClass + '">' + availability + '%</span></td><td>' + constraints + '</td><td><div class="table-actions"><button class="btn-icon edit" onclick="editTeacher(\'' + teacher.id + '\')" title="編輯"><i class="fas fa-edit"></i></button><button class="btn-icon delete" onclick="deleteTeacher(\'' + teacher.id + '\')" title="刪除"><i class="fas fa-trash"></i></button></div></td></tr>';
    });
    tbody.innerHTML = html;
}

function calculateAvailability(teacher) {
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var totalSlots = 0;
    for (var d = 0; d < AppState.settings.daysPerWeek; d++) {
        totalSlots += periodsPerDayOfWeek[d] || 9;
    }
    var availableSlots = Object.values(teacher.availability || {}).filter(function(v) { return v; }).length;
    return totalSlots > 0 ? Math.round((availableSlots / totalSlots) * 100) : 0;
}

function openTeacherModal(teacherId) {
    teacherId = teacherId || null;
    var modal = document.getElementById('teacherModal');
    var title = document.getElementById('teacherModalTitle');
    var form = document.getElementById('teacherForm');
    
    form.reset();
    document.getElementById('teacherId').value = '';
    document.getElementById('isHomeroomTeacher').checked = false;
    document.getElementById('homeroomClassGroup').style.display = 'none';
    
    // 渲染科組選項（多選）
    var departmentsContainer = document.getElementById('teacherDepartments');
    var deptHtml = '';
    Object.entries(DEPARTMENTS).forEach(function(entry) {
        var deptId = entry[0];
        var dept = entry[1];
        if (deptId !== 'other') {
            deptHtml += '<label class="subject-checkbox-item" style="margin:0.25rem;"><input type="checkbox" value="' + deptId + '"><span class="color-dot" style="background:' + dept.color + '"></span>' + dept.name + '</label>';
        }
    });
    departmentsContainer.innerHTML = deptHtml;
    
    // 科組點擊事件
    departmentsContainer.querySelectorAll('.subject-checkbox-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                var checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('selected', item.querySelector('input').checked);
        });
    });
    
    // 渲染自定義會議選項
    var customMeetingsContainer = document.getElementById('teacherCustomMeetings');
    if (AppState.customMeetings && AppState.customMeetings.length > 0) {
        document.getElementById('customMeetingsGroup').style.display = 'block';
        var customMeetingHtml = '';
        AppState.customMeetings.forEach(function(meeting) {
            customMeetingHtml += '<label class="subject-checkbox-item" style="margin:0.25rem;"><input type="checkbox" value="' + meeting.id + '"><span class="color-dot" style="background:' + meeting.color + '"></span>' + meeting.name + '</label>';
        });
        customMeetingsContainer.innerHTML = customMeetingHtml;
        
        // 自定義會議點擊事件
        customMeetingsContainer.querySelectorAll('.subject-checkbox-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.tagName !== 'INPUT') {
                    var checkbox = item.querySelector('input');
                    checkbox.checked = !checkbox.checked;
                }
                item.classList.toggle('selected', item.querySelector('input').checked);
            });
        });
    } else {
        document.getElementById('customMeetingsGroup').style.display = 'none';
    }
    
    // 渲染科目選項（按科組分組）
    var subjectCheckboxes = document.getElementById('teacherSubjects');
    var subjHtml = '';
    
    // 按科組分組顯示科目
    Object.entries(DEPARTMENTS).forEach(function(deptEntry) {
        var deptId = deptEntry[0];
        var dept = deptEntry[1];
        var deptSubjects = AppState.subjects.filter(function(s) { return s.department === deptId; });
        
        if (deptSubjects.length > 0) {
            subjHtml += '<div class="subject-group"><div class="subject-group-title"><i class="fas ' + dept.icon + '"></i> ' + dept.name + '</div><div class="subject-group-items">';
            deptSubjects.forEach(function(subject) {
                subjHtml += '<label class="subject-checkbox-item" data-id="' + subject.id + '" data-department="' + deptId + '"><input type="checkbox" value="' + subject.id + '"><span class="color-dot" style="background:' + subject.color + '"></span>' + subject.name + '</label>';
            });
            subjHtml += '</div></div>';
        }
    });
    
    subjectCheckboxes.innerHTML = subjHtml;
    
    // 科目點擊事件
    subjectCheckboxes.querySelectorAll('.subject-checkbox-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            if (e.target.tagName !== 'INPUT') {
                var checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            item.classList.toggle('selected', item.querySelector('input').checked);
        });
    });
    
    // 渲染班級選項（用於班主任）
    var homeroomClassSelect = document.getElementById('homeroomClass');
    var classHtml = '<option value="">請選擇班級</option>';
    AppState.classes.forEach(function(cls) {
        classHtml += '<option value="' + cls.id + '">' + cls.name + ' (' + getDivisionName(cls.division) + ')</option>';
    });
    homeroomClassSelect.innerHTML = classHtml;
    
    // 班主任checkbox事件
    document.getElementById('isHomeroomTeacher').addEventListener('change', function(e) {
        document.getElementById('homeroomClassGroup').style.display = e.target.checked ? 'block' : 'none';
    });
    
    // 小學餘暇活動checkbox
    var primaryLeisureCheckbox = document.getElementById('primaryLeisure');
    if (primaryLeisureCheckbox) {
        primaryLeisureCheckbox.checked = false;
    }
    
    // 渲染時間網格
    renderTimeGrid('teacherTimeGrid', {});
    
    if (teacherId) {
        title.innerHTML = '<i class="fas fa-edit"></i> 編輯教師';
        var teacher = AppState.teachers.find(function(t) { return t.id === teacherId; });
        if (teacher) {
            document.getElementById('teacherId').value = teacher.id;
            document.getElementById('teacherName').value = teacher.name;
            document.getElementById('teacherDivision').value = teacher.division;
            document.getElementById('teacherConstraints').value = teacher.constraints || '';
            
            // 小學餘暇活動
            if (teacher.primaryLeisure && primaryLeisureCheckbox) {
                primaryLeisureCheckbox.checked = true;
            }
            
            // 自定義會議
            if (teacher.customMeetings && teacher.customMeetings.length > 0) {
                teacher.customMeetings.forEach(function(meetingId) {
                    var item = customMeetingsContainer.querySelector('input[value="' + meetingId + '"]');
                    if (item) {
                        item.checked = true;
                        item.parentElement.classList.add('selected');
                    }
                });
            }
            
            // 科組信息
            if (teacher.departments && teacher.departments.length > 0) {
                teacher.departments.forEach(function(deptId) {
                    var item = departmentsContainer.querySelector('input[value="' + deptId + '"]');
                    if (item) {
                        item.checked = true;
                        item.parentElement.classList.add('selected');
                    }
                });
            }
            
            // 班主任信息
            if (teacher.isHomeroomTeacher) {
                document.getElementById('isHomeroomTeacher').checked = true;
                document.getElementById('homeroomClassGroup').style.display = 'block';
                if (teacher.homeroomClass) {
                    document.getElementById('homeroomClass').value = teacher.homeroomClass;
                }
            }
            
            teacher.subjects.forEach(function(subjId) {
                var item = subjectCheckboxes.querySelector('[data-id="' + subjId + '"]');
                if (item) {
                    item.querySelector('input').checked = true;
                    item.classList.add('selected');
                }
            });
            
            renderTimeGrid('teacherTimeGrid', teacher.availability || {});
        }
    } else {
        title.innerHTML = '<i class="fas fa-user-plus"></i> 新增教師';
    }
    
    modal.classList.add('active');
}

function renderTimeGrid(containerId, availability) {
    var container = document.getElementById(containerId);
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var days = AppState.settings.daysPerWeek;
    
    // 找出最大節數用於顯示
    var maxPeriods = Math.max.apply(null, Object.values(periodsPerDayOfWeek));
    
    var html = '<div class="time-grid-header"></div>';
    for (var p = 1; p <= maxPeriods; p++) {
        html += '<div class="time-grid-header">第' + p + '節</div>';
    }
    
    for (var d = 0; d < days; d++) {
        var dayPeriods = periodsPerDayOfWeek[d] || maxPeriods;
        html += '<div class="time-grid-day">' + DAY_NAMES[d] + '<br><small style="color:#666;font-size:0.7rem;">(' + dayPeriods + '節)</small></div>';
        for (var pp = 1; pp <= maxPeriods; pp++) {
            var key = d + '_' + pp;
            var isAvailable = availability[key] !== false;
            var isDisabled = pp > dayPeriods;
            
            if (isDisabled) {
                html += '<div class="time-cell disabled" style="background:#e0e0e0;color:#999;cursor:not-allowed;">-</div>';
            } else {
                html += '<div class="time-cell ' + (isAvailable ? 'available' : 'unavailable') + '" data-day="' + d + '" data-period="' + pp + '" onclick="toggleTimeCell(this, \'' + containerId + '\')">' + (isAvailable ? '可' : '不可') + '</div>';
            }
        }
    }
    
    container.innerHTML = html;
}

function toggleTimeCell(cell) {
    cell.classList.toggle('available');
    cell.classList.toggle('unavailable');
    cell.textContent = cell.classList.contains('available') ? '可' : '不可';
}

function saveTeacher() {
    var id = document.getElementById('teacherId').value;
    var name = document.getElementById('teacherName').value.trim();
    var division = document.getElementById('teacherDivision').value;
    var departments = Array.from(document.querySelectorAll('#teacherDepartments input:checked')).map(function(cb) { return cb.value; });
    var customMeetings = Array.from(document.querySelectorAll('#teacherCustomMeetings input:checked')).map(function(cb) { return cb.value; });
    var primaryLeisure = document.getElementById('primaryLeisure') ? document.getElementById('primaryLeisure').checked : false;
    var constraints = document.getElementById('teacherConstraints').value.trim();
    var isHomeroomTeacher = document.getElementById('isHomeroomTeacher').checked;
    var homeroomClass = document.getElementById('homeroomClass').value || null;
    
    if (!name) { showToast('請輸入教師姓名', 'error'); return; }
    if (!division) { showToast('請選擇所屬學部', 'error'); return; }
    
    var subjects = Array.from(document.querySelectorAll('#teacherSubjects input:checked')).map(function(cb) { return cb.value; });
    if (subjects.length === 0) { showToast('請選擇任教科目', 'error'); return; }
    
    var availability = {};
    document.querySelectorAll('#teacherTimeGrid .time-cell').forEach(function(cell) {
        var day = cell.dataset.day;
        var period = cell.dataset.period;
        availability[day + '_' + period] = cell.classList.contains('available');
    });
    
    var teacherData = {
        id: id || generateId(),
        name: name,
        division: division,
        departments: departments,
        customMeetings: customMeetings,
        primaryLeisure: primaryLeisure,
        subjects: subjects,
        constraints: constraints,
        availability: availability,
        isHomeroomTeacher: isHomeroomTeacher,
        homeroomClass: homeroomClass
    };
    
    if (id) {
        var index = AppState.teachers.findIndex(function(t) { return t.id === id; });
        if (index !== -1) AppState.teachers[index] = teacherData;
    } else {
        AppState.teachers.push(teacherData);
    }
    
    saveData();
    markDirty();
    closeModals();
    renderAll();
    showToast(id ? '教師已更新' : '教師已添加', 'success');
}

function editTeacher(id) { openTeacherModal(id); }

function deleteTeacher(id) {
    if (!confirm('確定要刪除此教師嗎？')) return;
    AppState.teachers = AppState.teachers.filter(function(t) { return t.id !== id; });
    saveData();
    markDirty();
    renderAll();
    showToast('教師已刪除', 'success');
}

// ========================================
// 班級管理
// ========================================
function renderClasses() {
    var tbody = document.getElementById('classesTableBody');
    var search = document.getElementById('classSearch').value.toLowerCase();
    var divisionFilter = document.getElementById('classDivisionFilter').value;
    
    var filtered = AppState.classes.filter(function(c) {
        var matchSearch = c.name.toLowerCase().includes(search);
        var matchDivision = !divisionFilter || c.division === divisionFilter;
        return matchSearch && matchDivision;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="empty-table-text"><i class="fas fa-users"></i><p>暫無班級資料</p></div></td></tr>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(cls) {
        var requirements = cls.requirements || [];
        var reqSummary = requirements.length > 0 ?
            requirements.map(function(r) { return getSubjectName(r.subject) + '(' + r.periods + '節)'; }).join(', ') :
            '<span style="color:#999">未設置</span>';
        
        html += '<tr><td><strong>' + cls.name + '</strong></td><td><span class="division-badge ' + cls.division + '">' + getDivisionName(cls.division) + '</span></td><td>' + cls.grade + '</td><td>' + reqSummary + '</td><td><div class="table-actions"><button class="btn-icon edit" onclick="editClass(\'' + cls.id + '\')" title="編輯"><i class="fas fa-edit"></i></button><button class="btn-icon" onclick="openRequirementsModal(\'' + cls.id + '\')" title="設置科目需求" style="background:#e8f5e9;color:#2e7d32;"><i class="fas fa-tasks"></i></button><button class="btn-icon delete" onclick="deleteClass(\'' + cls.id + '\')" title="刪除"><i class="fas fa-trash"></i></button></div></td></tr>';
    });
    tbody.innerHTML = html;
}

function updateGradeOptions() {
    var division = document.getElementById('classDivision').value;
    var gradeSelect = document.getElementById('classGrade');
    var grades = DIVISIONS[division] ? DIVISIONS[division].grades : [];
    
    var html = '<option value="">請選擇年級</option>';
    grades.forEach(function(g) { html += '<option value="' + g + '">' + g + '</option>'; });
    gradeSelect.innerHTML = html;
}

function openClassModal(classId) {
    classId = classId || null;
    var modal = document.getElementById('classModal');
    var title = document.getElementById('classModalTitle');
    var form = document.getElementById('classForm');
    
    form.reset();
    document.getElementById('classId').value = '';
    document.getElementById('classGrade').innerHTML = '<option value="">請選擇年級</option>';
    
    if (classId) {
        title.innerHTML = '<i class="fas fa-edit"></i> 編輯班級';
        var cls = AppState.classes.find(function(c) { return c.id === classId; });
        if (cls) {
            document.getElementById('classId').value = cls.id;
            document.getElementById('classDivision').value = cls.division;
            updateGradeOptions();
            document.getElementById('className').value = cls.name;
            document.getElementById('classGrade').value = cls.grade;
        }
    } else {
        title.innerHTML = '<i class="fas fa-user-friends"></i> 新增班級';
    }
    
    modal.classList.add('active');
}

function saveClass() {
    var id = document.getElementById('classId').value;
    var name = document.getElementById('className').value.trim();
    var division = document.getElementById('classDivision').value;
    var grade = document.getElementById('classGrade').value;
    
    if (!name) { showToast('請輸入班級名稱', 'error'); return; }
    if (!division) { showToast('請選擇學部', 'error'); return; }
    if (!grade) { showToast('請選擇年級', 'error'); return; }
    
    if (id) {
        var index = AppState.classes.findIndex(function(c) { return c.id === id; });
        if (index !== -1) {
            AppState.classes[index] = Object.assign({}, AppState.classes[index], { name: name, division: division, grade: grade });
        }
    } else {
        AppState.classes.push({ id: generateId(), name: name, division: division, grade: grade, requirements: [] });
    }
    
    saveData();
    markDirty();
    closeModals();
    renderAll();
    showToast(id ? '班級已更新' : '班級已添加', 'success');
}

function editClass(id) { openClassModal(id); }

function deleteClass(id) {
    if (!confirm('確定要刪除此班級嗎？')) return;
    AppState.classes = AppState.classes.filter(function(c) { return c.id !== id; });
    saveData();
    markDirty();
    renderAll();
    showToast('班級已刪除', 'success');
}

// ========================================
// 科目需求設置
// ========================================
function openRequirementsModal(classId) {
    var modal = document.getElementById('classRequirementsModal');
    var cls = AppState.classes.find(function(c) { return c.id === classId; });
    if (!cls) return;
    
    document.getElementById('classInfoBar').innerHTML = '<span class="class-name">' + cls.name + '</span><span class="division-badge ' + cls.division + '">' + getDivisionName(cls.division) + '</span><span>' + cls.grade + '</span>';
    
    var divisionTeachers = AppState.teachers.filter(function(t) { return t.division === cls.division; });
    var availableSubjects = [...new Set(divisionTeachers.flatMap(function(t) { return t.subjects; }))];
    var subjectsToShow = availableSubjects.length > 0 ? availableSubjects : AppState.subjects.map(function(s) { return s.id; });
    
    var requirements = cls.requirements || [];
    var requirementsList = document.getElementById('requirementsList');
    var html = '';
    
    subjectsToShow.forEach(function(subjId) {
        var subject = AppState.subjects.find(function(s) { return s.id === subjId; });
        if (!subject) return;
        
        var req = requirements.find(function(r) { return r.subject === subjId; });
        var periods = req ? req.periods : 0;
        var availableTeachers = divisionTeachers.filter(function(t) { return t.subjects.includes(subjId); });
        
        html += '<div class="requirement-item"><div class="requirement-subject"><span class="color-dot" style="background:' + subject.color + '"></span>' + subject.name + '</div><input type="number" class="requirement-input" data-subject="' + subjId + '" value="' + periods + '" min="0" max="20" placeholder="節數"><select class="requirement-teacher" data-subject="' + subjId + '"><option value="">自動分配</option>' + availableTeachers.map(function(t) { return '<option value="' + t.id + '"' + (req && req.teacherId === t.id ? ' selected' : '') + '>' + t.name + '</option>'; }).join('') + '</select></div>';
    });
    
    requirementsList.innerHTML = html;
    requirementsList.dataset.classId = classId;
    modal.classList.add('active');
}

function saveClassRequirements() {
    var classId = document.getElementById('requirementsList').dataset.classId;
    var cls = AppState.classes.find(function(c) { return c.id === classId; });
    if (!cls) return;
    
    var requirements = [];
    document.querySelectorAll('.requirement-item').forEach(function(item) {
        var subject = item.querySelector('.requirement-input').dataset.subject;
        var periods = parseInt(item.querySelector('.requirement-input').value) || 0;
        var teacherId = item.querySelector('.requirement-teacher').value || null;
        if (periods > 0) requirements.push({ subject: subject, periods: periods, teacherId: teacherId });
    });
    
    cls.requirements = requirements;
    saveData();
    markDirty();
    closeModals();
    renderAll();
    showToast('科目需求已保存', 'success');
}

// ========================================
// 科目管理
// ========================================
function renderSubjects() {
    var grid = document.getElementById('subjectGrid');
    
    if (AppState.subjects.length === 0) {
        grid.innerHTML = '<div class="empty-table-text" style="grid-column:1/-1;background:white;border-radius:1rem;padding:3rem;"><i class="fas fa-book-open"></i><p>暫無科目資料</p></div>';
        return;
    }
    
    var html = '';
    AppState.subjects.forEach(function(subject) {
        var teacherCount = AppState.teachers.filter(function(t) { return t.subjects.includes(subject.id); }).length;
        html += '<div class="subject-card" style="--subject-color: ' + subject.color + '"><div class="subject-card-header"><div><div class="subject-name">' + subject.name + '</div><div class="subject-code">' + subject.code + '</div></div><div class="subject-actions"><button class="btn-icon edit" onclick="editSubject(\'' + subject.id + '\')" title="編輯"><i class="fas fa-edit"></i></button><button class="btn-icon delete" onclick="deleteSubject(\'' + subject.id + '\')" title="刪除"><i class="fas fa-trash"></i></button></div></div><div style="display:flex;align-items:center;gap:0.5rem;"><span class="color-dot" style="background:' + subject.color + ';width:20px;height:20px;border-radius:4px;"></span><span style="color:#666;font-size:0.85rem;">' + teacherCount + ' 位教師任教</span></div></div>';
    });
    grid.innerHTML = html;
}

function openSubjectModal(subjectId) {
    subjectId = subjectId || null;
    var modal = document.getElementById('subjectModal');
    var title = document.getElementById('subjectModalTitle');
    var form = document.getElementById('subjectForm');
    
    form.reset();
    document.getElementById('subjectId').value = '';
    document.querySelectorAll('.color-option').forEach(function(c) { c.classList.remove('selected'); });
    document.querySelector('.color-option').classList.add('selected');
    
    if (subjectId) {
        title.innerHTML = '<i class="fas fa-edit"></i> 編輯科目';
        var subject = AppState.subjects.find(function(s) { return s.id === subjectId; });
        if (subject) {
            document.getElementById('subjectId').value = subject.id;
            document.getElementById('subjectName').value = subject.name;
            document.getElementById('subjectCode').value = subject.code;
            var opt = document.querySelector('.color-option[data-color="' + subject.color + '"]');
            if (opt) opt.classList.add('selected');
        }
    } else {
        title.innerHTML = '<i class="fas fa-book"></i> 新增科目';
    }
    
    document.querySelectorAll('.color-option').forEach(function(opt) {
        opt.addEventListener('click', function() {
            document.querySelectorAll('.color-option').forEach(function(c) { c.classList.remove('selected'); });
            opt.classList.add('selected');
        });
    });
    
    modal.classList.add('active');
}

function saveSubject() {
    var id = document.getElementById('subjectId').value;
    var name = document.getElementById('subjectName').value.trim();
    var code = document.getElementById('subjectCode').value.trim().toUpperCase();
    var colorEl = document.querySelector('.color-option.selected');
    var color = colorEl ? colorEl.dataset.color : '#4361ee';
    
    if (!name) { showToast('請輸入科目名稱', 'error'); return; }
    
    if (id) {
        var index = AppState.subjects.findIndex(function(s) { return s.id === id; });
        if (index !== -1) {
            AppState.subjects[index] = Object.assign({}, AppState.subjects[index], { name: name, code: code, color: color });
        }
    } else {
        AppState.subjects.push({ id: generateId(), name: name, code: code, color: color });
    }
    
    saveData();
    markDirty();
    closeModals();
    renderAll();
    showToast(id ? '科目已更新' : '科目已添加', 'success');
}

function editSubject(id) { openSubjectModal(id); }

function deleteSubject(id) {
    if (!confirm('確定要刪除此科目嗎？')) return;
    AppState.subjects = AppState.subjects.filter(function(s) { return s.id !== id; });
    saveData();
    markDirty();
    renderAll();
    showToast('科目已刪除', 'success');
}

// ========================================
// 會議設置
// ========================================
function renderMeetings() {
    var container = document.getElementById('meetingsGrid');
    
    var html = '<div class="meetings-list">';
    
    // 科組會議
    html += '<h3 style="grid-column:1/-1;margin:1rem 0 0.5rem 0;color:var(--gray-700);"><i class="fas fa-users-cog"></i> 科組會議</h3>';
    
    Object.entries(DEPARTMENTS).forEach(function(entry) {
        var deptId = entry[0];
        var dept = entry[1];
        
        if (deptId === 'other') return; // 跳过"其他科组"
        
        var meeting = AppState.departmentMeetings[deptId] || { day: '', startPeriod: '', endPeriod: '' };
        
        html += '<div class="meeting-item card" style="margin-bottom:1rem;">';
        html += '<div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">';
        html += '<h4 style="display:flex;align-items:center;gap:0.5rem;margin:0;">';
        html += '<i class="fas ' + dept.icon + '" style="color:' + dept.color + ';"></i> ';
        html += '<span>' + dept.name + '</span>';
        html += '</h4>';
        html += '<span class="department-badge" style="background:' + dept.color + '20;color:' + dept.color + ';">';
        html += '<i class="fas ' + dept.icon + '"></i>';
        html += '</span>';
        html += '</div>';
        html += '<div class="card-body">';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;align-items:end;">';
        
        // 星期选择
        html += '<div class="form-group" style="margin-bottom:0;">';
        html += '<label>會議星期</label>';
        html += '<select id="meeting_day_' + deptId + '" class="meeting-select">';
        html += '<option value="">-- 不設置會議 --</option>';
        for (var d = 0; d < AppState.settings.daysPerWeek; d++) {
            html += '<option value="' + d + '"' + (meeting.day == d ? ' selected' : '') + '>' + DAY_NAMES[d] + '</option>';
        }
        html += '</select>';
        html += '</div>';
        
        // 开始节
        html += '<div class="form-group" style="margin-bottom:0;">';
        html += '<label>開始節數</label>';
        html += '<select id="meeting_start_' + deptId + '" class="meeting-select">';
        html += '<option value="">--</option>';
        for (var p = 1; p <= 9; p++) {
            html += '<option value="' + p + '"' + (meeting.startPeriod == p ? ' selected' : '') + '>第 ' + p + ' 節</option>';
        }
        html += '</select>';
        html += '</div>';
        
        // 结束节
        html += '<div class="form-group" style="margin-bottom:0;">';
        html += '<label>結束節數</label>';
        html += '<select id="meeting_end_' + deptId + '" class="meeting-select">';
        html += '<option value="">--</option>';
        for (var p2 = 1; p2 <= 9; p2++) {
            html += '<option value="' + p2 + '"' + (meeting.endPeriod == p2 ? ' selected' : '') + '>第 ' + p2 + ' 節</option>';
        }
        html += '</select>';
        html += '</div>';
        
        html += '</div>';
        html += '</div>';
        html += '</div>';
    });
    
    // 自定義會議
    html += '<h3 style="grid-column:1/-1;margin:2rem 0 0.5rem 0;color:var(--gray-700);"><i class="fas fa-calendar-plus"></i> 自定義會議</h3>';
    
    if (AppState.customMeetings && AppState.customMeetings.length > 0) {
        AppState.customMeetings.forEach(function(meeting, index) {
            html += '<div class="meeting-item card" style="margin-bottom:1rem;border-left:4px solid ' + meeting.color + ';">';
            html += '<div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">';
            html += '<h4 style="display:flex;align-items:center;gap:0.5rem;margin:0;">';
            html += '<i class="fas ' + meeting.icon + '" style="color:' + meeting.color + ';"></i> ';
            html += '<span>' + meeting.name + '</span>';
            html += '</h4>';
            html += '<div style="display:flex;gap:0.5rem;">';
            html += '<button class="btn-icon edit" onclick="editCustomMeeting(' + index + ')" title="編輯"><i class="fas fa-edit"></i></button>';
            html += '<button class="btn-icon delete" onclick="deleteCustomMeeting(' + index + ')" title="刪除"><i class="fas fa-trash"></i></button>';
            html += '</div>';
            html += '</div>';
            html += '<div class="card-body">';
            html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;align-items:end;">';
            
            // 星期选择
            html += '<div class="form-group" style="margin-bottom:0;">';
            html += '<label>會議星期</label>';
            html += '<select id="custom_meeting_day_' + index + '" class="meeting-select">';
            html += '<option value="">-- 不設置會議 --</option>';
            for (var d2 = 0; d2 < AppState.settings.daysPerWeek; d2++) {
                html += '<option value="' + d2 + '"' + (meeting.day == d2 ? ' selected' : '') + '>' + DAY_NAMES[d2] + '</option>';
            }
            html += '</select>';
            html += '</div>';
            
            // 开始节
            html += '<div class="form-group" style="margin-bottom:0;">';
            html += '<label>開始節數</label>';
            html += '<select id="custom_meeting_start_' + index + '" class="meeting-select">';
            html += '<option value="">--</option>';
            for (var p3 = 1; p3 <= 9; p3++) {
                html += '<option value="' + p3 + '"' + (meeting.startPeriod == p3 ? ' selected' : '') + '>第 ' + p3 + ' 節</option>';
            }
            html += '</select>';
            html += '</div>';
            
            // 结束节
            html += '<div class="form-group" style="margin-bottom:0;">';
            html += '<label>結束節數</label>';
            html += '<select id="custom_meeting_end_' + index + '" class="meeting-select">';
            html += '<option value="">--</option>';
            for (var p4 = 1; p4 <= 9; p4++) {
                html += '<option value="' + p4 + '"' + (meeting.endPeriod == p4 ? ' selected' : '') + '>第 ' + p4 + ' 節</option>';
            }
            html += '</select>';
            html += '</div>';
            
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });
    }
    
    // 新增會議按鈕
    html += '<div class="meeting-item card" style="margin-bottom:1rem;border:2px dashed var(--gray-400);background:var(--gray-50);cursor:pointer;" onclick="openCustomMeetingModal()">';
    html += '<div class="card-body" style="text-align:center;padding:2rem;">';
    html += '<i class="fas fa-plus-circle" style="font-size:2rem;color:var(--gray-400);margin-bottom:0.5rem;"></i>';
    html += '<p style="color:var(--gray-600);margin:0;font-weight:500;">新增自定義會議</p>';
    html += '<small style="color:var(--gray-500);">點擊添加新的會議時間</small>';
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    container.innerHTML = html;
}

function saveMeetings() {
    var meetings = {};
    
    // 保存科组会议
    Object.keys(DEPARTMENTS).forEach(function(deptId) {
        if (deptId === 'other') return;
        
        var dayEl = document.getElementById('meeting_day_' + deptId);
        var startEl = document.getElementById('meeting_start_' + deptId);
        var endEl = document.getElementById('meeting_end_' + deptId);
        
        if (dayEl && startEl && endEl && dayEl.value) {
            meetings[deptId] = {
                day: parseInt(dayEl.value),
                startPeriod: parseInt(startEl.value) || 1,
                endPeriod: parseInt(endEl.value) || parseInt(startEl.value) || 1
            };
        }
    });
    
    AppState.departmentMeetings = meetings;
    
    // 保存自定义会议
    if (AppState.customMeetings && AppState.customMeetings.length > 0) {
        AppState.customMeetings.forEach(function(meeting, index) {
            var dayEl = document.getElementById('custom_meeting_day_' + index);
            var startEl = document.getElementById('custom_meeting_start_' + index);
            var endEl = document.getElementById('custom_meeting_end_' + index);
            
            if (dayEl && startEl && endEl && dayEl.value) {
                meeting.day = parseInt(dayEl.value);
                meeting.startPeriod = parseInt(startEl.value) || 1;
                meeting.endPeriod = parseInt(endEl.value) || parseInt(startEl.value) || 1;
            }
        });
    }
    
    saveData();
    markDirty();
    showToast('會議時間已保存', 'success');
}

function openCustomMeetingModal(meetingIndex) {
    meetingIndex = meetingIndex !== undefined ? meetingIndex : null;
    
    var modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'customMeetingModal';
    
    var meeting = meetingIndex !== null && AppState.customMeetings ? 
        AppState.customMeetings[meetingIndex] : { name: '', icon: 'fa-calendar', color: '#3498db', day: '', startPeriod: '', endPeriod: '' };
    
    var icons = ['fa-calendar', 'fa-users', 'fa-chalkboard', 'fa-handshake', 'fa-briefcase', 'fa-clipboard', 'fa-tasks', 'fa-comments'];
    var colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
    
    var html = '<div class="modal-overlay" onclick="closeCustomMeetingModal()"></div>';
    html += '<div class="modal-content">';
    html += '<div class="modal-header">';
    html += '<h3><i class="fas fa-calendar-plus"></i> ' + (meetingIndex !== null ? '編輯自定義會議' : '新增自定義會議') + '</h3>';
    html += '<button class="modal-close" onclick="closeCustomMeetingModal()">&times;</button>';
    html += '</div>';
    html += '<div class="modal-body">';
    html += '<form id="customMeetingForm">';
    html += '<input type="hidden" id="customMeetingIndex" value="' + (meetingIndex !== null ? meetingIndex : '') + '">';
    
    // 会议名称
    html += '<div class="form-group">';
    html += '<label>會議名稱 <span class="required">*</span></label>';
    html += '<input type="text" id="customMeetingName" value="' + (meeting.name || '') + '" required placeholder="例如：教職員會議、家長會等">';
    html += '</div>';
    
    // 图标选择
    html += '<div class="form-group">';
    html += '<label>圖標</label>';
    html += '<div class="icon-picker">';
    icons.forEach(function(icon) {
        html += '<span class="icon-option ' + (meeting.icon === icon ? 'selected' : '') + '" data-icon="' + icon + '" onclick="selectIcon(this)">';
        html += '<i class="fas ' + icon + '"></i>';
        html += '</span>';
    });
    html += '</div>';
    html += '</div>';
    
    // 颜色选择
    html += '<div class="form-group">';
    html += '<label>顏色</label>';
    html += '<div class="color-picker">';
    colors.forEach(function(color) {
        html += '<span class="color-option ' + (meeting.color === color ? 'selected' : '') + '" data-color="' + color + '" style="background:' + color + ';" onclick="selectColor(this)"></span>';
    });
    html += '</div>';
    html += '</div>';
    
    // 会议时间
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;">';
    
    // 星期
    html += '<div class="form-group">';
    html += '<label>會議星期 <span class="required">*</span></label>';
    html += '<select id="customMeetingDay">';
    html += '<option value="">請選擇</option>';
    for (var d = 0; d < AppState.settings.daysPerWeek; d++) {
        html += '<option value="' + d + '"' + (meeting.day == d ? ' selected' : '') + '>' + DAY_NAMES[d] + '</option>';
    }
    html += '</select>';
    html += '</div>';
    
    // 开始节
    html += '<div class="form-group">';
    html += '<label>開始節數 <span class="required">*</span></label>';
    html += '<select id="customMeetingStart">';
    html += '<option value="">請選擇</option>';
    for (var p = 1; p <= 9; p++) {
        html += '<option value="' + p + '"' + (meeting.startPeriod == p ? ' selected' : '') + '>第 ' + p + ' 節</option>';
    }
    html += '</select>';
    html += '</div>';
    
    // 结束节
    html += '<div class="form-group">';
    html += '<label>結束節數 <span class="required">*</span></label>';
    html += '<select id="customMeetingEnd">';
    html += '<option value="">請選擇</option>';
    for (var p2 = 1; p2 <= 9; p2++) {
        html += '<option value="' + p2 + '"' + (meeting.endPeriod == p2 ? ' selected' : '') + '>第 ' + p2 + ' 節</option>';
    }
    html += '</select>';
    html += '</div>';
    
    html += '</div>';
    html += '</form>';
    html += '</div>';
    html += '<div class="modal-footer">';
    html += '<button class="btn btn-secondary" onclick="closeCustomMeetingModal()">取消</button>';
    html += '<button class="btn btn-primary" onclick="saveCustomMeeting()"><i class="fas fa-save"></i> 儲存</button>';
    html += '</div>';
    html += '</div>';
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

function selectIcon(element) {
    document.querySelectorAll('.icon-option').forEach(function(el) { el.classList.remove('selected'); });
    element.classList.add('selected');
}

function selectColor(element) {
    document.querySelectorAll('.color-option').forEach(function(el) { el.classList.remove('selected'); });
    element.classList.add('selected');
}

function closeCustomMeetingModal() {
    var modal = document.getElementById('customMeetingModal');
    if (modal) modal.remove();
}

function saveCustomMeeting() {
    var index = document.getElementById('customMeetingIndex').value;
    var name = document.getElementById('customMeetingName').value.trim();
    var day = document.getElementById('customMeetingDay').value;
    var startPeriod = document.getElementById('customMeetingStart').value;
    var endPeriod = document.getElementById('customMeetingEnd').value;
    var iconEl = document.querySelector('.icon-option.selected');
    var colorEl = document.querySelector('.color-option.selected');
    
    if (!name) { showToast('請輸入會議名稱', 'error'); return; }
    if (!day) { showToast('請選擇會議星期', 'error'); return; }
    if (!startPeriod) { showToast('請選擇開始節數', 'error'); return; }
    if (!endPeriod) { showToast('請選擇結束節數', 'error'); return; }
    
    var meetingData = {
        id: 'custom_' + Date.now(),
        name: name,
        icon: iconEl ? iconEl.dataset.icon : 'fa-calendar',
        color: colorEl ? colorEl.dataset.color : '#3498db',
        day: parseInt(day),
        startPeriod: parseInt(startPeriod),
        endPeriod: parseInt(endPeriod)
    };
    
    if (!AppState.customMeetings) AppState.customMeetings = [];
    
    if (index !== '') {
        AppState.customMeetings[parseInt(index)] = meetingData;
        showToast('會議已更新', 'success');
    } else {
        AppState.customMeetings.push(meetingData);
        showToast('會議已添加', 'success');
    }
    
    saveData();
    markDirty();
    closeCustomMeetingModal();
    renderMeetings();
}

function editCustomMeeting(index) {
    openCustomMeetingModal(index);
}

function deleteCustomMeeting(index) {
    if (!confirm('確定要刪除此會議嗎？')) return;
    
    if (AppState.customMeetings) {
        AppState.customMeetings.splice(index, 1);
        saveData();
        markDirty();
        renderMeetings();
        showToast('會議已刪除', 'success');
    }
}

// ========================================
// 排課引擎
// ========================================
function renderScheduleSettings() {
    document.getElementById('periodsPerDay').value = AppState.settings.periodsPerDay;
    document.getElementById('daysPerWeek').value = AppState.settings.daysPerWeek;
    document.getElementById('priorityStrategy').value = AppState.settings.priorityStrategy;
    document.getElementById('maxAttempts').value = AppState.settings.maxAttempts;
}

async function generateSchedule() {
    if (AppState.classes.length === 0) { showToast('請先添加班級', 'error'); return; }
    if (AppState.teachers.length === 0) { showToast('請先添加教師', 'error'); return; }
    
    var progressEl = document.getElementById('scheduleProgress');
    var resultEl = document.getElementById('scheduleResult');
    var progressFill = document.getElementById('progressFill');
    var progressText = document.getElementById('progressText');
    var progressPercent = document.getElementById('progressPercent');
    
    progressEl.style.display = 'block';
    resultEl.style.display = 'none';
    
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var days = AppState.settings.daysPerWeek;
    var strategy = AppState.settings.priorityStrategy;
    var maxAttempts = AppState.settings.maxAttempts;
    
    AppState.schedules = [];
    
    var classSchedules = {};
    AppState.classes.forEach(function(cls) {
        classSchedules[cls.id] = { classId: cls.id, className: cls.name, division: cls.division, slots: {} };
        for (var d = 0; d < days; d++) {
            var dayPeriods = periodsPerDayOfWeek[d] || 9;
            for (var p = 1; p <= dayPeriods; p++) {
                classSchedules[cls.id].slots[d + '_' + p] = null;
            }
        }
    });
    
    var teacherSchedules = {};
    AppState.teachers.forEach(function(t) {
        teacherSchedules[t.id] = {};
        for (var d = 0; d < days; d++) teacherSchedules[t.id][d] = [];
    });
    
    // ========================================
    // 步驟 0: 標記教師會議時間和特殊活動
    // ========================================
    var teacherMeetings = {};
    AppState.teachers.forEach(function(teacher) {
        teacherMeetings[teacher.id] = [];
        
        // 检查教师所属的每个科组
        if (teacher.departments && teacher.departments.length > 0) {
            teacher.departments.forEach(function(deptId) {
                var meeting = AppState.departmentMeetings[deptId];
                if (meeting && meeting.day !== undefined) {
                    // 记录会议时间
                    for (var p = meeting.startPeriod; p <= meeting.endPeriod; p++) {
                        teacherMeetings[teacher.id].push({
                            day: meeting.day,
                            period: p,
                            deptId: deptId,
                            deptName: DEPARTMENTS[deptId] ? DEPARTMENTS[deptId].name : deptId
                        });
                        // 标记为不可用
                        teacherSchedules[teacher.id][meeting.day].push(p);
                    }
                }
            });
        }
        
        // 檢查小學餘暇活動 - 週五第8-9節
        if (teacher.primaryLeisure) {
            // 週五 = day 4
            var fridayDay = 4;
            for (var pp = 8; pp <= 9; pp++) {
                teacherMeetings[teacher.id].push({
                    day: fridayDay,
                    period: pp,
                    deptId: 'primary-leisure',
                    deptName: '小學餘暇活動'
                });
                // 标记为不可用
                teacherSchedules[teacher.id][fridayDay].push(pp);
            }
        }
        
        // 檢查自定義會議
        if (teacher.customMeetings && teacher.customMeetings.length > 0 && AppState.customMeetings) {
            teacher.customMeetings.forEach(function(customMeetingId) {
                var customMeeting = AppState.customMeetings.find(function(m) { return m.id === customMeetingId; });
                if (customMeeting && customMeeting.day !== undefined) {
                    for (var p2 = customMeeting.startPeriod; p2 <= customMeeting.endPeriod; p2++) {
                        teacherMeetings[teacher.id].push({
                            day: customMeeting.day,
                            period: p2,
                            deptId: customMeeting.id,
                            deptName: customMeeting.name,
                            isCustom: true
                        });
                        teacherSchedules[teacher.id][customMeeting.day].push(p2);
                    }
                }
            });
        }
    });
    
    // ========================================
    // 步驟 1: 先排班主任課（每週五第二節）
    // ========================================
    var homeroomTeachers = AppState.teachers.filter(function(t) { return t.isHomeroomTeacher && t.homeroomClass; });
    
    homeroomTeachers.forEach(function(teacher) {
        var classId = teacher.homeroomClass;
        var cls = AppState.classes.find(function(c) { return c.id === classId; });
        
        if (cls && classSchedules[classId]) {
            // 週五 = day 4, 第二節 = period 2
            var day = 4;
            var period = 2;
            var key = day + '_' + period;
            
            // 檢查該時間段是否存在（週五有 9 節課，第二節肯定存在）
            if (classSchedules[classId].slots.hasOwnProperty(key)) {
                classSchedules[classId].slots[key] = {
                    subject: 'homeroom',
                    subjectName: '班主任課',
                    teacherId: teacher.id,
                    teacherName: teacher.name
                };
                teacherSchedules[teacher.id][day].push(period);
            }
        }
    });
    
    // ========================================
    // 步驟 2: 排其他課程
    // ========================================
    
    function parseConstraints(constraintText) {
        if (!constraintText) return [];
        var constraints = [];
        var morningMatch = constraintText.match(/早上第?([0-9-]+)節不能排課/i);
        if (morningMatch) {
            var nums = parseRange(morningMatch[1]);
            nums.forEach(function(n) { constraints.push({ type: 'forbid', day: 'morning', period: n }); });
        }
        if (/下午不能排課/i.test(constraintText)) {
            for (var d = 0; d < days; d++) {
                var dayPeriods = periodsPerDayOfWeek[d] || 9;
                var afternoonStart = Math.ceil(dayPeriods * 0.6);
                for (var p = afternoonStart; p <= dayPeriods; p++) {
                    constraints.push({ type: 'forbid', day: d, period: p });
                }
            }
        }
        if (/單數節不能排課/i.test(constraintText)) {
            for (var d2 = 0; d2 < days; d2++) {
                var dayPeriods2 = periodsPerDayOfWeek[d2] || 9;
                for (var p2 = 1; p2 <= dayPeriods2; p2 += 2) {
                    constraints.push({ type: 'forbid', day: d2, period: p2 });
                }
            }
        }
        if (/雙數節不能排課/i.test(constraintText)) {
            for (var d3 = 0; d3 < days; d3++) {
                var dayPeriods3 = periodsPerDayOfWeek[d3] || 9;
                for (var p3 = 2; p3 <= dayPeriods3; p3 += 2) {
                    constraints.push({ type: 'forbid', day: d3, period: p3 });
                }
            }
        }
        return constraints;
    }
    
    function parseRange(str) {
        var nums = [];
        if (str.indexOf('-') !== -1) {
            var parts = str.split('-');
            for (var i = parseInt(parts[0]); i <= parseInt(parts[1]); i++) nums.push(i);
        } else {
            nums.push(parseInt(str));
        }
        return nums;
    }
    
    function isConstrained(teacher, day, period) {
        var constraints = parseConstraints(teacher.constraints);
        
        for (var i = 0; i < constraints.length; i++) {
            var c = constraints[i];
            if (c.type === 'forbid') {
                if (c.day === day && c.period === period) return true;
                if (c.day === 'morning') {
                    var dayPeriods = periodsPerDayOfWeek[day] || 9;
                    var morningEnd = Math.ceil(dayPeriods * 0.4);
                    if (period <= morningEnd && c.period === period) return true;
                }
            }
        }
        
        var avail = teacher.availability ? teacher.availability[day + '_' + period] : undefined;
        return avail === false;
    }
    
    var filledSlots = 0;
    
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
        var classesWithReq = AppState.classes
            .filter(function(cls) { return cls.requirements && cls.requirements.length > 0; })
            .sort(function() { return Math.random() - 0.5; });
        
        var allFilled = true;
        
        for (var ci = 0; ci < classesWithReq.length; ci++) {
            var cls = classesWithReq[ci];
            var schedule = classSchedules[cls.id];
            var requirements = cls.requirements || [];
            
            for (var ri = 0; ri < requirements.length; ri++) {
                var req = requirements[ri];
                var remaining = req.periods;
                
                // 收集所有可用時間段
                var slots = [];
                for (var d = 0; d < days; d++) {
                    var dayPeriods = periodsPerDayOfWeek[d] || 9;
                    for (var p = 1; p <= dayPeriods; p++) {
                        if (!schedule.slots[d + '_' + p]) {
                            slots.push({ day: d, period: p, score: calculateSlotScore(d, p, strategy, dayPeriods) });
                        }
                    }
                }
                
                slots.sort(function(a, b) { return b.score - a.score; });
                
                var assignedTeacher = null;
                
                if (req.teacherId) {
                    var teacher = AppState.teachers.find(function(t) { return t.id === req.teacherId; });
                    if (teacher && teacher.subjects.includes(req.subject)) {
                        for (var si = 0; si < slots.length; si++) {
                            var slot = slots[si];
                            if (!isConstrained(teacher, slot.day, slot.period) &&
                                !teacherSchedules[teacher.id][slot.day].includes(slot.period)) {
                                assignedTeacher = teacher;
                                break;
                            }
                        }
                    }
                } else {
                    var eligibleTeachers = AppState.teachers
                        .filter(function(t) { return t.division === cls.division && t.subjects.includes(req.subject); })
                        .map(function(t) { return { teacher: t, load: teacherSchedules[t.id].flat().length }; })
                        .sort(function(a, b) { return a.load - b.load; });
                    
                    for (var eti = 0; eti < eligibleTeachers.length; eti++) {
                        var tData = eligibleTeachers[eti].teacher;
                        for (var si2 = 0; si2 < slots.length; si2++) {
                            var slot2 = slots[si2];
                            if (!isConstrained(tData, slot2.day, slot2.period) &&
                                !teacherSchedules[tData.id][slot2.day].includes(slot2.period)) {
                                assignedTeacher = tData;
                                break;
                            }
                        }
                        if (assignedTeacher) break;
                    }
                }
                
                if (assignedTeacher) {
                    for (var sj = 0; sj < slots.length; sj++) {
                        var s = slots[sj];
                        if (!schedule.slots[s.day + '_' + s.period] &&
                            !isConstrained(assignedTeacher, s.day, s.period) &&
                            !teacherSchedules[assignedTeacher.id][s.day].includes(s.period)) {
                            
                            schedule.slots[s.day + '_' + s.period] = { 
                                subject: req.subject, 
                                teacherId: assignedTeacher.id, 
                                teacherName: assignedTeacher.name 
                            };
                            teacherSchedules[assignedTeacher.id][s.day].push(s.period);
                            remaining--;
                            filledSlots++;
                            break;
                        }
                    }
                }
                
                if (remaining > 0) allFilled = false;
            }
        }
        
        var progress = Math.min(100, Math.round((attempt / maxAttempts) * 100));
        progressFill.style.width = progress + '%';
        progressPercent.textContent = progress + '%';
        progressText.textContent = '正在排課... 第 ' + (attempt + 1) + ' 次嘗試';
        
        await new Promise(function(r) { setTimeout(r, 10); });
        
        if (allFilled) break;
    }
    
    AppState.schedules = Object.values(classSchedules);
    AppState.teacherMeetings = teacherMeetings;
    saveData();
    markDirty();  // 標記為有未保存變更
    
    progressFill.style.width = '100%';
    progressPercent.textContent = '100%';
    progressText.textContent = '排課完成！';
    
    setTimeout(function() {
        progressEl.style.display = 'none';
        resultEl.style.display = 'block';
        
        var resultBody = document.getElementById('scheduleResultBody');
        var totalRequired = AppState.classes.reduce(function(sum, cls) {
            return sum + (cls.requirements || []).reduce(function(s, r) { return s + r.periods; }, 0);
        }, 0);
        
        // 加上班主任課
        totalRequired += homeroomTeachers.length;
        
        var filledCount = Object.values(classSchedules)
            .flatMap(function(s) { return Object.values(s.slots); })
            .filter(function(v) { return v !== null; }).length;
        
        var successRate = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;
        
        resultBody.innerHTML = '<div style="display:flex;align-items:center;gap:1rem;padding:1rem;"><i class="fas fa-check-circle" style="font-size:3rem;color:var(--success)"></i><div><h4 style="margin-bottom:0.5rem;">排課完成！</h4><p>已為 ' + AppState.schedules.length + ' 個班級生成課表</p><p>班主任課：' + homeroomTeachers.length + ' 節</p><p>成功率: <strong class="' + (successRate >= 80 ? 'result-success' : 'result-warning') + '">' + successRate + '%</strong></p></div></div>';
        
        renderAll();
        showToast('課表已生成，成功率 ' + successRate + '%', successRate >= 80 ? 'success' : 'warning');
    }, 500);
}

function calculateSlotScore(day, period, strategy, totalPeriods) {
    var score = 5;
    var morningEnd = Math.ceil(totalPeriods * 0.4);
    var afternoonStart = Math.ceil(totalPeriods * 0.6);
    
    switch (strategy) {
        case 'morning': score = period <= morningEnd ? 10 : 1; break;
        case 'afternoon': score = period >= afternoonStart ? 10 : 1; break;
        case 'spread': score = (period === morningEnd || period === afternoonStart) ? 10 : 5; break;
    }
    
    score += Math.random() * 2;
    return score;
}

// ========================================
// 衝突檢測
// ========================================
function detectConflicts() {
    var conflictsEl = document.getElementById('conflictsResult');
    conflictsEl.style.display = 'block';
    var conflicts = [];
    
    var teacherTime = {};
    AppState.schedules.forEach(function(schedule) {
        Object.entries(schedule.slots).forEach(function(entry) {
            var key = entry[0];
            var value = entry[1];
            if (value) {
                var parts = key.split('_');
                var day = parts[0];
                var period = parts[1];
                var tKey = value.teacherId + '_' + day + '_' + period;
                if (teacherTime[tKey]) {
                    conflicts.push({ type: 'teacher_conflict', teacher: value.teacherName, day: day, period: period, classes: [teacherTime[tKey], schedule.className] });
                }
                teacherTime[tKey] = schedule.className;
            }
        });
    });
    
    var teacherLoads = {};
    AppState.schedules.forEach(function(schedule) {
        Object.values(schedule.slots).forEach(function(slot) {
            if (slot) teacherLoads[slot.teacherId] = (teacherLoads[slot.teacherId] || 0) + 1;
        });
    });
    
    var loads = Object.values(teacherLoads);
    if (loads.length > 1) {
        var maxLoad = Math.max.apply(null, loads);
        var minLoad = Math.min.apply(null, loads);
        if (maxLoad > minLoad * 2) {
            var maxEntry = Object.entries(teacherLoads).find(function(e) { return e[1] === maxLoad; });
            if (maxEntry) conflicts.push({ type: 'workload_imbalance', teacher: getTeacherName(maxEntry[0]), max: maxLoad, min: minLoad });
        }
    }
    
    var resultBody = document.getElementById('conflictsResultBody');
    if (conflicts.length === 0) {
        resultBody.innerHTML = '<div style="text-align:center;padding:2rem;"><i class="fas fa-check-circle" style="font-size:4rem;color:var(--success);margin-bottom:1rem;"></i><h4>沒有發現衝突</h4><p style="color:#666;">課表已通過所有檢查</p></div>';
    } else {
        var html = '<div style="padding:1rem 0;">';
        conflicts.forEach(function(c) {
            if (c.type === 'teacher_conflict') {
                html += '<div style="padding:1rem;background:#ffebee;border-radius:0.5rem;margin-bottom:0.5rem;"><strong style="color:#c62828;"><i class="fas fa-exclamation-triangle"></i> 教師衝突</strong><p>教師 <strong>' + c.teacher + '</strong> 在 ' + DAY_NAMES[c.day] + ' 第 ' + c.period + ' 節同時教授 ' + c.classes.join(' 和 ') + '</p></div>';
            } else if (c.type === 'workload_imbalance') {
                html += '<div style="padding:1rem;background:#fff3e0;border-radius:0.5rem;margin-bottom:0.5rem;"><strong style="color:#e65100;"><i class="fas fa-balance-scale"></i> 工作量不平衡</strong><p>教師 <strong>' + c.teacher + '</strong> 授課 ' + c.max + ' 節，與最少教師相差過大</p></div>';
            }
        });
        resultBody.innerHTML = html + '</div>';
    }
}

// ========================================
// 課表查看
// ========================================
function updateViewFilters() {
    var viewType = document.querySelector('.toggle-btn.active') ? document.querySelector('.toggle-btn.active').dataset.view : 'class';
    var classFilterRow = document.getElementById('classFilterRow');
    var teacherFilterRow = document.getElementById('teacherFilterRow');
    
    if (viewType === 'teacher') {
        teacherFilterRow.style.display = 'block';
        classFilterRow.style.display = 'none';
    } else {
        teacherFilterRow.style.display = 'none';
        classFilterRow.style.display = 'flex';
    }
    
    updateClassFilter();
    updateTeacherFilter();
}

function updateClassFilter() {
    var division = document.getElementById('viewDivisionFilter').value;
    var classSelect = document.getElementById('viewClassFilter');
    var filtered = division ? AppState.classes.filter(function(c) { return c.division === division; }) : AppState.classes;
    var html = '<option value="">所有班級</option>';
    filtered.forEach(function(c) { html += '<option value="' + c.id + '">' + c.name + '</option>'; });
    classSelect.innerHTML = html;
}

function updateTeacherFilter() {
    var teacherSelect = document.getElementById('viewTeacherFilter');
    var html = '<option value="">所有教師</option>';
    AppState.teachers.forEach(function(t) { html += '<option value="' + t.id + '">' + t.name + '</option>'; });
    teacherSelect.innerHTML = html;
}

function renderScheduleView() {
    var display = document.getElementById('scheduleDisplay');
    var viewType = document.querySelector('.toggle-btn.active') ? document.querySelector('.toggle-btn.active').dataset.view : 'class';
    
    if (AppState.schedules.length === 0) {
        display.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><h3>暫無課表</h3><p>請先在「排課引擎」中生成課表</p></div>';
        return;
    }
    
    if (viewType === 'class') renderClassView(display);
    else if (viewType === 'teacher') renderTeacherView(display);
    else renderDivisionView(display);
}

function renderClassView(container) {
    var classId = document.getElementById('viewClassFilter').value;
    var schedules = classId ? AppState.schedules.filter(function(s) { return s.classId === classId; }) : AppState.schedules;
    
    if (schedules.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>沒有找到課表</h3><p>嘗試選擇不同的班級或學部</p></div>';
        return;
    }
    
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var days = AppState.settings.daysPerWeek;
    var maxPeriods = Math.max.apply(null, Object.values(periodsPerDayOfWeek));
    var html = '';
    
    schedules.forEach(function(schedule) {
        html += '<div class="schedule-title"><h3><i class="fas fa-calendar"></i> ' + schedule.className + '</h3><span>' + getDivisionName(schedule.division) + '</span></div><div class="schedule-grid"><table class="timetable"><thead><tr><th></th>';
        for (var d = 0; d < days; d++) {
            var dayPeriods = periodsPerDayOfWeek[d] || maxPeriods;
            html += '<th>' + DAY_NAMES[d] + '<br><small style="font-size:0.7rem;color:#666;">(' + dayPeriods + '節)</small></th>';
        }
        html += '</tr></thead><tbody>';
        
        for (var p = 0; p < maxPeriods; p++) {
            html += '<tr><td>第 ' + (p + 1) + ' 節</td>';
            for (var d2 = 0; d2 < days; d2++) {
                var dayPeriods = periodsPerDayOfWeek[d2] || maxPeriods;
                if (p + 1 > dayPeriods) {
                    html += '<td style="background:#e0e0e0;color:#999;">-</td>';
                } else {
                    var slot = schedule.slots[d2 + '_' + (p + 1)];
                    if (slot) {
                        var color = slot.subject === 'homeroom' ? '#9b59b6' : getSubjectColor(slot.subject);
                        var subjectName = slot.subject === 'homeroom' ? '班主任課' : getSubjectName(slot.subject);
                        html += '<td><div class="lesson-cell" style="background:' + color + '"><span class="lesson-subject">' + subjectName + '</span><span class="lesson-teacher">' + slot.teacherName + '</span></div></td>';
                    } else {
                        html += '<td><div class="lesson-cell" style="background:#f5f5f5;color:#999">-</div></td>';
                    }
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';
    });
    
    container.innerHTML = html;
}

function renderTeacherView(container) {
    var teacherId = document.getElementById('viewTeacherFilter').value;
    var teacherTimetables = {};
    
    AppState.schedules.forEach(function(schedule) {
        Object.entries(schedule.slots).forEach(function(entry) {
            var key = entry[0];
            var slot = entry[1];
            if (slot && (!teacherId || slot.teacherId === teacherId)) {
                if (!teacherTimetables[slot.teacherId]) teacherTimetables[slot.teacherId] = { teacherName: slot.teacherName, slots: {} };
                teacherTimetables[slot.teacherId].slots[schedule.className + '_' + key] = { subject: slot.subject, className: schedule.className, day: key.split('_')[0], period: key.split('_')[1] };
            }
        });
    });
    
    if (Object.keys(teacherTimetables).length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-chalkboard-teacher"></i><h3>沒有找到教師課表</h3><p>請選擇不同的教師或先生成課表</p></div>';
        return;
    }
    
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var days = AppState.settings.daysPerWeek;
    var maxPeriods = Math.max.apply(null, Object.values(periodsPerDayOfWeek));
    var html = '';
    
    Object.entries(teacherTimetables).forEach(function(entry) {
        var tid = entry[0];
        var tt = entry[1];
        html += '<div class="schedule-title"><h3><i class="fas fa-chalkboard-teacher"></i> ' + tt.teacherName + '</h3><span>教師課表</span></div><div class="schedule-grid"><table class="timetable"><thead><tr><th></th>';
        for (var d = 0; d < days; d++) {
            var dayPeriods = periodsPerDayOfWeek[d] || maxPeriods;
            html += '<th>' + DAY_NAMES[d] + '<br><small style="font-size:0.7rem;color:#666;">(' + dayPeriods + '節)</small></th>';
        }
        html += '</tr></thead><tbody>';
        
        for (var p = 0; p < maxPeriods; p++) {
            html += '<tr><td>第 ' + (p + 1) + ' 節</td>';
            for (var d2 = 0; d2 < days; d2++) {
                var dayPeriods = periodsPerDayOfWeek[d2] || maxPeriods;
                if (p + 1 > dayPeriods) {
                    html += '<td style="background:#e0e0e0;color:#999;">-</td>';
                } else {
                    // 检查是否有会议
                    var meetingInfo = null;
                    if (AppState.teacherMeetings && AppState.teacherMeetings[tid]) {
                        var meeting = AppState.teacherMeetings[tid].find(function(m) {
                            return m.day == d2 && m.period == (p + 1);
                        });
                        if (meeting) {
                            meetingInfo = meeting;
                        }
                    }
                    
                    var daySlots = Object.values(tt.slots).filter(function(s) { return s.day == d2 && s.period == (p + 1); });
                    
                    if (meetingInfo) {
                        // 显示会议
                        var deptInfo = DEPARTMENTS[meetingInfo.deptId] || { color: '#3498db', icon: 'fa-calendar' };
                        var displayColor = meetingInfo.deptId === 'primary-leisure' ? '#ff9800' : deptInfo.color;
                        var displayIcon = meetingInfo.deptId === 'primary-leisure' ? 'fa-gamepad' : deptInfo.icon;
                        html += '<td><div class="lesson-cell" style="background:' + displayColor + ';border:2px dashed #fff;"><span class="lesson-subject"><i class="fas ' + displayIcon + '"></i> ' + meetingInfo.deptName + '</span><span class="lesson-teacher">會議</span></div></td>';
                    } else if (daySlots.length > 0) {
                        var s = daySlots[0];
                        var color = s.subject === 'homeroom' ? '#9b59b6' : getSubjectColor(s.subject);
                        var subjectName = s.subject === 'homeroom' ? '班主任課' : getSubjectName(s.subject);
                        html += '<td><div class="lesson-cell" style="background:' + color + '"><span class="lesson-subject">' + subjectName + '</span><span class="lesson-teacher">' + s.className + '</span></div></td>';
                    } else {
                        html += '<td><div class="lesson-cell" style="background:#f5f5f5;color:#999">-</div></td>';
                    }
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';
    });
    
    container.innerHTML = html;
}

function renderDivisionView(container) {
    var division = document.getElementById('viewDivisionFilter').value;
    var divList = [...new Set(AppState.schedules.map(function(s) { return s.division; }))];
    if (division) divList = divList.filter(function(d) { return d === division; });
    
    if (divList.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-building"></i><h3>沒有找到學部課表</h3><p>請先生成課表</p></div>';
        return;
    }
    
    var periodsPerDayOfWeek = AppState.settings.periodsPerDayOfWeek;
    var days = AppState.settings.daysPerWeek;
    var maxPeriods = Math.max.apply(null, Object.values(periodsPerDayOfWeek));
    var html = '';
    
    divList.forEach(function(div) {
        var divSchedules = AppState.schedules.filter(function(s) { return s.division === div; });
        var divInfo = DIVISIONS[div];
        html += '<div class="division-group"><div class="division-group-title"><i class="fas fa-building"></i>' + (divInfo ? divInfo.name : div) + '<span style="opacity:0.8;font-size:0.9rem;">(' + divSchedules.length + ' 個班級)</span></div>';
        
        divSchedules.forEach(function(schedule) {
            html += '<div class="card" style="margin-bottom:1rem;"><div class="card-header"><h3><i class="fas fa-users"></i> ' + schedule.className + '</h3></div><div class="schedule-grid"><table class="timetable"><thead><tr><th></th>';
            for (var d = 0; d < days; d++) {
                var dayPeriods = periodsPerDayOfWeek[d] || maxPeriods;
                html += '<th>' + DAY_NAMES[d] + '<br><small style="font-size:0.7rem;color:#666;">(' + dayPeriods + '節)</small></th>';
            }
            html += '</tr></thead><tbody>';
            
            for (var p = 0; p < maxPeriods; p++) {
                html += '<tr><td>第 ' + (p + 1) + ' 節</td>';
                for (var d2 = 0; d2 < days; d2++) {
                    var dayPeriods = periodsPerDayOfWeek[d2] || maxPeriods;
                    if (p + 1 > dayPeriods) {
                        html += '<td style="background:#e0e0e0;color:#999;">-</td>';
                    } else {
                        var slot = schedule.slots[d2 + '_' + (p + 1)];
                        if (slot) {
                            var color = slot.subject === 'homeroom' ? '#9b59b6' : getSubjectColor(slot.subject);
                            var subjectName = slot.subject === 'homeroom' ? '班主任課' : getSubjectName(slot.subject);
                            html += '<td><div class="lesson-cell" style="background:' + color + '"><span class="lesson-subject">' + subjectName + '</span><span class="lesson-teacher">' + slot.teacherName + '</span></div></td>';
                        } else {
                            html += '<td><div class="lesson-cell" style="background:#f5f5f5;color:#999">-</div></td>';
                        }
                    }
                }
                html += '</tr>';
            }
            html += '</tbody></table></div></div>';
        });
        html += '</div>';
    });
    
    container.innerHTML = html;
}

// ========================================
// 導出功能
// ========================================
function exportToCSV() {
    if (AppState.schedules.length === 0) { showToast('沒有可導出的課表', 'warning'); return; }
    
    var periods = AppState.settings.periodsPerDay;
    var days = AppState.settings.daysPerWeek;
    var csv = '\uFEFF';
    
    AppState.schedules.forEach(function(schedule) {
        csv += '\n\n班級,' + schedule.className + ',學部,' + getDivisionName(schedule.division) + '\n';
        csv += ',' + DAY_NAMES.slice(0, days).join(',') + '\n';
        
        for (var p = 1; p <= periods; p++) {
            var row = ['第' + p + '節'];
            for (var d = 0; d < days; d++) {
                var slot = schedule.slots[d + '_' + p];
                row.push(slot ? getSubjectName(slot.subject) + '(' + slot.teacherName + ')' : '-');
            }
            csv += row.join(',') + '\n';
        }
    });
    
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '課表_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    
    showToast('CSV 已導出', 'success');
}

function printSchedule() { window.print(); }

function clearAllData() {
    if (!confirm('確定要清除所有數據嗎？此操作不可恢復！')) return;
    if (!confirm('再次確認：所有教師、班級、課表將被刪除！')) return;
    
    Storage.clear();
    AppState.teachers = [];
    AppState.classes = [];
    AppState.subjects = DEFAULT_SUBJECTS.map(function(s) { return Object.assign({}, s); });
    AppState.schedules = [];
    
    saveData();
    markDirty();
    renderAll();
    showToast('所有數據已清除', 'success');
}

// ========================================
// Modal 控制
// ========================================
function closeModals() {
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('active'); });
}

// ========================================
// 初始化
// ========================================
document.addEventListener('DOMContentLoaded', initializeApp);