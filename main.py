import os
import io
import re
import shutil
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from collections import Counter

from fastapi import FastAPI, File, UploadFile, Request, Form, Depends, HTTPException, status, Response
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import database
from database import get_db, hash_password

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Vercel Serverless environment support
if os.environ.get("VERCEL"):
    UPLOAD_DIR = "/tmp/uploads"
else:
    UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

for sub in ["images", "videos", "audio", "stories", "avatars", "branding"]:
    os.makedirs(os.path.join(UPLOAD_DIR, sub), exist_ok=True)

# Copy bundled uploads if running in /tmp
if os.environ.get("VERCEL"):
    src_uploads = os.path.join(BASE_DIR, "uploads")
    if os.path.exists(src_uploads):
        for root, dirs, files in os.walk(src_uploads):
            rel = os.path.relpath(root, src_uploads)
            dest_dir = os.path.join(UPLOAD_DIR, rel)
            os.makedirs(dest_dir, exist_ok=True)
            for f in files:
                src_file = os.path.join(root, f)
                dest_file = os.path.join(dest_dir, f)
                if not os.path.exists(dest_file):
                    try:
                        shutil.copy2(src_file, dest_file)
                    except Exception:
                        pass

# Đảm bảo database sẵn sàng
try:
    database.init_db()
except Exception as e:
    print("Database init note:", e)

app = FastAPI(title="Lumina Social Network Pro", version="2.0.0")

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

class MediaSavedResult(str):
    def __new__(cls, rel_url: str, file_bytes: bytes = b"", content_type: str = ""):
        obj = super().__new__(cls, rel_url)
        obj.rel_url = rel_url
        obj.file_bytes = file_bytes
        obj.content_type = content_type
        return obj

    @property
    def data_url(self) -> str:
        if not self.file_bytes:
            return ""
        import base64
        mime = self.content_type or "image/jpeg"
        return f"data:{mime};base64,{base64.b64encode(self.file_bytes).decode('utf-8')}"

