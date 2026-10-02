-- LUMINA SOCIAL NETWORK - NEON POSTGRESQL MIGRATION DUMP
-- Chạy toàn bộ file này trong tab 'SQL Editor' trên Neon Console

DROP TABLE IF EXISTS verification_requests CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS story_views CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS post_views CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;


CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT '/static/default-avatar.svg',
    bio TEXT DEFAULT '',
    role VARCHAR(50) DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    media_type VARCHAR(50) DEFAULT 'none',
    media_url TEXT DEFAULT '',
    media_name TEXT DEFAULT '',
    views_count INTEGER DEFAULT 0,
    privacy VARCHAR(50) DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_views (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    viewer_ip VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(50) DEFAULT 'image',
    media_url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    views_count INTEGER DEFAULT 0,
    privacy VARCHAR(50) DEFAULT 'public',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE story_views (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(story_id, user_id)
);

CREATE TABLE follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, followed_id)
);

CREATE TABLE sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE verification_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'pending',
    admin_note TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATA FOR users (5 rows)
INSERT INTO users (id, username, display_name, email, password_hash, avatar_url, bio, role, is_active, created_at, is_verified) VALUES (1, 'admin', 'Hệ Thống Quản Trị ADMIN', 'admin@social.local', '46d3952be403764c5b4e3ea1b4406261e0bc266a75355127c4d7ed1080d1c2db', '/static/default-avatar.png', 'Quản trị viên mạng xã hội', 'admin', 1, '2026-10-02 07:37:38', 1);
INSERT INTO users (id, username, display_name, email, password_hash, avatar_url, bio, role, is_active, created_at, is_verified) VALUES (3, 'chauvadut2026', 'Chau Va Dut', 'vadut74@gmail.com', 'd1e9b8b49295293202fe1b1eece369eea3c9753f5b8abe60cbbfa953dcc47a2d', '/uploads/avatars/avatar_3_0bbd8637.jpg', 'CEO Nền Tảng  FLINK', 'user', 1, '2026-10-02 10:01:20', 1);
INSERT INTO users (id, username, display_name, email, password_hash, avatar_url, bio, role, is_active, created_at, is_verified) VALUES (4, 'creator1', 'KOL Creator', 'kol@test.com', 'dd80dae56dac744c748a44d7150a0d039d88eb22cdb61f957c445cd314b6310e', '/static/default-avatar.svg', '', 'user', 1, '2026-10-02 10:46:21', 1);
INSERT INTO users (id, username, display_name, email, password_hash, avatar_url, bio, role, is_active, created_at, is_verified) VALUES (5, 'creatora', 'Creator A', 'crea@test.com', 'dd80dae56dac744c748a44d7150a0d039d88eb22cdb61f957c445cd314b6310e', '/static/default-avatar.svg', '', 'user', 1, '2026-10-02 11:08:49', 0);
INSERT INTO users (id, username, display_name, email, password_hash, avatar_url, bio, role, is_active, created_at, is_verified) VALUES (6, 'viewerb', 'Viewer B', 'viewb@test.com', 'dd80dae56dac744c748a44d7150a0d039d88eb22cdb61f957c445cd314b6310e', '/static/default-avatar.svg', '', 'user', 1, '2026-10-02 11:08:49', 0);
SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;

-- DATA FOR posts (4 rows)
INSERT INTO posts (id, user_id, content, media_type, media_url, media_name, views_count, created_at, privacy) VALUES (4, 1, '', 'video', '/uploads/videos/7c2749531868d036_1790932159.mp4', '5920.mp4', 6, '2026-10-02 09:09:19', 'public');
INSERT INTO posts (id, user_id, content, media_type, media_url, media_name, views_count, created_at, privacy) VALUES (6, 1, '', 'audio', '/uploads/audio/e2f240257cf87bf7_1790932522.mp3', '🎬 ណូយ វ៉ាន់ណេត ជ្រើសរើសបទចាស់ៗពិរោះៗ  Noy Vanneth Collection Nonstop Old Song - Lida Somaly (youtube).mp3', 2, '2026-10-02 09:15:22', 'private');
INSERT INTO posts (id, user_id, content, media_type, media_url, media_name, views_count, created_at, privacy) VALUES (7, 3, 'Nhạc khmer #nhackhmer', 'video', '/uploads/videos/ee947d309a51256a_1790935523.mp4', '5530.mp4', 7, '2026-10-02 10:05:23', 'public');
INSERT INTO posts (id, user_id, content, media_type, media_url, media_name, views_count, created_at, privacy) VALUES (8, 3, 'Triệu view #nhac2026', 'video', '/uploads/videos/8c6fc0f29853d08d_1790940127.mp4', '5905.mp4', 2, '2026-10-02 11:22:08', 'public');
SELECT setval(pg_get_serial_sequence('posts', 'id'), coalesce(max(id), 1)) FROM posts;

