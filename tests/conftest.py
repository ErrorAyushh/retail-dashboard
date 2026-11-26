import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

# Configure test environment variables before module imports
os.environ["ENV"] = "development"
os.environ["JWT_SECRET"] = "test-secret-at-least-32-characters-long-kadam"
os.environ["WARMUP_SECRET"] = "test-warmup-secret-kadam-suite"
os.environ["CORS_ORIGINS"] = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
