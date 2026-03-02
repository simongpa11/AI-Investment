"""
Direct DB migration script using psycopg2 or supabase management API.
Run: python3 migrate.py
"""
import urllib.request
import json
import sys

SUPABASE_URL = "https://wlvatpforyjbdsodqdza.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdmF0cGZvcnlqYmRzb2RxZHphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NTQ1MiwiZXhwIjoyMDg4MDMxNDUyfQ.VyghCQUc66hzw9XjSvEkmawPDovjRHm2D_g9oHdbwT4"

# SQL statements to execute one by one via PostgREST RPC if available,
# or print for manual execution
SQL_STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS structural_scores (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        name TEXT,
        sector TEXT,
        trend_persistence_score INTEGER NOT NULL DEFAULT 0,
        structural_state TEXT NOT NULL DEFAULT 'none',
        phase TEXT NOT NULL DEFAULT 'Emerging',
        duration_days INTEGER DEFAULT 0,
        volume_change_ratio FLOAT DEFAULT 1.0,
        volatility_compression_days INTEGER DEFAULT 0,
        relative_strength_20d FLOAT DEFAULT 0.0,
        current_price FLOAT DEFAULT 0.0,
        ma50 FLOAT DEFAULT 0.0,
        ma200 FLOAT DEFAULT 0.0,
        details_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(symbol, date)
    )""",
    """CREATE TABLE IF NOT EXISTS narrative_scores (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        narrative_persistence_score INTEGER NOT NULL DEFAULT 0,
        narrative_type TEXT DEFAULT 'other',
        source_quality FLOAT DEFAULT 0.0,
        tone_change TEXT DEFAULT 'stable',
        summary_ai TEXT,
        article_count INTEGER DEFAULT 0,
        details_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(symbol, date)
    )""",
    """CREATE TABLE IF NOT EXISTS score_history (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        structural_score INTEGER DEFAULT 0,
        narrative_score INTEGER DEFAULT 0,
        combined_score INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(symbol, date)
    )""",
    """CREATE TABLE IF NOT EXISTS watchlist (
        id BIGSERIAL PRIMARY KEY,
        symbol TEXT NOT NULL UNIQUE,
        added_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE
    )""",
]

def run_sql_via_rpc(sql):
    """Try to run SQL via Supabase pg-meta endpoint."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/query"
    data = json.dumps({"sql": sql}).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True, resp.read().decode()
    except Exception as e:
        return False, str(e)

print("🔧 AI Investment Platform — Database Migration")
print("=" * 50)

# Try via pg-meta
success_count = 0
for i, sql in enumerate(SQL_STATEMENTS, 1):
    table = sql.strip().split("(")[0].replace("CREATE TABLE IF NOT EXISTS ", "").strip()
    ok, result = run_sql_via_rpc(sql)
    if ok:
        print(f"✅ [{i}/4] {table} created")
        success_count += 1
    else:
        print(f"❌ [{i}/4] {table} — could not create via API")

if success_count == 0:
    print("")
    print("⚠️  Direct SQL execution not available via REST API.")
    print("Please run the schema manually:")
    print("")
    print("1. Open: https://supabase.com/dashboard/project/wlvatpforyjbdsodqdza/sql/new")
    print("2. Copy and run the contents of: backend/db/schema.sql")
    print("")
    print("OR install psycopg2 and set DATABASE_URL:")
    print("   pip3 install psycopg2-binary")
    print("   python3 migrate_psql.py")
else:
    print(f"\n✅ Migration complete ({success_count}/4 tables)")
