import sqlite3
import os
import shutil
import hashlib
import secrets
from datetime import datetime, timedelta

import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")

# --- POSTGRESQL / NEON ADAPTER WRAPPERS ---
class PostgresCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None

    def execute(self, sql, params=None):
        converted_sql = sql.strip()
        
        # Bỏ qua các lệnh PRAGMA của SQLite
        if converted_sql.upper().startswith("PRAGMA"):
            return self

        # Đổi INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
        converted_sql = re.sub(r'INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT', 'SERIAL PRIMARY KEY', converted_sql, flags=re.IGNORECASE)

        # Đổi INSERT OR IGNORE -> INSERT ... ON CONFLICT DO NOTHING
        if re.search(r'INSERT\s+OR\s+IGNORE\s+INTO', converted_sql, re.IGNORECASE):
            converted_sql = re.sub(r'INSERT\s+OR\s+IGNORE\s+INTO', 'INSERT INTO', converted_sql, flags=re.IGNORECASE)
            converted_sql += ' ON CONFLICT DO NOTHING'

        # Đổi INSERT OR REPLACE INTO site_settings
        if re.search(r'INSERT\s+OR\s+REPLACE\s+INTO\s+site_settings', converted_sql, re.IGNORECASE):
            converted_sql = re.sub(r'INSERT\s+OR\s+REPLACE\s+INTO\s+site_settings', 'INSERT INTO site_settings', converted_sql, flags=re.IGNORECASE)
            converted_sql += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'

        # Đổi INSERT OR REPLACE INTO media_storage
        if re.search(r'INSERT\s+OR\s+REPLACE\s+INTO\s+media_storage', converted_sql, re.IGNORECASE):
            converted_sql = re.sub(r'INSERT\s+OR\s+REPLACE\s+INTO\s+media_storage', 'INSERT INTO media_storage', converted_sql, flags=re.IGNORECASE)
            converted_sql += ' ON CONFLICT (file_path) DO UPDATE SET data = EXCLUDED.data, content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size'

        # Đổi BLOB -> BYTEA
        converted_sql = re.sub(r'\bBLOB\b', 'BYTEA', converted_sql, flags=re.IGNORECASE)

        # Chuyển đổi tham số ? sang %s
        converted_sql = converted_sql.replace('?', '%s')

        # Hỗ trợ lấy lastrowid cho câu lệnh INSERT có bảng chứa cột id
        is_insert = bool(re.search(r'^\s*INSERT\s+INTO', converted_sql, re.IGNORECASE))
        has_returning = 'RETURNING' in converted_sql.upper()
        
        insert_id_tables = ['users', 'posts', 'comments', 'stories', 'verification_requests', 'follows', 'post_likes', 'post_views', 'story_views']
        if is_insert and not has_returning and any(f" {tbl} " in f" {converted_sql} " or f"({tbl})" in converted_sql for tbl in insert_id_tables):
            converted_sql += ' RETURNING id'
            if params is not None:
                import psycopg2
                safe_params = [psycopg2.Binary(p) if isinstance(p, (bytes, bytearray)) else p for p in params]
                self._cursor.execute(converted_sql, tuple(safe_params))
            else:
                self._cursor.execute(converted_sql)
            try:
                row = self._cursor.fetchone()
                if row:
                    self.lastrowid = row[0]
            except Exception:
                pass
            return self

        if params is not None:
            import psycopg2
            safe_params = [psycopg2.Binary(p) if isinstance(p, (bytes, bytearray)) else p for p in params]
            self._cursor.execute(converted_sql, tuple(safe_params))
        else:
            self._cursor.execute(converted_sql)
        return self

    def executemany(self, sql, seq_of_params):
        converted_sql = sql.replace('?', '%s')
        return self._cursor.executemany(converted_sql, seq_of_params)

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size)

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def close(self):
        return self._cursor.close()

    def __iter__(self):
        return iter(self._cursor)

class PostgresConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        import psycopg2.extras
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PostgresCursorWrapper(cur)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def close(self):
        return self._conn.close()

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

