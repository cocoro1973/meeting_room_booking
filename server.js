require('dotenv').config(); // .envファイルの読み込み
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

//PostgreSQL 接続プール設定
const dbPool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

// ミドルウェア設定
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// データ保持用の共有メモリ
//let rooms = [{ id: 1, name: '会議室A' }, { id: 2, name: '会議室B' }];
//let bookings = [];

// --- 共通ヘルパー関数 ---
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTimelineData(baseDateStr) {
    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
    let baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) baseDate = new Date();
    
    const dates = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        dates.push({
            dateStr: formatDate(d),
            label: `${d.getMonth() + 1}/${d.getDate()}(${daysOfWeek[d.getDay()]})`
        });
    }

    const prevWeekDate = new Date(baseDate); prevWeekDate.setDate(baseDate.getDate() - 7);
    const nextWeekDate = new Date(baseDate); nextWeekDate.setDate(baseDate.getDate() + 7);

    return { dates, prevWeekStr: formatDate(prevWeekDate), nextWeekStr: formatDate(nextWeekDate) };
}

// 認証ミドルウェア
function checkAuth(role) {
    return (req, res, next) => {
        if (!req.session.user) return res.redirect('/');
        if (role === 'admin' && req.session.user !== 'admin') {
            return res.status(403).send('閲覧権限がありません（管理者専用）');
        }
        next();
    };
}

// 他のファイルに渡すコンテキストオブジェクト
const appContext = { dbPool, bookings, getTimelineData, checkAuth };

// --- ルーティングのバインド ---
// ルーターファイルを読み込み、ベースURL（/admin, /user）を紐付けます
app.use('/admin', require('./routes/admin')(appContext));
app.use('/user', require('./routes/user')(appContext));

// --- 共通のログイン・ログアウトルート ---

app.get('/', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const username = req.body.username?.trim();
    if (!username) return res.render('login', { error: 'ユーザー名を入力してください。' });

    req.session.user = username;
    if (username === 'admin') {
        res.redirect('/admin');
    } else {
        res.redirect('/user');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 起動
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});