-- DATA FOR post_views (34 rows)
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (2, 2, 1, '127.0.0.1', '2026-10-02 07:45:14');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (3, 3, 1, '127.0.0.1', '2026-10-02 07:58:13');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (4, 3, NULL, '115.77.255.220', '2026-10-02 09:07:30');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (5, 2, NULL, '115.77.255.220', '2026-10-02 09:07:33');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (6, 3, 1, '115.77.255.220', '2026-10-02 09:08:21');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (7, 2, 1, '115.77.255.220', '2026-10-02 09:09:19');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (8, 4, 1, '115.77.255.220', '2026-10-02 09:09:21');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (9, 5, 1, '115.77.255.220', '2026-10-02 09:13:12');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (10, 6, 1, '115.77.255.220', '2026-10-02 09:15:24');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (11, 5, NULL, '115.77.255.220', '2026-10-02 09:59:54');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (12, 4, NULL, '115.77.255.220', '2026-10-02 10:00:02');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (13, 3, NULL, '115.77.255.220', '2026-10-02 10:00:10');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (14, 2, NULL, '115.77.255.220', '2026-10-02 10:00:11');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (15, 5, 3, '115.77.255.220', '2026-10-02 10:01:25');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (16, 4, 3, '115.77.255.220', '2026-10-02 10:01:26');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (17, 3, 3, '115.77.255.220', '2026-10-02 10:01:28');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (18, 2, 3, '115.77.255.220', '2026-10-02 10:01:28');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (19, 7, 3, '115.77.255.220', '2026-10-02 10:05:26');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (20, 7, 1, '127.0.0.1', '2026-10-02 10:10:07');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (21, 6, 1, '127.0.0.1', '2026-10-02 10:10:15');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (22, 5, 1, '127.0.0.1', '2026-10-02 10:10:17');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (23, 4, 1, '127.0.0.1', '2026-10-02 10:10:18');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (24, 7, NULL, '127.0.0.1', '2026-10-02 10:11:27');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (25, 7, NULL, '127.0.0.1', '2026-10-02 10:11:32');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (26, 5, 3, '127.0.0.1', '2026-10-02 10:14:43');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (27, 4, 3, '127.0.0.1', '2026-10-02 10:14:43');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (28, 3, 3, '127.0.0.1', '2026-10-02 10:14:52');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (29, 2, 3, '127.0.0.1', '2026-10-02 10:14:52');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (30, 7, 3, '127.0.0.1', '2026-10-02 10:21:20');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (31, 7, NULL, '127.0.0.1', '2026-10-02 10:45:40');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (32, 8, 3, '115.77.255.220', '2026-10-02 11:22:11');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (33, 8, NULL, '192.178.6.163', '2026-10-02 11:24:37');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (34, 7, NULL, '192.178.6.163', '2026-10-02 11:24:38');
INSERT INTO post_views (id, post_id, user_id, viewer_ip, created_at) VALUES (35, 4, NULL, '192.178.6.163', '2026-10-02 11:24:40');
SELECT setval(pg_get_serial_sequence('post_views', 'id'), coalesce(max(id), 1)) FROM post_views;

-- DATA FOR post_likes (1 rows)
INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (1, 4, 3, '2026-10-02 10:01:32');
SELECT setval(pg_get_serial_sequence('post_likes', 'id'), coalesce(max(id), 1)) FROM post_likes;