def get_db():
    if DATABASE_URL:
        import psycopg2
        url = DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        conn = psycopg2.connect(url)
        return PostgresConnectionWrapper(conn)

    # Fallback SQLite
    if os.environ.get("VERCEL"):
        db_path = "/tmp/social.db"
        src_db = os.path.join(BASE_DIR, "social.db")
        if not os.path.exists(db_path) and os.path.exists(src_db):
            try:
                shutil.copy2(src_db, db_path)
            except Exception as e:
                print("Vercel DB copy warning:", e)
    else:
        db_path = os.path.join(BASE_DIR, "social.db")

    conn = sqlite3.connect(db_path, check_same_thread=False, timeout=30.0)
    conn.row_factory = sqlite3.Row
    if os.environ.get("VERCEL"):
        conn.execute("PRAGMA journal_mode=MEMORY")
    else:
        conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn

def hash_password(password: str) -> str:
    salt = "social_salt_2026_"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Bảng người dùng
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT '/static/default-avatar.svg',
        bio TEXT DEFAULT '',
        role TEXT DEFAULT 'user', -- 'admin' hoặc 'user'
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Bảng bài viết (hỗ trợ text, ảnh, video, âm nhạc/audio, privacy)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT DEFAULT '',
        media_type TEXT DEFAULT 'none', -- 'image', 'video', 'audio', 'none'
        media_url TEXT DEFAULT '',
        media_name TEXT DEFAULT '',
        privacy TEXT DEFAULT 'public', -- 'public' (công khai) hoặc 'private' (chỉ mình tôi)
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Bảng lượt xem thật (chống spam lượt xem trùng lặp từ 1 user/IP)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS post_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER,
        viewer_ip TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id, viewer_ip)
    )
    """)

    # Bảng lượt thích (Likes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
    )
    """)

    # Bảng bình luận (hỗ trợ Reply comment lồng nhau qua parent_id)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER DEFAULT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Bảng Stories (tự động hết hạn sau 24h)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        media_type TEXT NOT NULL, -- 'image', 'video'
        media_url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        views_count INTEGER DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Bảng lượt xem Story thật
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS story_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        story_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(story_id, user_id)
    )
    """)

    # Bảng theo dõi (Follows)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        follower_id INTEGER NOT NULL,
        followed_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, followed_id)
    )
    """)

    # Bảng phiên đăng nhập (Sessions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Bảng lưu ID bài viết đã xóa (đảm bảo không bao giờ hiển thị lại)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS deleted_posts (
        post_id INTEGER PRIMARY KEY,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Bảng Cấu hình Thương hiệu & Tên Website / Logo
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    # Cài đặt mặc định website
    default_settings = {
        'site_name': 'Lumina',
        'site_logo_icon': 'fa-solid fa-bolt',
        'site_logo_url': '',
        'site_description': 'Mạng Xã Hội Thế Hệ Mới — Đẳng Cấp & Tốc Độ'
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)", (k, v))

    # Migration: Đảm bảo cột privacy trong posts và parent_id trong comments tồn tại
    try:
        cursor.execute("ALTER TABLE posts ADD COLUMN privacy TEXT DEFAULT 'public'")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL")
    except Exception:
        pass

    # Migration: Thêm cột is_verified cho người dùng
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
    except Exception:
        pass

    # Migration: Thêm cột privacy cho stories
    try:
        cursor.execute("ALTER TABLE stories ADD COLUMN privacy TEXT DEFAULT 'public'")
    except Exception:
        pass

    # Bảng yêu cầu xét duyệt Tích Xanh chính chủ (Verification Requests)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS verification_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        admin_note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Quản trị viên admin mặc định được cấp tích xanh
    cursor.execute("UPDATE users SET is_verified = 1 WHERE role = 'admin'")

    # Tạo tài khoản Admin mặc định nếu chưa có
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO users (username, display_name, email, password_hash, role, bio)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            'admin',
            'Hệ Thống Quản Trị',
            'admin@social.local',
            hash_password('admin123'),
            'admin',
            'Quản trị viên mạng xã hội'
        ))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database upgraded successfully.")
