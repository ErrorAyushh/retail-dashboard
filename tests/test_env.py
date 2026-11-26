import os
import re
from pathlib import Path

def test_env_example_matches_codebase():
    """
    Scans backend python files for environment variable reads and verifies
    that every referenced environment variable is listed in .env.example.
    """
    root_dir = Path(__file__).resolve().parent.parent
    backend_dir = root_dir / "backend"
    env_example_file = root_dir / ".env.example"

    assert env_example_file.exists(), ".env.example must exist in the root directory"

    # Read .env.example keys
    with open(env_example_file, "r", encoding="utf-8") as f:
        declared_vars = set()
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key = line.split("=")[0].strip()
                if key:
                    declared_vars.add(key)

    # Patterns to match os.getenv("VAR") and os.environ.get("VAR") or os.environ["VAR"]
    patterns = [
        re.compile(r'os\.getenv\(\s*["\']([A-Z0-9_]+)["\']'),
        re.compile(r'os\.environ\.get\(\s*["\']([A-Z0-9_]+)["\']'),
        re.compile(r'os\.environ\[\s*["\']([A-Z0-9_]+)["\']'),
        re.compile(r'["\']([A-Z0-9_]+)["\']\s+in\s+os\.environ'),
    ]

    found_vars = set()
    for py_file in backend_dir.rglob("*.py"):
        with open(py_file, "r", encoding="utf-8") as f:
            content = f.read()
            for pattern in patterns:
                for match in pattern.findall(content):
                    found_vars.add(match)

    # Exclude system / internal test vars if any
    ignored = {"PATH"}
    used_vars = found_vars - ignored

    missing = used_vars - declared_vars
    assert not missing, f"Variables used in backend but missing from .env.example: {missing}"
