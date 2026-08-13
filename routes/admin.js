const express = require('express');
const router = express.Router();

// server.js からデータと関数を受け取るための初期化関数
module.exports = function(context) {
    const { dbPool, getTimelineData, checkAuth, formatDate } = context;

    //function formatTime(timeStr){
    // if (timeStr) {
    //      return timeStr.substring(0,5);    
    //  }else { 
    // return '';
    //  }
    // }
    // と同じ意味　アロー関数
    //時間の「秒」をカットする補助関数（例：10:00:00 -> 10:00）
    const formatTime = (timeStr) => timeStr ? timeStr.substring(0,5):'';

    // 管理者画面の表示
    router.get('/', checkAuth('admin'), async (req, res) => {
        try{
            const timelineData = getTimelineData(req.query.startDate);

            //一番古い日付を取得
            const startDateStr = timelineData.dates[0].dateStr;



            //DBから部屋一覧と予約一覧を平行して取得
            const roomsRes = await dbPool.query('SELECT * FROM rooms ORDER BY id ASC');
            //予約一覧は今日からの予約分のみ取得
            const bookingsRes =  await dbPool.query('SELECT * FROM bookings WHERE booking_date >= $1 ORDER BY booking_date ASC, start_time ASC',[startDateStr]);
        
            // TIME型のデータを EJS が扱いやすいように整形
            const formattedBookings = bookingsRes.rows.map(b => ({
                id: b.id,
                roomName: b.room_name,
                user: b.username,
                date: formatDate(b.booking_date),
                startTime: formatTime(b.start_time),
                endTime: formatTime(b.end_time)
            }));    

            res.render('admin', { 
                rooms: roomsRes.rows, 
                bookings: formattedBookings, 
                timelineDates: timelineData.dates,
                prevWeekStr: timelineData.prevWeekStr,
                nextWeekStr: timelineData.nextWeekStr
            });

        } catch (err) {
            console.error(err);
            res.status(500).send('データベースエラーが発生しました。');
        }
    });

    //

    // 会議室追加
    router.post('/rooms/add', checkAuth('admin'), async (req, res) => {
        const roomName = req.body.roomName?.trim();
        if (roomName) {
            await dbPool.query('INSERT INTO rooms (name) VALUES ($1) ON CONFLICT DO NOTHING', [roomName]);
        }
        res.redirect('/admin');
    });

    // 会議室削除
    router.post('/rooms/delete/:id', checkAuth('admin'), async (req, res) => {
        const roomId = parseInt(req.params.id);
        await dbPool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        res.redirect('/admin');
    });

    router.post('/bookings/delete/:id', checkAuth('admin'), async (req, res) => {
        const bookingId = parseInt(req.params.id);
        await dbPool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
        res.redirect('/admin');
    });

    return router;
};