# --- DATABASE-BACKED MEDIA STORAGE (ĐẢM BẢO ẢNH/VIDEO LƯU VĨNH VIỄN TRONG CSDL) ---
def save_media_to_storage(subfolder: str, filename: str, file_bytes: bytes, content_type: str = "") -> MediaSavedResult:
    ext = os.path.splitext(filename)[1].lower()
    if not content_type:
        import mimetypes
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    # Tối ưu hóa nén ảnh bằng Pillow để giảm dung lượng file (tránh quá tải và giúp lưu vào DB cực nhanh)
    if ext in [".jpg", ".jpeg", ".png", ".webp"] or (content_type and content_type.startswith("image/")):
        try:
            from PIL import Image, ImageOps
            img = Image.open(io.BytesIO(file_bytes))
            # Auto-orient theo EXIF (rất quan trọng cho ảnh chụp từ iPhone)
            img = ImageOps.exif_transpose(img)
            # Giới hạn kích thước tối đa 1400px để tối ưu dung lượng và tốc độ tải
            max_dimension = 1400
            if img.width > max_dimension or img.height > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            if img.mode in ("RGBA", "P"):
                if ext == ".png":
                    img.save(buf, format="PNG", optimize=True)
                    content_type = "image/png"
                else:
                    img = img.convert("RGB")
                    img.save(buf, format="JPEG", quality=80, optimize=True)
                    content_type = "image/jpeg"
                    ext = ".jpg"
            else:
                img = img.convert("RGB")
                img.save(buf, format="JPEG", quality=80, optimize=True)
                content_type = "image/jpeg"
                ext = ".jpg"
            file_bytes = buf.getvalue()
        except Exception as img_err:
            print("Pillow image optimization note:", img_err)

    saved_filename = f"{secrets.token_hex(8)}_{int(datetime.now().timestamp())}{ext}"
    rel_url = f"/uploads/{subfolder}/{saved_filename}"

    # 1. Ghi vào ổ đĩa tạm để cache tải nhanh
    try:
        disk_path = os.path.join(UPLOAD_DIR, subfolder, saved_filename)
        os.makedirs(os.path.dirname(disk_path), exist_ok=True)
        with open(disk_path, "wb") as f:
            f.write(file_bytes)
    except Exception as e:
        print("Disk cache write note:", e)

    # 2. LƯU VĨNH VIỄN VÀO CƠ SỞ DỮ LIỆU (DATABASE BLOB/BYTEA)
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS media_storage (
                file_path TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                data BLOB,
                file_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            INSERT OR REPLACE INTO media_storage (file_path, content_type, data, file_size)
            VALUES (?, ?, ?, ?)
        """, (rel_url, content_type, file_bytes, len(file_bytes)))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Lỗi lưu file vào CSDL:", e)

    return MediaSavedResult(rel_url, file_bytes, content_type)

def sync_existing_uploads_to_db():
    src_uploads = os.path.join(BASE_DIR, "uploads")
    if not os.path.exists(src_uploads):
        return
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS media_storage (
                file_path TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                data BLOB,
                file_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        import mimetypes
        for root, dirs, files in os.walk(src_uploads):
            for f in files:
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, src_uploads).replace("\\", "/")
                rel_url = f"/uploads/{rel_path}"
                try:
                    if os.path.getsize(full_path) > 25 * 1024 * 1024:
                        continue
                    cursor.execute("SELECT 1 FROM media_storage WHERE file_path = ?", (rel_url,))
                    if not cursor.fetchone():
                        with open(full_path, "rb") as fh:
                            f_bytes = fh.read()
                        mime = mimetypes.guess_type(f)[0] or "application/octet-stream"
                        cursor.execute("INSERT OR REPLACE INTO media_storage (file_path, content_type, data, file_size) VALUES (?, ?, ?, ?)",
                                       (rel_url, mime, f_bytes, len(f_bytes)))
                except Exception:
                    pass
        conn.commit()
        conn.close()
    except Exception as e:
        print("Sync uploads note:", e)

try:
    sync_existing_uploads_to_db()
except Exception:
    pass

@app.get("/uploads/{subfolder}/{filename}")
async def serve_upload_file(request: Request, subfolder: str, filename: str):
    rel_url = f"/uploads/{subfolder}/{filename}"
    disk_path = os.path.join(UPLOAD_DIR, subfolder, filename)

    content_type = None
    file_data = None

    # 1. Nếu có sẵn trên ổ đĩa cache
    if os.path.exists(disk_path):
        try:
            with open(disk_path, "rb") as f:
                file_data = f.read()
            import mimetypes
            content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        except Exception:
            file_data = None

    # 2. Nếu ổ đĩa bị Vercel xóa tạm, lấy trực tiếp từ CƠ SỞ DỮ LIỆU
    if not file_data:
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT content_type, data FROM media_storage WHERE file_path = ? OR file_path LIKE ?", (rel_url, f"%{filename}"))
            row = cursor.fetchone()
            conn.close()
            if row:
                content_type = row["content_type"] or "application/octet-stream"
                file_data = bytes(row["data"])
                try:
                    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
                    with open(disk_path, "wb") as f:
                        f.write(file_data)
                except Exception:
                    pass
        except Exception as e:
            print("Lỗi tải media từ CSDL:", e)

    if not file_data:
        raise HTTPException(status_code=404, detail="Tệp không tồn tại")

    total_size = len(file_data)
    range_header = request.headers.get("range") or request.headers.get("Range")

    # Hỗ trợ chuẩn HTTP 206 Partial Content (Range requests) đặc biệt quan trọng cho iPhone Safari phát Video/Audio mượt mà
    if range_header and range_header.startswith("bytes="):
        try:
            ranges = range_header.replace("bytes=", "").split("-")
            start = int(ranges[0]) if ranges[0] else 0
            end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else total_size - 1
            if start >= total_size:
                start = 0
            if end >= total_size:
                end = total_size - 1
            chunk_length = end - start + 1
            chunk_data = file_data[start:end+1]

            return Response(
                content=chunk_data,
                status_code=206,
                media_type=content_type,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(chunk_length),
                    "Cache-Control": "public, max-age=31536000"
                }
            )
        except Exception as e:
            print("Range parse note:", e)

    return Response(
        content=file_data,
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(total_size),
            "Cache-Control": "public, max-age=31536000"
        }
    )

# --- AUTH HELPER & CRYPTOGRAPHIC SESSION TOKENS ---
SESSION_SECRET = os.environ.get("SESSION_SECRET", "lumina_social_super_secure_secret_key_2026")

def create_session_token(user_id: int) -> str:
    ts = int(datetime.utcnow().timestamp())
    nonce = secrets.token_hex(16)
    raw = f"{user_id}:{ts}:{nonce}"
    sig = hmac.new(SESSION_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}:{sig}"

def verify_session_token(token: str) -> Optional[int]:
    try:
        parts = token.split(":")
        if len(parts) == 4:
            user_id_str, ts_str, nonce, sig = parts
            raw = f"{user_id_str}:{ts_str}:{nonce}"
            expected_sig = hmac.new(SESSION_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
            if hmac.compare_digest(sig, expected_sig):
                ts = int(ts_str)
                # Valid for 365 days
                if int(datetime.utcnow().timestamp()) - ts < 86400 * 365:
                    return int(user_id_str)
    except Exception:
        pass
    return None

def get_current_user_optional(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1].strip()
    if not token:
        token = request.cookies.get("session_token")
    
    if not token:
        return None

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.bio, u.role, u.is_active, u.is_verified, u.created_at
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND u.is_active = 1
    """, (token,))
    row = cursor.fetchone()

    # Fallback: check cryptographic signature if session row missing in temporary / restarted DB
    if not row:
        user_id = verify_session_token(token)
        if user_id:
            cursor.execute("""
                SELECT id, username, display_name, email, avatar_url, bio, role, is_active, is_verified, created_at
                FROM users
                WHERE id = ? AND is_active = 1
            """, (user_id,))
            user_row = cursor.fetchone()
            if user_row:
                row = user_row
                try:
                    cursor.execute("INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
                    conn.commit()
                except Exception:
                    pass

    conn.close()
    if row:
        return dict(row)
    return None

def require_current_user(request: Request) -> dict:
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập để tiếp tục")
    return user

def require_admin(request: Request) -> dict:
    user = require_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ Quản trị viên mới có quyền này")
    return user

def get_site_settings_dict():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM site_settings")
    rows = cursor.fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

# --- WEB VIEWS ROUTE ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    return templates.TemplateResponse(request=request, name="admin.html")

# --- SETTINGS API ---
@app.get("/api/settings")
async def get_settings():
    return JSONResponse(content=get_site_settings_dict())

@app.post("/api/admin/settings")
async def update_settings(
    request: Request,
    site_name: str = Form(None),
    site_description: str = Form(None),
    site_logo_icon: str = Form(None),
    show_mobile_header: str = Form(None),
    logo_file: UploadFile = File(None)
):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()

    if site_name and site_name.strip():
        cursor.execute("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('site_name', ?)", (site_name.strip(),))
    if site_description and site_description.strip():
        cursor.execute("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('site_description', ?)", (site_description.strip(),))
    if site_logo_icon and site_logo_icon.strip():
        cursor.execute("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('site_logo_icon', ?)", (site_logo_icon.strip(),))
    if show_mobile_header is not None:
        val = "1" if str(show_mobile_header).strip() in ["1", "true", "on"] else "0"
        cursor.execute("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('show_mobile_header', ?)", (val,))

    if logo_file and logo_file.filename:
        ext = os.path.splitext(logo_file.filename)[1].lower()
        if ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico"]:
            logo_bytes = await logo_file.read()
            logo_url = save_media_to_storage("branding", logo_file.filename, logo_bytes, logo_file.content_type or "image/png")
            cursor.execute("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('site_logo_url', ?)", (logo_url,))

    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "settings": get_site_settings_dict()})