-- DATA FOR comments (4 rows)
INSERT INTO comments (id, post_id, user_id, content, created_at, parent_id) VALUES (2, 2, 1, 'vãi', '2026-10-02 07:45:30', NULL);
INSERT INTO comments (id, post_id, user_id, content, created_at, parent_id) VALUES (3, 3, 1, 'Chào mừng tính năng hashtag tuyệt vời!', '2026-10-02 07:55:19', NULL);
INSERT INTO comments (id, post_id, user_id, content, created_at, parent_id) VALUES (4, 3, 1, 'Cảm ơn bạn, tính năng rep comment lồng nhau cũng hoạt động rất tốt!', '2026-10-02 07:55:19', 3);
INSERT INTO comments (id, post_id, user_id, content, created_at, parent_id) VALUES (5, 7, 3, 'Các bạn thấy hay không', '2026-10-02 10:58:26', NULL);
SELECT setval(pg_get_serial_sequence('comments', 'id'), coalesce(max(id), 1)) FROM comments;

-- DATA FOR stories (2 rows)
INSERT INTO stories (id, user_id, media_type, media_url, caption, views_count, expires_at, created_at, privacy) VALUES (1, 5, 'image', '/uploads/stories/story_5_0333748c75f4.jpg', 'Story bi mat chi danh cho nguoi follow', 2, '2026-10-03 18:08:49', '2026-10-02 11:08:49', 'followers');
INSERT INTO stories (id, user_id, media_type, media_url, caption, views_count, expires_at, created_at, privacy) VALUES (2, 3, 'video', '/uploads/stories/story_3_c7353c987d86.mp4', '', 2, '2026-10-03 18:11:11', '2026-10-02 11:11:11', 'public');
SELECT setval(pg_get_serial_sequence('stories', 'id'), coalesce(max(id), 1)) FROM stories;

-- DATA FOR story_views (4 rows)
INSERT INTO story_views (id, story_id, user_id, created_at) VALUES (1, 1, 6, '2026-10-02 11:08:49');
INSERT INTO story_views (id, story_id, user_id, created_at) VALUES (2, 2, 3, '2026-10-02 11:11:15');
INSERT INTO story_views (id, story_id, user_id, created_at) VALUES (3, 1, 1, '2026-10-02 11:15:28');
INSERT INTO story_views (id, story_id, user_id, created_at) VALUES (4, 2, 1, '2026-10-02 11:15:32');
SELECT setval(pg_get_serial_sequence('story_views', 'id'), coalesce(max(id), 1)) FROM story_views;

-- DATA FOR follows (5 rows)
INSERT INTO follows (id, follower_id, followed_id, created_at) VALUES (2, 3, 1, '2026-10-02 10:21:40');
INSERT INTO follows (id, follower_id, followed_id, created_at) VALUES (3, 1, 3, '2026-10-02 10:25:14');
INSERT INTO follows (id, follower_id, followed_id, created_at) VALUES (4, 3, 4, '2026-10-02 10:51:40');
INSERT INTO follows (id, follower_id, followed_id, created_at) VALUES (5, 4, 3, '2026-10-02 11:07:32');
INSERT INTO follows (id, follower_id, followed_id, created_at) VALUES (6, 6, 5, '2026-10-02 11:08:49');
SELECT setval(pg_get_serial_sequence('follows', 'id'), coalesce(max(id), 1)) FROM follows;

