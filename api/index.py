import sys
import os

# Đảm bảo đường dẫn thư mục gốc có trong sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