# --- AUTH API ---
@app.post("/api/auth/register")
async def register(
    username: str = Form(...),
    display_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    username = username.strip().lower()
    display_name = display_name.strip()
    email = email.strip().lower()
    
    if len(username) < 3 or len(password) < 6:
        return JSONResponse(content={"error": "Tên đăng nhập >= 3 ký tự, mật khẩu >= 6 ký tự"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        if cursor.fetchone():
            return JSONResponse(content={"error": "Tên đăng nhập hoặc Email đã tồn tại"}, status_code=400)

        cursor.execute("""
            INSERT INTO users (username, display_name, email, password_hash, avatar_url, role)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (username, display_name, email, hash_password(password), "/static/default-avatar.svg", "user"))
        user_id = cursor.lastrowid

        token = create_session_token(user_id)
        cursor.execute("INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        conn.commit()

        cursor.execute("SELECT id, username, display_name, email, avatar_url, bio, role, is_verified, created_at FROM users WHERE id = ?", (user_id,))
        user_data = dict(cursor.fetchone())

        response = JSONResponse(content={"status": "ok", "token": token, "user": user_data})
        response.set_cookie(key="session_token", value=token, max_age=86400*365, httponly=True, samesite="lax")
        return response
    finally:
        conn.close()

@app.post("/api/auth/login")
async def login(
    account: str = Form(...),
    password: str = Form(...)
):
    account = account.strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, username, display_name, email, avatar_url, bio, role, is_active, is_verified, created_at
            FROM users
            WHERE (username = ? OR email = ?) AND password_hash = ?
        """, (account, account, hash_password(password)))
        row = cursor.fetchone()
        if not row:
            return JSONResponse(content={"error": "Tài khoản hoặc mật khẩu không chính xác"}, status_code=400)

        user = dict(row)
        if not user.get("is_active"):
            return JSONResponse(content={"error": "Tài khoản đã bị tạm khóa bởi quản trị viên"}, status_code=403)

        token = create_session_token(user["id"])
        cursor.execute("INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
        conn.commit()

        response = JSONResponse(content={"status": "ok", "token": token, "user": user})
        response.set_cookie(key="session_token", value=token, max_age=86400*365, httponly=True, samesite="lax")
        return response
    finally:
        conn.close()

@app.post("/api/auth/logout")
async def logout(request: Request):
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1].strip()
    if not token:
        token = request.cookies.get("session_token")
    
    if token:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()

    response = JSONResponse(content={"status": "ok"})
    response.delete_cookie(key="session_token", samesite="lax")
    return response

@app.get("/api/auth/me")
async def get_me(request: Request):
    user = get_current_user_optional(request)
    if not user:
        return JSONResponse(content={"user": None})
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as posts_count FROM posts WHERE user_id = ?", (user["id"],))
    posts_count = cursor.fetchone()["posts_count"]
    cursor.execute("SELECT COUNT(*) as followers_count FROM follows WHERE followed_id = ?", (user["id"],))
    followers_count = cursor.fetchone()["followers_count"]
    cursor.execute("SELECT COUNT(*) as following_count FROM follows WHERE follower_id = ?", (user["id"],))
    following_count = cursor.fetchone()["following_count"]
    conn.close()

    user["posts_count"] = posts_count
    user["followers_count"] = followers_count
    user["following_count"] = following_count
    return JSONResponse(content={"user": user})

@app.post("/api/auth/update-profile")
async def update_profile(
    request: Request,
    display_name: str = Form(...),
    bio: str = Form(""),
    avatar: UploadFile = File(None)
):
    user = require_current_user(request)
    avatar_url = user["avatar_url"]

    if avatar and avatar.filename:
        ext = os.path.splitext(avatar.filename)[1].lower()
        if ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            av_bytes = await avatar.read()
            avatar_url = save_media_to_storage("avatars", avatar.filename, av_bytes, avatar.content_type or "image/jpeg")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users SET display_name = ?, bio = ?, avatar_url = ? WHERE id = ?
    """, (display_name.strip(), bio.strip(), avatar_url, user["id"]))
    conn.commit()
    conn.close()

    user["display_name"] = display_name.strip()
    user["bio"] = bio.strip()
    user["avatar_url"] = avatar_url
    return JSONResponse(content={"status": "ok", "user": user})

@app.post("/api/auth/avatar")
async def update_avatar_direct(
    request: Request,
    avatar: UploadFile = File(...)
):
    user = require_current_user(request)
    if not avatar or not avatar.filename:
        return JSONResponse(content={"error": "Vui lòng chọn ảnh hợp lệ"}, status_code=400)
    
    ext = os.path.splitext(avatar.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        return JSONResponse(content={"error": "Chỉ chấp nhận file ảnh (jpg, png, webp, gif)"}, status_code=400)
    
    av_bytes = await avatar.read()
    avatar_url = save_media_to_storage("avatars", avatar.filename, av_bytes, avatar.content_type or "image/jpeg")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user["id"]))
    conn.commit()
    conn.close()

    user["avatar_url"] = avatar_url
    return JSONResponse(content={"status": "ok", "avatar_url": avatar_url, "user": user})

@app.post("/api/auth/change-password")
async def change_password(
    request: Request,
    old_password: str = Form(...),
    new_password: str = Form(...)
):
    user = require_current_user(request)
    if len(new_password) < 6:
        return JSONResponse(content={"error": "Mật khẩu mới phải từ 6 ký tự trở lên"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    if not row or row["password_hash"] != hash_password(old_password):
        conn.close()
        return JSONResponse(content={"error": "Mật khẩu hiện tại không chính xác"}, status_code=400)

    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user["id"]))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "message": "Đổi mật khẩu thành công"})

# --- USERS & RELATIONSHIPS (FOLLOW / FRIEND / PUBLIC PROFILE) API ---
@app.get("/api/users/suggestions")
async def get_user_suggestions(request: Request):
    current_user = get_current_user_optional(request)
    current_user_id = current_user["id"] if current_user else 0

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            u.id, u.username, u.display_name, u.avatar_url, u.role, u.is_verified,
            (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) as followers_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_following
        FROM users u
        WHERE u.id != ? AND u.is_active = 1
        ORDER BY followers_count DESC, u.created_at DESC
        LIMIT 6
    """, (current_user_id, current_user_id))
    rows = cursor.fetchall()
    conn.close()

    users = []
    for r in rows:
        d = dict(r)
        d["is_following"] = bool(d["is_following"])
        users.append(d)

    return JSONResponse(content={"users": users})

@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: int, request: Request):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, display_name, avatar_url, bio, role, is_verified, created_at
        FROM users
        WHERE id = ? AND is_active = 1
    """, (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(content={"error": "Người dùng không tồn tại"}, status_code=404)
    
    user_data = dict(row)
    
    cursor.execute("SELECT COUNT(*) as posts_count FROM posts WHERE user_id = ? AND privacy = 'public'", (user_id,))
    user_data["posts_count"] = cursor.fetchone()["posts_count"]
    
    cursor.execute("SELECT COUNT(*) as followers_count FROM follows WHERE followed_id = ?", (user_id,))
    user_data["followers_count"] = cursor.fetchone()["followers_count"]
    
    cursor.execute("SELECT COUNT(*) as following_count FROM follows WHERE follower_id = ?", (user_id,))
    user_data["following_count"] = cursor.fetchone()["following_count"]

    current_user = get_current_user_optional(request)
    is_following = False
    is_self = False
    if current_user:
        if current_user["id"] == user_id:
            is_self = True
        else:
            cursor.execute("SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?", (current_user["id"], user_id))
            if cursor.fetchone():
                is_following = True

    conn.close()
    user_data["is_following"] = is_following
    user_data["is_self"] = is_self
    return JSONResponse(content={"user": user_data})

@app.post("/api/users/{user_id}/follow")
async def toggle_follow(user_id: int, request: Request):
    current_user = require_current_user(request)
    if current_user["id"] == user_id:
        return JSONResponse(content={"error": "Bạn không thể tự kết bạn hoặc theo dõi chính mình"}, status_code=400)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ? AND is_active = 1", (user_id,))
    if not cursor.fetchone():
        conn.close()
        return JSONResponse(content={"error": "Người dùng không tồn tại"}, status_code=404)
    
    cursor.execute("SELECT id FROM follows WHERE follower_id = ? AND followed_id = ?", (current_user["id"], user_id))
    existing = cursor.fetchone()
    if existing:
        cursor.execute("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?", (current_user["id"], user_id))
        action = "unfollowed"
    else:
        cursor.execute("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)", (current_user["id"], user_id))
        action = "followed"
    
    conn.commit()
    cursor.execute("SELECT COUNT(*) as followers_count FROM follows WHERE followed_id = ?", (user_id,))
    followers_count = cursor.fetchone()["followers_count"]
    conn.close()

    return JSONResponse(content={
        "status": "ok", 
        "action": action, 
        "is_following": (action == "followed"), 
        "followers_count": followers_count
    })

# --- POSTS API (PRIVACY & HASHTAGS FILTER) ---
@app.get("/api/posts")
async def get_posts(
    request: Request, 
    page: int = 1, 
    limit: int = 20, 
    tag: str = None, 
    user_id: int = None, 
    filter_type: str = None
):
    user = get_current_user_optional(request)
    current_user_id = user["id"] if user else 0
    is_admin = user and user.get("role") == "admin"

    offset = (page - 1) * limit
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS deleted_posts (post_id INTEGER PRIMARY KEY, deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")

    where_clauses = [
        "u.is_active = 1",
        "p.id NOT IN (SELECT post_id FROM deleted_posts)"
    ]
    where_params = []

    # Kiểm tra quyền riêng tư (Privacy)
    if not is_admin:
        # Bài công khai HOẶC bài riêng tư của chính mình
        where_clauses.append("(p.privacy = 'public' OR p.user_id = ?)")
        where_params.append(current_user_id)

    # Lọc theo người dùng cụ thể
    if user_id:
        where_clauses.append("p.user_id = ?")
        where_params.append(user_id)

    # Lọc theo Hashtag nếu có
    if tag and tag.strip():
        tag_clean = tag.strip().lstrip('#')
        where_clauses.append("p.content LIKE ?")
        where_params.append(f"%#{tag_clean}%")

    # Lọc theo loại nội dung
    if filter_type == "media":
        where_clauses.append("(p.media_type IS NOT NULL AND p.media_type != 'none' AND p.media_url != '')")
    elif filter_type == "liked" and current_user_id:
        where_clauses.append("p.id IN (SELECT post_id FROM post_likes WHERE user_id = ?)")
        where_params.append(current_user_id)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    all_params = [current_user_id] + where_params + [limit, offset]

    cursor.execute(f"""
        SELECT 
            p.id, p.user_id, p.content, p.media_type, p.media_url, p.media_data, p.media_name, p.privacy, p.views_count, p.created_at,
            u.username, u.display_name, u.avatar_url, u.role, u.is_verified,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        {where_sql}
        ORDER BY p.id DESC
        LIMIT ? OFFSET ?
    """, tuple(all_params))
    rows = cursor.fetchall()
    conn.close()

    posts = []
    for r in rows:
        d = dict(r)
        if d.get("media_data"):
            d["media_url"] = d["media_data"]
        posts.append(d)
    return JSONResponse(content={"posts": posts})

@app.get("/api/posts/realtime")
async def get_realtime_posts(
    request: Request,
    last_id: int = 0,
    filter_type: Optional[str] = None
):
    """API kiểm tra và đồng bộ bài viết mới theo thời gian thực (Realtime Polling)"""
    user = get_current_user_optional(request)
    current_user_id = user["id"] if user else 0
    is_admin = user and user.get("role") == "admin"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS deleted_posts (post_id INTEGER PRIMARY KEY, deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")

    where_clauses = [
        "u.is_active = 1",
        "p.id > ?",
        "p.id NOT IN (SELECT post_id FROM deleted_posts)"
    ]
    where_params = [last_id]

    if not is_admin:
        where_clauses.append("(p.privacy = 'public' OR p.user_id = ?)")
        where_params.append(current_user_id)

    if filter_type == "media":
        where_clauses.append("(p.media_type IS NOT NULL AND p.media_type != 'none' AND p.media_url != '')")
    elif filter_type == "videos":
        where_clauses.append("p.media_type = 'video'")

    where_sql = "WHERE " + " AND ".join(where_clauses)
    all_params = [current_user_id] + where_params

    cursor.execute(f"""
        SELECT 
            p.id, p.user_id, p.content, p.media_type, p.media_url, p.media_data, p.media_name, p.privacy, p.views_count, p.created_at,
            u.username, u.display_name, u.avatar_url, u.role, u.is_verified,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        {where_sql}
        ORDER BY p.id ASC
    """, tuple(all_params))
    rows = cursor.fetchall()
    conn.close()

    new_posts = []
    for r in rows:
        d = dict(r)
        if d.get("media_data"):
            d["media_url"] = d["media_data"]
        new_posts.append(d)
    return JSONResponse(content={"new_posts": new_posts, "count": len(new_posts)})

@app.post("/api/posts")
async def create_post(
    request: Request,
    content: str = Form(""),
    privacy: str = Form("public"),
    media: UploadFile = File(None)
):
    user = require_current_user(request)
    media_type = "none"
    media_url = ""
    media_data = ""
    media_name = ""

    if privacy not in ["public", "private"]:
        privacy = "public"

    if media and media.filename:
        filename = media.filename
        ext = os.path.splitext(filename)[1].lower()

        if ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            media_type = "image"
            subfolder = "images"
        elif ext in [".mp4", ".webm", ".mov", ".mkv"]:
            media_type = "video"
            subfolder = "videos"
        elif ext in [".mp3", ".wav", ".ogg", ".m4a"]:
            media_type = "audio"
            subfolder = "audio"
        else:
            return JSONResponse(content={"error": "Định dạng tệp không được hỗ trợ"}, status_code=400)

        file_bytes = await media.read()
        saved_media = save_media_to_storage(subfolder, filename, file_bytes, media.content_type or "")
        media_url = str(saved_media)
        media_name = filename

        # Lưu bản sao Data URL vĩnh viễn trực tiếp vào cơ sở dữ liệu:
        # Đối với ảnh: luôn lưu Data URL để tải tức thì 0ms, không phụ thuộc ổ đĩa
        # Đối với video/audio < 3.5MB: lưu Data URL để xem ngay không lo mất file
        if media_type == "image":
            media_data = saved_media.data_url
        elif media_type in ["video", "audio"] and len(saved_media.file_bytes) < 3500000:
            media_data = saved_media.data_url

    if not content.strip() and media_type == "none":
        return JSONResponse(content={"error": "Nội dung bài viết hoặc tệp đính kèm không được để trống"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO posts (user_id, content, media_type, media_url, media_data, media_name, privacy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user["id"], content.strip(), media_type, media_url, media_data, media_name, privacy))
    post_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return JSONResponse(content={
        "status": "ok", 
        "post_id": post_id, 
        "media_url": media_data or media_url,
        "media_data": media_data,
        "media_type": media_type,
        "media_name": media_name,
        "content": content.strip(),
        "privacy": privacy
    })

# --- HASHTAGS & TRENDING ALGORITHM ---
@app.get("/api/trending")
async def get_trending_topics():
    """Thuật toán quét các bài viết công khai, bóc tách và tính tần suất các hashtag # nổi bật thực tế"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT content FROM posts WHERE privacy = 'public' AND content LIKE '%#%'")
    rows = cursor.fetchall()
    conn.close()

    hashtag_counter = Counter()
    for r in rows:
        text = r["content"] or ""
        tags = re.findall(r'#([A-Za-z0-9_À-ỹ]+)', text)
        for t in tags:
            hashtag_counter[t.lower()] += 1

    top_tags = []
    for tag, count in hashtag_counter.most_common(6):
        top_tags.append({"tag": f"#{tag}", "raw": tag, "count": count})

    # Nếu chưa có hashtag, tạo các đề xuất mặc định
    if not top_tags:
        top_tags = [
            {"tag": "#LuminaSocial", "raw": "LuminaSocial", "count": 1},
            {"tag": "#CongNghe", "raw": "CongNghe", "count": 1},
            {"tag": "#AmNhac", "raw": "AmNhac", "count": 1}
        ]

    return JSONResponse(content={"trending": top_tags})

@app.post("/api/posts/{post_id}/view")
async def record_view(post_id: int, request: Request):
    """Tính lượt xem thật: mỗi user hoặc IP chỉ tăng 1 view thực tế"""
    user = get_current_user_optional(request)
    user_id = user["id"] if user else None
    client_ip = request.client.host if request.client else "unknown"

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO post_views (post_id, user_id, viewer_ip)
            VALUES (?, ?, ?)
        """, (post_id, user_id, client_ip))
        
        if cursor.rowcount > 0:
            cursor.execute("UPDATE posts SET views_count = views_count + 1 WHERE id = ?", (post_id,))
            conn.commit()
        
        cursor.execute("SELECT views_count FROM posts WHERE id = ?", (post_id,))
        row = cursor.fetchone()
        views = row["views_count"] if row else 0
        return JSONResponse(content={"views": views})
    finally:
        conn.close()

@app.post("/api/posts/{post_id}/like")
async def toggle_like(post_id: int, request: Request):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?", (post_id, user["id"]))
        existing = cursor.fetchone()
        if existing:
            cursor.execute("DELETE FROM post_likes WHERE id = ?", (existing["id"],))
            liked = False
        else:
            cursor.execute("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)", (post_id, user["id"]))
            liked = True
        conn.commit()

        cursor.execute("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?", (post_id,))
        likes_count = cursor.fetchone()["count"]
        return JSONResponse(content={"liked": liked, "likes_count": likes_count})
    finally:
        conn.close()

# --- COMMENTS API (HỖ TRỢ TRẢ LỜI / REPLY) ---
@app.get("/api/posts/{post_id}/comments")
async def get_comments(post_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.parent_id, c.content, c.created_at, u.username, u.display_name, u.avatar_url, u.role, u.is_verified,
               pu.username as parent_username, pu.display_name as parent_display_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comments pc ON c.parent_id = pc.id
        LEFT JOIN users pu ON pc.user_id = pu.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    """, (post_id,))
    rows = cursor.fetchall()
    conn.close()
    return JSONResponse(content={"comments": [dict(r) for r in rows]})