-- DATA FOR sessions (20 rows)
INSERT INTO sessions (token, user_id, created_at) VALUES ('c939970066e34730809899d9d42452c428233e3f8f3b9c3be111828e2d9feb29', 1, '2026-10-02 07:55:19');
INSERT INTO sessions (token, user_id, created_at) VALUES ('a59227b9dca99fb222c578470fef1bbe183918cc964cc0d0895b1df9aa987dab', 1, '2026-10-02 09:07:53');
INSERT INTO sessions (token, user_id, created_at) VALUES ('b80155f51e5fede0ae5bd1c8325c1b6e2110ede8904ebd175b168519b6de7e06', 1, '2026-10-02 10:00:12');
INSERT INTO sessions (token, user_id, created_at) VALUES ('2e30761b2b8b87cf55df1eecbe7884ede472bd20553a0f0017e235a073614245', 1, '2026-10-02 10:00:13');
INSERT INTO sessions (token, user_id, created_at) VALUES ('ea0ada08626618ed6e51e6895f03a518ed12ee64860c7cf53e892cb4adab35bd', 3, '2026-10-02 10:44:29');
INSERT INTO sessions (token, user_id, created_at) VALUES ('261b71a45507b730c6ff72d3277763ce3a7c25bd15da4e21f01b1f866cb2d720', 1, '2026-10-02 10:45:53');
INSERT INTO sessions (token, user_id, created_at) VALUES ('b773d47ee6f218f62315b5eaaeb9404374669c3e9fd97b3df94bfc6d8feac098', 1, '2026-10-02 10:46:21');
INSERT INTO sessions (token, user_id, created_at) VALUES ('da2b883b3f39f2e1760c31b2c35866b558a00784d2dd9a8732b1763122aeddb3', 4, '2026-10-02 10:46:21');
INSERT INTO sessions (token, user_id, created_at) VALUES ('da555698b1be9d3989d023fda3ef79a7c2717e863b7fec3146cfbc6596fa17bc', 1, '2026-10-02 10:49:04');
INSERT INTO sessions (token, user_id, created_at) VALUES ('1b44e2cbdd3d5791bd1c0516b0f3aef57630a0c86fd5d195cb0e53d8ec795ea2', 4, '2026-10-02 10:49:04');
INSERT INTO sessions (token, user_id, created_at) VALUES ('eb27043b40792391e88ab80bdea10677c7a69ff7cd7058af23b12857cf89f626', 1, '2026-10-02 10:49:45');
INSERT INTO sessions (token, user_id, created_at) VALUES ('2e810948f7f6c9d699c15c56cddf451879419e796fc4a278d8c6b60adcce91d2', 4, '2026-10-02 10:49:45');
INSERT INTO sessions (token, user_id, created_at) VALUES ('eebe1086b07614de391618fbb80a31a07a562d0143bec194169088d4dea948dd', 1, '2026-10-02 10:49:59');
INSERT INTO sessions (token, user_id, created_at) VALUES ('a1c02ca5462aa492406d01a854024212fdd13a27af6f1f343cfcd95732ab1750', 1, '2026-10-02 11:07:31');
INSERT INTO sessions (token, user_id, created_at) VALUES ('ab7a3febfe7a690b6bd9097e55b566ea078995c7805a92831f55f05c34ac1c43', 4, '2026-10-02 11:07:31');
INSERT INTO sessions (token, user_id, created_at) VALUES ('34398506f1ddadef5c38b3987134610d050701727f523bf92ef9deaa2b83fc45', 1, '2026-10-02 11:08:49');
INSERT INTO sessions (token, user_id, created_at) VALUES ('810d6ee64d97116a8a94c321e7fc05457e58a63911f716ec7e3ea0d1fd31547b', 5, '2026-10-02 11:08:49');
INSERT INTO sessions (token, user_id, created_at) VALUES ('47f2789a94f6a067859da3df7245c6837b174d6f2e786e25bbc018c0703e4ca6', 6, '2026-10-02 11:08:49');
INSERT INTO sessions (token, user_id, created_at) VALUES ('cd4abc23afb8f5885450649eff8f008a6656908294b8ee0107bdfc60430b4b98', 3, '2026-10-02 11:20:19');
INSERT INTO sessions (token, user_id, created_at) VALUES ('7f34d073a5e2e27c611fd9fa8e76699985cec63af1da75a60c083bcaaf85896c', 3, '2026-10-02 11:20:19');
-- DATA FOR site_settings (4 rows)
INSERT INTO site_settings (key, value) VALUES ('site_name', 'FLINK');
INSERT INTO site_settings (key, value) VALUES ('site_description', 'Mạng Xã Hội Thế Hệ Mới — Đẳng Cấp & Tốc Độ');
INSERT INTO site_settings (key, value) VALUES ('site_logo_icon', 'fa-solid fa-bolt');
INSERT INTO site_settings (key, value) VALUES ('site_logo_url', '/uploads/branding/brand_logo_1790937843.png');
-- DATA FOR verification_requests (2 rows)
INSERT INTO verification_requests (id, user_id, reason, status, admin_note, created_at, updated_at) VALUES (1, 4, 'Toi la KOL cong nghe muon xac minh chinh chu', 'approved', 'Đã được Quản trị viên phê duyệt', '2026-10-02 10:46:21', '2026-10-02 10:54:27');
INSERT INTO verification_requests (id, user_id, reason, status, admin_note, created_at, updated_at) VALUES (2, 3, 'Bạn hãy giúp tôi mở tích xanh vi kênh của tôi là KOL', 'approved', 'Phe duyet', '2026-10-02 10:47:21', '2026-10-02 10:49:04');
SELECT setval(pg_get_serial_sequence('verification_requests', 'id'), coalesce(max(id), 1)) FROM verification_requests;
