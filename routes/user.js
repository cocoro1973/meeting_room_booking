const express = require('express');
const router = express.Router();

module.exports = function(context) {
    const { dbPool, getTimelineData, checkAuth, formatDate } = context;

    const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '';

    // ユーザー画面の表示
    router.get('/', checkAuth('user'), async (req, res) => {
        try {
            const timelineData = getTimelineData(req.query.startDate);
            const user = req.session.user;
                        
            //一番古い日付を取得
            const startDateStr = timelineData.dates[0].dateStr;

            const roomsRes = await dbPool.query('SELECT * FROM rooms ORDER BY id ASC');
            //予約一覧は表示開始日からの予約分のみ取得
            const bookingsRes = await dbPool.query('SELECT * FROM bookings WHERE booking_date >= $1 ORDER BY booking_date ASC, start_time ASC',[startDateStr]);

            const formattedBookings = bookingsRes.rows.map(b => ({
                id: b.id,
                roomName: b.room_name,
                user: b.username,
                date: formatDate(b.booking_date),
                startTime: formatTime(b.start_time),
                endTime: formatTime(b.end_time)
            }));

            res.render('user', { 
                user, 
                rooms: roomsRes.rows, 
                bookings: formattedBookings, 
                myBookings: formattedBookings.filter(b => b.user === user), 
                timelineDates: timelineData.dates,
                prevWeekStr: timelineData.prevWeekStr,
                nextWeekStr: timelineData.nextWeekStr,
                error: null 
            });
        } catch (err) {
            console.error(err);
            res.status(500).send('データベースエラー');
        }
    });

    // 予約の実行
    router.post('/book', checkAuth('user'), async (req, res) => {
        const { roomName, date, startTime, endTime } = req.body;
        const user = req.session.user;

        // エラー時の再レンダリング用ヘルパー
        const renderError = async (errorMsg) => {
            const timelineData = getTimelineData(date);
            const roomsRes = await dbPool.query('SELECT * FROM rooms ORDER BY id ASC');
            const bookingsRes = await dbPool.query('SELECT * FROM bookings');
            const formattedBookings = bookingsRes.rows.map(b => ({
                id: b.id, roomName: b.room_name, user: b.username,
                date: b.booking_date.toISOString().split('T')[0],
                startTime: formatTime(b.start_time), endTime: formatTime(b.end_time)
            }));
            res.render('user', { 
                user, rooms: roomsRes.rows, bookings: formattedBookings, 
                myBookings: formattedBookings.filter(b => b.user === user), 
                timelineDates: timelineData.dates, prevWeekStr: timelineData.prevWeekStr, nextWeekStr: timelineData.nextWeekStr, error: errorMsg 
            });
        };

        if (startTime >= endTime) {
            return renderError('終了時間は開始時間より後に設定してください。');
        }

        try {
            // ★ SQLによる重複チェック (同じ部屋、同じ日、時間帯の重なり)
            const conflictCheckSql = `
                SELECT 1 FROM bookings 
                WHERE room_name = $1 AND booking_date = $2
                AND (
                    (start_time <= $3 AND end_time > $3) OR
                    (start_time < $4 AND end_time >= $4) OR
                    (start_time >= $3 AND end_time <= $4)
                )
            `;
            const conflictRes = await dbPool.query(conflictCheckSql, [roomName, date, startTime, endTime]);

            if (conflictRes.rows.length > 0) {
                return renderError('指定された時間帯は既に予約されています。');
            }

            // 予約のインサート
            await dbPool.query(
                'INSERT INTO bookings (room_name, username, booking_date, start_time, end_time) VALUES ($1, $2, $3, $4, $5)',
                [roomName, user, date, startTime, endTime]
            );

            res.redirect(`/user?startDate=${date}`);
        } catch (err) {
            console.error(err);
            res.status(500).send('予約処理中にエラーが発生しました。');
        }

    });

    // ★ 追加：予約の削除（キャンセル）
    router.post('/book/delete/:id', checkAuth('user'), async (req, res) => {

        const bookingId = parseInt(req.params.id);
        const user = req.session.user;

        // 本人の予約のみ削除できるように条件を指定
        await dbPool.query('DELETE FROM bookings WHERE id = $1 AND username = $2', [bookingId, user]);
        
        res.redirect('/user');
    });

    return router;
};