@app.post("/api/posts/{post_id}/comments")
async def add_comment(
    post_id: int,
    request: Request,
    content: str = Form(...),
    parent_id: Optional[int] = Form(None)
):
    user = require_current_user(request)
    if not content.strip():
        return JSONResponse(content={"error": "Nội dung bình luận không được để trống"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO comments (post_id, user_id, parent_id, content)
        VALUES (?, ?, ?, ?)
    """, (post_id, user["id"], parent_id, content.strip()))
    comment_id = cursor.lastrowid
    conn.commit()

    cursor.execute("""
        SELECT c.id, c.parent_id, c.content, c.created_at, u.username, u.display_name, u.avatar_url, u.role, u.is_verified,
               pu.username as parent_username, pu.display_name as parent_display_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN comments pc ON c.parent_id = pc.id
        LEFT JOIN users pu ON pc.user_id = pu.id
        WHERE c.id = ?
    """, (comment_id,))
    new_comment = dict(cursor.fetchone())
    conn.close()

    return JSONResponse(content={"status": "ok", "comment": new_comment})

@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: int, request: Request):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("CREATE TABLE IF NOT EXISTS deleted_posts (post_id INTEGER PRIMARY KEY, deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        cursor.execute("SELECT id, user_id, media_url FROM posts WHERE id = ?", (post_id,))
        post = cursor.fetchone()
        if not post:
            cursor.execute("INSERT OR IGNORE INTO deleted_posts (post_id) VALUES (?)", (post_id,))
            conn.commit()
            return JSONResponse(content={"status": "ok", "message": "Bài viết đã bị xóa trước đó"})

        # Kiểm tra quyền: tác giả bài viết hoặc admin
        is_owner = int(post["user_id"]) == int(user["id"])
        is_admin = str(user.get("role", "")).lower() == "admin"
        if not is_owner and not is_admin:
            return JSONResponse(content={"error": "Bạn không có quyền xóa bài viết của người khác"}, status_code=403)

        # Xóa file vật lý liên kết nếu có
        if post["media_url"] and str(post["media_url"]).startswith("/uploads/"):
            rel_path = str(post["media_url"]).replace("/uploads/", "")
            disk_path = os.path.join(UPLOAD_DIR, rel_path)
            if os.path.exists(disk_path):
                try:
                    os.remove(disk_path)
                except Exception:
                    pass

        # Ghi nhận bài viết vào danh sách xóa vĩnh viễn (chắc chắn không bao giờ load lại)
        cursor.execute("INSERT OR IGNORE INTO deleted_posts (post_id) VALUES (?)", (post_id,))

        # Xóa sạch các bảng phụ thuộc trước để tránh lỗi Foreign Key
        cursor.execute("UPDATE comments SET parent_id = NULL WHERE post_id = ?", (post_id,))
        cursor.execute("DELETE FROM post_likes WHERE post_id = ?", (post_id,))
        cursor.execute("DELETE FROM post_views WHERE post_id = ?", (post_id,))
        cursor.execute("DELETE FROM comments WHERE post_id = ?", (post_id,))
        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
        return JSONResponse(content={"status": "ok", "message": "Đã xóa bài viết thành công"})
    except Exception as e:
        conn.rollback()
        print("Lỗi khi xóa bài viết:", e)
        return JSONResponse(content={"error": f"Lỗi máy chủ khi xóa bài: {str(e)}"}, status_code=500)
    finally:
        try:
            conn.close()
        except Exception:
            pass

# --- STORIES API ---
@app.get("/api/stories")
async def get_stories(request: Request):
    current_user = get_current_user_optional(request)
    current_user_id = current_user["id"] if current_user else 0
    is_admin = current_user.get("role") == "admin" if current_user else False

    conn = get_db()
    cursor = conn.cursor()

    if is_admin:
        cursor.execute("""
            SELECT s.id, s.user_id, s.media_type, s.media_url, s.caption, s.privacy, s.views_count, s.created_at, s.expires_at,
                   u.username, u.display_name, u.avatar_url, u.is_verified
            FROM stories s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > CURRENT_TIMESTAMP
            ORDER BY s.created_at ASC
        """)
    elif current_user_id:
        cursor.execute("""
            SELECT s.id, s.user_id, s.media_type, s.media_url, s.caption, s.privacy, s.views_count, s.created_at, s.expires_at,
                   u.username, u.display_name, u.avatar_url, u.is_verified
            FROM stories s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > CURRENT_TIMESTAMP
              AND (
                  s.privacy = 'public'
                  OR s.user_id = ?
                  OR s.user_id IN (SELECT followed_id FROM follows WHERE follower_id = ?)
              )
            ORDER BY s.created_at ASC
        """, (current_user_id, current_user_id))
    else:
        cursor.execute("""
            SELECT s.id, s.user_id, s.media_type, s.media_url, s.caption, s.privacy, s.views_count, s.created_at, s.expires_at,
                   u.username, u.display_name, u.avatar_url, u.is_verified
            FROM stories s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > CURRENT_TIMESTAMP AND (s.privacy = 'public' OR s.privacy IS NULL)
            ORDER BY s.created_at ASC
        """)
    rows = cursor.fetchall()
    conn.close()

    users_stories = {}
    for r in rows:
        d = dict(r)
        uid = d["user_id"]
        if uid not in users_stories:
            users_stories[uid] = {
                "user_id": uid,
                "username": d["username"],
                "display_name": d["display_name"],
                "avatar_url": d["avatar_url"],
                "is_verified": d["is_verified"],
                "stories": []
            }
        users_stories[uid]["stories"].append(d)

    return JSONResponse(content={"story_groups": list(users_stories.values())})

@app.post("/api/stories")
async def create_story(
    request: Request,
    media: UploadFile = File(...),
    caption: str = Form(""),
    privacy: str = Form("public")
):
    user = require_current_user(request)
    if not media or not media.filename:
        return JSONResponse(content={"error": "Vui lòng chọn ảnh hoặc video để đăng Story"}, status_code=400)

    if privacy not in ["public", "followers"]:
        privacy = "public"

    filename = media.filename
    ext = os.path.splitext(filename)[1].lower()

    image_exts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]
    video_exts = [".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi", ".3gp"]

    if ext in image_exts:
        media_type = "image"
    elif ext in video_exts:
        media_type = "video"
    else:
        return JSONResponse(content={"error": "Story hỗ trợ các tệp ảnh hoặc video (ngắn / dài MP4, WEBM, MOV)"}, status_code=400)

    file_bytes = await media.read()
    media_url = save_media_to_storage("stories", filename, file_bytes, media.content_type or "")
    expires_at = (datetime.now() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO stories (user_id, media_type, media_url, caption, privacy, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user["id"], media_type, media_url, caption.strip(), privacy, expires_at))
    conn.commit()
    conn.close()

    return JSONResponse(content={"status": "ok", "message": "Đã đăng Story thành công!"})

@app.post("/api/stories/{story_id}/view")
async def view_story(story_id: int, request: Request):
    user = get_current_user_optional(request)
    if not user:
        return JSONResponse(content={"status": "ok"})

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)", (story_id, user["id"]))
        if cursor.rowcount > 0:
            cursor.execute("UPDATE stories SET views_count = views_count + 1 WHERE id = ?", (story_id,))
            conn.commit()
        return JSONResponse(content={"status": "ok"})
    finally:
        conn.close()

@app.get("/api/stories/{story_id}/viewers")
async def get_story_viewers(story_id: int, request: Request):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, views_count FROM stories WHERE id = ?", (story_id,))
        story = cursor.fetchone()
        if not story:
            return JSONResponse(content={"error": "Story không tồn tại"}, status_code=404)
        
        if story["user_id"] != user["id"] and user.get("role") != "admin":
            return JSONResponse(content={"error": "Chỉ người đăng Story mới được xem danh sách người đã xem"}, status_code=403)

        cursor.execute("""
            SELECT sv.created_at as viewed_at,
                   u.id as user_id, u.username, u.display_name, u.avatar_url, u.is_verified
            FROM story_views sv
            JOIN users u ON sv.user_id = u.id
            WHERE sv.story_id = ?
            ORDER BY sv.created_at DESC
        """, (story_id,))
        rows = cursor.fetchall()
        viewers = [dict(r) for r in rows]
        return JSONResponse(content={"story_id": story_id, "viewers": viewers, "total": len(viewers)})
    finally:
        conn.close()

@app.delete("/api/stories/{story_id}")
async def delete_story(story_id: int, request: Request):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id, media_url FROM stories WHERE id = ?", (story_id,))
        story = cursor.fetchone()
        if not story:
            return JSONResponse(content={"error": "Story không tồn tại"}, status_code=404)
        if story["user_id"] != user["id"] and user.get("role") != "admin":
            return JSONResponse(content={"error": "Không có quyền xóa Story này"}, status_code=403)

        if story["media_url"] and story["media_url"].startswith("/uploads/"):
            rel_path = story["media_url"].replace("/uploads/", "")
            disk_path = os.path.join(UPLOAD_DIR, rel_path)
            if os.path.exists(disk_path):
                try:
                    os.remove(disk_path)
                except Exception:
                    pass

        cursor.execute("DELETE FROM stories WHERE id = ?", (story_id,))
        cursor.execute("DELETE FROM story_views WHERE story_id = ?", (story_id,))
        conn.commit()
        return JSONResponse(content={"status": "ok", "message": "Đã xóa Story thành công"})
    finally:
        conn.close()

# --- ADMIN API (QUẢN LÝ DỮ LIỆU, MẬT KHẨU, USERS, POSTS) ---
@app.get("/api/admin/stats")
async def admin_stats(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM posts")
    total_posts = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM comments")
    total_comments = cursor.fetchone()["total"]

    cursor.execute("SELECT SUM(views_count) as total FROM posts")
    row_views = cursor.fetchone()
    total_views = row_views["total"] if row_views["total"] else 0

    cursor.execute("SELECT COUNT(*) as total FROM stories WHERE expires_at > CURRENT_TIMESTAMP")
    active_stories = cursor.fetchone()["total"]
    conn.close()

    total_bytes = 0
    for root, dirs, files in os.walk(UPLOAD_DIR):
        for f in files:
            fp = os.path.join(root, f)
            if os.path.exists(fp):
                total_bytes += os.path.getsize(fp)
    
    storage_mb = round(total_bytes / (1024 * 1024), 2)

    return JSONResponse(content={
        "total_users": total_users,
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_views": total_views,
        "active_stories": active_stories,
        "storage_mb": storage_mb
    })

@app.get("/api/admin/users")
async def admin_users(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.display_name, u.email, u.role, u.is_active, u.is_verified, u.created_at,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count
        FROM users u
        ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return JSONResponse(content={"users": [dict(r) for r in rows]})

@app.post("/api/admin/reset-password")
async def admin_reset_password(
    request: Request,
    user_id: int = Form(...),
    new_password: str = Form(...)
):
    """Admin có quyền đặt lại mật khẩu cho bất kỳ người dùng nào"""
    require_admin(request)
    if len(new_password) < 6:
        return JSONResponse(content={"error": "Mật khẩu mới phải từ 6 ký tự"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))
    # Hủy phiên đăng nhập cũ của người dùng này để họ đăng nhập lại với mật khẩu mới
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "message": "Đã đổi mật khẩu tài khoản thành công"})

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, request: Request):
    admin = require_admin(request)
    if admin["id"] == user_id:
        return JSONResponse(content={"error": "Không thể xóa chính tài khoản admin của bạn"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "message": "Đã xóa người dùng khỏi hệ thống"})

@app.post("/api/admin/toggle-user/{user_id}")
async def admin_toggle_user(user_id: int, request: Request):
    admin = require_admin(request)
    if admin["id"] == user_id:
        return JSONResponse(content={"error": "Không thể khóa tài khoản chính mình"}, status_code=400)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_active FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(content={"error": "Người dùng không tồn tại"}, status_code=404)

    new_state = 0 if row["is_active"] else 1
    cursor.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_state, user_id))
    if new_state == 0:
        cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    return JSONResponse(content={"status": "ok", "new_state": new_state})

@app.get("/api/admin/posts")
async def admin_posts(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.id, p.content, p.media_type, p.media_url, p.privacy, p.views_count, p.created_at,
               u.username, u.display_name,
               (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 100
    """)
    rows = cursor.fetchall()
    conn.close()
    return JSONResponse(content={"posts": [dict(r) for r in rows]})

# --- TÍCH XANH CHÍNH CHỦ (VERIFICATION BADGE) API ---
@app.get("/api/verification/status")
async def get_verification_status(request: Request):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_verified FROM users WHERE id = ?", (user["id"],))
    u_row = cursor.fetchone()
    is_verified = bool(u_row["is_verified"]) if u_row else False
    
    cursor.execute("""
        SELECT id, reason, status, admin_note, created_at, updated_at
        FROM verification_requests
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (user["id"],))
    req_row = cursor.fetchone()
    conn.close()
    
    return JSONResponse(content={
        "is_verified": is_verified,
        "latest_request": dict(req_row) if req_row else None
    })

@app.post("/api/verification/request")
async def submit_verification_request(
    request: Request,
    reason: str = Form("")
):
    user = require_current_user(request)
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT is_verified FROM users WHERE id = ?", (user["id"],))
    u_row = cursor.fetchone()
    if u_row and u_row["is_verified"]:
        conn.close()
        return JSONResponse(content={"error": "Tài khoản của bạn đã được cấp tích xanh chính chủ rồi!"}, status_code=400)
    
    cursor.execute("SELECT id FROM verification_requests WHERE user_id = ? AND status = 'pending'", (user["id"],))
    if cursor.fetchone():
        conn.close()
        return JSONResponse(content={"error": "Bạn đã gửi yêu cầu và đang chờ Quản trị viên xét duyệt. Vui lòng kiên nhẫn chờ nhé!"}, status_code=400)
    
    cursor.execute("""
        INSERT INTO verification_requests (user_id, reason, status)
        VALUES (?, ?, 'pending')
    """, (user["id"], reason.strip()))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "message": "Yêu cầu xin cấp tích xanh đã được gửi thành công đến Quản trị viên!"})

@app.get("/api/admin/verifications")
async def admin_get_verifications(request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT vr.id, vr.user_id, vr.reason, vr.status, vr.admin_note, vr.created_at, vr.updated_at,
               u.username, u.display_name, u.avatar_url, u.is_verified,
               (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as posts_count,
               (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) as followers_count
        FROM verification_requests vr
        JOIN users u ON vr.user_id = u.id
        ORDER BY CASE WHEN vr.status = 'pending' THEN 0 ELSE 1 END, vr.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return JSONResponse(content={"requests": [dict(r) for r in rows]})

@app.post("/api/admin/verifications/{request_id}")
async def admin_handle_verification(
    request_id: int,
    request: Request,
    action: str = Form(...),
    admin_note: str = Form("")
):
    require_admin(request)
    if action not in ["approve", "reject"]:
        return JSONResponse(content={"error": "Hành động không hợp lệ"}, status_code=400)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, status FROM verification_requests WHERE id = ?", (request_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        return JSONResponse(content={"error": "Yêu cầu không tồn tại"}, status_code=404)
    
    user_id = req["user_id"]
    new_status = "approved" if action == "approve" else "rejected"
    is_verified_val = 1 if action == "approve" else 0
    
    cursor.execute("""
        UPDATE verification_requests
        SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (new_status, admin_note.strip(), request_id))
    
    cursor.execute("UPDATE users SET is_verified = ? WHERE id = ?", (is_verified_val, user_id))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "message": "Đã cập nhật trạng thái yêu cầu tích xanh thành công"})

@app.post("/api/admin/users/{user_id}/toggle-verify")
async def admin_toggle_user_verify(user_id: int, request: Request):
    require_admin(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_verified FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return JSONResponse(content={"error": "Người dùng không tồn tại"}, status_code=404)
    
    new_state = 0 if row["is_verified"] else 1
    cursor.execute("UPDATE users SET is_verified = ? WHERE id = ?", (new_state, user_id))
    conn.commit()
    conn.close()
    return JSONResponse(content={"status": "ok", "is_verified": new_state})

