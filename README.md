Javascript node.js express.js postgreSQLで動く簡単会議室予約

固定された会議名はmeeting.jsonに設定
DB接続情報は .env (.env_sampleをRenameして.envにしてください）に記載。

adminで管理者権限があたえられ会議室の追加など行えます。

sudo -u postgres psql

-- 1. 会議室予約用のデータベースを作成
CREATE DATABASE meeting_room_db;

-- 2. 専用のアプリケーションユーザーを作成（パスワードは任意）
CREATE USER room_user WITH PASSWORD 'room_password';
GRANT ALL PRIVILEGES ON DATABASE meeting_room_db TO room_user;
※ここで設定したユーザーとパスワードを.envに指定してください

-- 3. 作成したデータベースに切り替え
\c meeting_room_db

-- 4. 会議室テーブルの作成
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- 5. 予約テーブルの作成（日付はDATE型、時間はTIME型）
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- 初期データの投入
INSERT INTO rooms (name) VALUES ('会議室A'), ('会議室B');


