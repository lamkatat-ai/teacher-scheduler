/**
 * 智能排課系統 - 後端服務器 (PostgreSQL 版本)
 * 支持多用戶協作、早退記錄、審批流程
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
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

// PostgreSQL 連接池
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/teacher_scheduler',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 數據庫初始化
async function initDatabase() {
    const client = await pool.connect();
    try {
        // 創建表
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'teacher',
                department TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS early_departures (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL,
                teacher_name TEXT NOT NULL,
                department TEXT,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                reason_type TEXT NOT NULL,
                reason_detail TEXT,
                status TEXT DEFAULT 'pending',
                approved_by INTEGER,
                approved_at TIMESTAMP,
                approval_comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id SERIAL PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id SERIAL PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 插入默認管理員賬號
        const adminResult = await client.query('SELECT id FROM users WHERE email = $1', ['admin@school.edu.hk']);
        if (adminResult.rows.length === 0) {
            await client.query(
                'INSERT INTO users (email, password, name, role, department) VALUES ($1, $2, $3, $4, $5)',
                ['admin@school.edu.hk', 'admin123', '系統管理員', 'admin', '系統']
            );
            console.log('✅ 默認管理員賬號已創建 (admin@school.edu.hk / admin123)');
        }

        console.log('✅ 數據庫初始化完成');
    } catch (error) {
        console.error('❌ 數據庫初始化錯誤:', error);
    } finally {
        client.release();
    }
}

// ========================================
// API 路由
// ========================================

// 用戶登錄
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT id, email, name, role, department FROM users WHERE email = $1 AND password = $2',
            [email, password]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.json({ success: false, message: '電郵或密碼錯誤' });
        }
    } catch (error) {
        console.error('登錄錯誤:', error);
        res.json({ success: false, message: '系統錯誤' });
    }
});

// 獲取所有用戶
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, name, role, department FROM users');
        res.json(result.rows);
    } catch (error) {
        console.error('獲取用戶錯誤:', error);
        res.json([]);
    }
});

// 新增用戶
app.post('/api/users', async (req, res) => {
    const { email, password, name, role, department } = req.body;
    
    try {
        const result = await pool.query(
            'INSERT INTO users (email, password, name, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [email, password, name, role, department]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('新增用戶錯誤:', error);
        res.json({ success: false, message: '電郵已存在' });
    }
});

// ========================================
// 早退記錄 API
// ========================================

// 獲取早退記錄列表
app.get('/api/early-departures', async (req, res) => {
    const { status, teacher_id } = req.query;
    
    let sql = 'SELECT * FROM early_departures WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
        sql += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }
    
    if (teacher_id) {
        sql += ` AND teacher_id = $${paramIndex}`;
        params.push(teacher_id);
        paramIndex++;
    }
    
    sql += ' ORDER BY created_at DESC';
    
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('獲取早退記錄錯誤:', error);
        res.json([]);
    }
});

// 新增早退記錄
app.post('/api/early-departures', async (req, res) => {
    const { teacher_id, teacher_name, department, date, time, reason_type, reason_detail } = req.body;
    
    try {
        const result = await pool.query(
            `INSERT INTO early_departures (teacher_id, teacher_name, department, date, time, reason_type, reason_detail)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [teacher_id, teacher_name, department, date, time, reason_type, reason_detail]
        );
        
        // 通知所有客戶端
        broadcast({ type: 'early_departure_created', data: { id: result.rows[0].id } });
        
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('新增早退記錄錯誤:', error);
        res.json({ success: false, message: '系統錯誤' });
    }
});

// 更新早退記錄（審批）
app.put('/api/early-departures/:id', async (req, res) => {
    const { id } = req.params;
    const { status, approved_by, approval_comment } = req.body;
    
    try {
        await pool.query(
            `UPDATE early_departures 
             SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, approval_comment = $3
             WHERE id = $4`,
            [status, approved_by, approval_comment, id]
        );
        
        // 通知所有客戶端
        broadcast({ type: 'early_departure_updated', data: { id: id } });
        
        res.json({ success: true });
    } catch (error) {
        console.error('更新早退記錄錯誤:', error);
        res.json({ success: false, message: '系統錯誤' });
    }
});

// 刪除早退記錄
app.delete('/api/early-departures/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query('DELETE FROM early_departures WHERE id = $1', [id]);
        
        // 通知所有客戶端
        broadcast({ type: 'early_departure_deleted', data: { id: id } });
        
        res.json({ success: true });
    } catch (error) {
        console.error('刪除早退記錄錯誤:', error);
        res.json({ success: false, message: '系統錯誤' });
    }
});

// 統計早退記錄
app.get('/api/early-departures/stats', async (req, res) => {
    const { teacher_id, start_date, end_date } = req.query;
    
    let sql = 'SELECT COUNT(*) as count, status FROM early_departures WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (teacher_id) {
        sql += ` AND teacher_id = $${paramIndex}`;
        params.push(teacher_id);
        paramIndex++;
    }
    
    if (start_date) {
        sql += ` AND date >= $${paramIndex}`;
        params.push(start_date);
        paramIndex++;
    }
    
    if (end_date) {
        sql += ` AND date <= $${paramIndex}`;
        params.push(end_date);
        paramIndex++;
    }
    
    sql += ' GROUP BY status';
    
    try {
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('統計早退記錄錯誤:', error);
        res.json([]);
    }
});

// ========================================
// 排課數據同步 API
// ========================================

// 獲取排課數據
app.get('/api/schedules', async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM schedules ORDER BY id DESC LIMIT 1');
        res.json(result.rows.length > 0 ? JSON.parse(result.rows[0].data) : {});
    } catch (error) {
        console.error('獲取排課數據錯誤:', error);
        res.json({});
    }
});

// 保存排課數據
app.post('/api/schedules', async (req, res) => {
    const data = JSON.stringify(req.body);
    const updated_by = req.body.updated_by || null;
    
    try {
        await pool.query('INSERT INTO schedules (data, updated_by) VALUES ($1, $2)', [data, updated_by]);
        
        // 通知所有客戶端
        broadcast({ type: 'schedules_updated' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('保存排課數據錯誤:', error);
        res.json({ success: false, message: '系統錯誤' });
    }
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

// 初始化數據庫後啟動服務器
initDatabase().then(() => {
    server.listen(PORT, () => {
        console.log('=================================');
        console.log('🚀 智能排課系統服務器已啟動！');
        console.log('=================================');
        console.log(`📍 本地訪問: http://localhost:${PORT}`);
        console.log(`📍 局域網訪問: http://<你的IP>:${PORT}`);
        console.log('');
        console.log('👤 默認管理員賬號:');
        console.log('   電郵: admin@school.edu.hk');
        console.log('   密碼: admin123');
        console.log('');
        console.log('💡 提示: 按 Ctrl+C 停止服務器');
        console.log('=================================');
    });
});
