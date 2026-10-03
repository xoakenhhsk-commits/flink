import sqlite3

conn = sqlite3.connect('social.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def dump_to_postgres():
    sql = []
    sql.append("-- LUMINA SOCIAL NETWORK - NEON POSTGRESQL MIGRATION DUMP")
    sql.append("-- Chạy toàn bộ file này trong tab 'SQL Editor' trên Neon Console\n")
    
    # Drop existing tables if re-importing
    tables = [
        "upload_chunks", "media_storage", "deleted_posts", "verification_requests", "site_settings", "story_views", "stories",
        "comments", "post_likes", "post_views", "posts", "follows", "sessions", "users"
    ]
    for t in tables:
        sql.append(f"DROP TABLE IF EXISTS {t} CASCADE;")
    sql.append("")

    # Schema definition for PostgreSQL
    sql.append("""
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
    media_data TEXT DEFAULT '',
    media_name TEXT DEFAULT '',
    views_count INTEGER DEFAULT 0,
    privacy VARCHAR(50) DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deleted_posts (
    post_id INTEGER PRIMARY KEY,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE media_storage (
    file_path VARCHAR(255) PRIMARY KEY,
    content_type VARCHAR(100) NOT NULL,
    data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS upload_chunks (
    upload_id VARCHAR(255),
    chunk_index INTEGER,
    total_chunks INTEGER,
    data BYTEA,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (upload_id, chunk_index)
);
""")

    # Function to escape SQL string
    def sql_val(v):
        if v is None:
            return "NULL"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, (bytes, memoryview)):
            return f"decode('{bytes(v).hex()}', 'hex')"
        val = str(v).replace("'", "''")
        return f"'{val}'"

    # Export data in order of foreign key dependency (media_storage will be auto-synced by app from uploads folder)
    export_tables = [
        "users", "posts", "deleted_posts", "post_views", "post_likes", "comments",
        "stories", "story_views", "follows", "sessions", "site_settings", "verification_requests"
    ]

    for t in export_tables:
        cursor.execute(f"SELECT * FROM {t}")
        rows = cursor.fetchall()
        if not rows:
            continue
        cols = rows[0].keys()
        cols_str = ", ".join(cols)
        sql.append(f"-- DATA FOR {t} ({len(rows)} rows)")
        for r in rows:
            vals = ", ".join(sql_val(r[col]) for col in cols)
            sql.append(f"INSERT INTO {t} ({cols_str}) VALUES ({vals});")
        # Reset sequence for serial PK
        if "id" in cols:
            sql.append(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), coalesce(max(id), 1)) FROM {t};\n")

    output_sql = "\n".join(sql)
    with open("neon_migration.sql", "w", encoding="utf-8") as f:
        f.write(output_sql)
    print("Done! Created neon_migration.sql")

if __name__ == "__main__":
    dump_to_postgres()
