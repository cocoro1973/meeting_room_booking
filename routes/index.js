const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

module.exports = function(appContext) {
    // appContext から必要なものを取り出す
    const { dbPool, getTimelineData, formatDate } = appContext;

    const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '';

    // 1. ログイン画面の表示（予約状況も取得）
    router.get('/', async (req, res) => {
        try {
            const roomsRes = await dbPool.query('SELECT * FROM rooms ORDER BY id ASC');
            const bookingsRes = await dbPool.query('SELECT * FROM bookings');

            // ユーザー候補を取得するヘルパー関数 (JSON読み込み)
            const getPresetMeetings = () => {
                try {
                    const filePath = path.join(__dirname, '../meetings.json'); // users.jsonのパス
                    if (fs.existsSync(filePath)) {
                        const data = fs.readFileSync(filePath, 'utf8');
                        return JSON.parse(data);
                    }
                } catch (err) {
                    console.error('meetings.json 読み込みエラー:', err);
                }
                return ['admin']; // ファイルがない場合のデフォルト
            };

            const formattedBookings = bookingsRes.rows.map(b => ({
                id: b.id,
                roomName: b.room_name,
                user: b.username,
                date: formatDate(b.booking_date),
                startTime: formatTime(b.start_time),
                endTime: formatTime(b.end_time)
            })); 

            //const today = new Date();
            //const timelineData = getTimelineData(formatDate(today));
            const timelineData = getTimelineData(req.query.startDate);

            // ⭕ users.jsonからユーザー候補を取得  
            const presetMeetings = getPresetMeetings();

            res.render('login', { 
                rooms: roomsRes.rows, 
                bookings: formattedBookings, 
                timelineDates: timelineData.dates,
                prevWeekStr: timelineData.prevWeekStr,
                nextWeekStr: timelineData.nextWeekStr,
                presetMeetings: presetMeetings,
                error: null 
            });
        } catch (error) {
            console.error('DB取得エラー:', error);
            res.status(500).send('サーバーエラーが発生しました。');
        }
    });

    // 2. ログイン処理
    router.post('/login', (req, res) => {
        const username = req.body.username?.trim();
        if (!username) return res.render('login', { error: 'ユーザー名を入力してください。' });

        req.session.user = username;
        if (username === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/user');
        }
    });

    // 3. ログアウト処理
    router.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/');
    });

    return router;
};