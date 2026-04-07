/**
 * 智能排課系統 - 後端服務器
 * 支持多用戶協作、早退記錄、審批流程
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const WebSocket = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 中間件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 靜態文件
app.use(express.static(path.join(__dirname, '../webapp')));

// 數據庫初始化
const db = new Database(path.join(__dirname, 'scheduler.db'));

// 創建表
db.exec(`
    -- 用戶表
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'teacher',
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 早退記錄表
    CREATE TABLE IF NOT EXISTS early_departures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        teacher_name TEXT NOT NULL,
        department TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        reason_type TEXT NOT NULL,
        reason_detail TEXT,
        status TEXT DEFAULT 'pending',
        approved_by INTEGER,
        approved_at DATETIME,
        approval_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id)
    );

    -- 排課數據表
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
    );

    -- 教師數據表
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 班級數據表
    CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// 插入默認管理員賬號
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    db.prepare('INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)').run(
        'admin', 'admin123', '系統管理員', 'admin', '系統'
    );
    console.log('✅ 默認管理員賬號已創建 (admin/admin123)');
}

// ========================================
// API 路由
// ========================================

// 用戶登錄
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = db.prepare('SELECT id, username, name, role, department FROM users WHERE username = ? AND password = ?').get(username, password);
    
    if (user) {
        res.json({ success: true, user: user });
    } else {
        res.json({ success: false, message: '用戶名或密碼錯誤' });
    }
});

// 獲取所有用戶
app.get('/api/users', (req, res) => {
    const users = db.prepare('SELECT id, username, name, role, department FROM users').all();
    res.json(users);
});

// 新增用戶
app.post('/api/users', (req, res) => {
    const { username, password, name, role, department } = req.body;
    
    try {
        const result = db.prepare('INSERT INTO users (username, password, name, role, department) VALUES (?, ?, ?, ?, ?)').run(
            username, password, name, role, department
        );
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        res.json({ success: false, message: '用戶名已存在' });
    }
});

// ========================================
// 早退記錄 API
// ========================================

// 獲取早退記錄列表
app.get('/api/early-departures', (req, res) => {
    const { status, teacher_id } = req.query;
    
    let sql = 'SELECT * FROM early_departures WHERE 1=1';
    const params = [];
    
    if (status) {
        sql += ' AND status = ?';
        params.push(status);
    }
    
    if (teacher_id) {
        sql += ' AND teacher_id = ?';
        params.push(teacher_id);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const records = db.prepare(sql).all(...params);
    res.json(records);
});

// 新增早退記錄
app.post('/api/early-departures', (req, res) => {
    const { teacher_id, teacher_name, department, date, time, reason_type, reason_detail } = req.body;
    
    const result = db.prepare(`
        INSERT INTO early_departures (teacher_id, teacher_name, department, date, time, reason_type, reason_detail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(teacher_id, teacher_name, department, date, time, reason_type, reason_detail);
    
    // 通知所有客戶端
    broadcast({ type: 'early_departure_created', data: { id: result.lastInsertRowid } });
    
    res.json({ success: true, id: result.lastInsertRowid });
});

// 更新早退記錄（審批）
app.put('/api/early-departures/:id', (req, res) => {
    const { id } = req.params;
    const { status, approved_by, approval_comment } = req.body;
    
    db.prepare(`
        UPDATE early_departures 
        SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, approval_comment = ?
        WHERE id = ?
    `).run(status, approved_by, approval_comment, id);
    
    // 通知所有客戶端
    broadcast({ type: 'early_departure_updated', data: { id: id } });
    
    res.json({ success: true });
});

// 刪除早退記錄
app.delete('/api/early-departures/:id', (req, res) => {
    const { id } = req.params;
    
    db.prepare('DELETE FROM early_departures WHERE id = ?').run(id);
    
    // 通知所有客戶端
    broadcast({ type: 'early_departure_deleted', data: { id: id } });
    
    res.json({ success: true });
});

// 統計早退記錄
app.get('/api/early-departures/stats', (req, res) => {
    const { teacher_id, start_date, end_date } = req.query;
    
    let sql = 'SELECT COUNT(*) as count, status FROM early_departures WHERE 1=1';
    const params = [];
    
    if (teacher_id) {
        sql += ' AND teacher_id = ?';
        params.push(teacher_id);
    }
    
    if (start_date) {
        sql += ' AND date >= ?';
        params.push(start_date);
    }
    
    if (end_date) {
        sql += ' AND date <= ?';
        params.push(end_date);
    }
    
    sql += ' GROUP BY status';
    
    const stats = db.prepare(sql).all(...params);
    res.json(stats);
});

// ========================================
// 排課數據同步 API
// ========================================

// 獲取排課數據
app.get('/api/schedules', (req, res) => {
    const row = db.prepare('SELECT data FROM schedules ORDER BY id DESC LIMIT 1').get();
    res.json(row ? JSON.parse(row.data) : {});
});

// 保存排課數據
app.post('/api/schedules', (req, res) => {
    const data = JSON.stringify(req.body);
    const updated_by = req.body.updated_by || null;
    
    db.prepare('INSERT INTO schedules (data, updated_by) VALUES (?, ?)').run(data, updated_by);
    
    // 通知所有客戶端
    broadcast({ type: 'schedules_updated' });
    
    res.json({ success: true });
});

// ========================================
// WebSocket 廣播
// ========================================

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('新的客戶端連接');
    
    ws.on('close', () => {
        console.log('客戶端斷開連接');
    });
});

// ========================================
// 啟動服務器
// ========================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 智能排課系統服務器已啟動！');
    console.log('=================================');
    console.log(`📍 本地訪問: http://localhost:${PORT}`);
    console.log(`📍 局域網訪問: http://<你的IP>:${PORT}`);
    console.log('');
    console.log('👤 默認管理員賬號:');
    console.log('   用戶名: admin');
    console.log('   密碼: admin123');
    console.log('');
    console.log('💡 提示: 按 Ctrl+C 停止服務器');
    console.log('=================================');
});
