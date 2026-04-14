import gspread
from google.oauth2.service_account import Credentials
from db import list_data

GSHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def load_data(automation_id: str, data_source: dict) -> list[dict]:
    """Return a list of row dicts based on data source type."""
    src_type = data_source.get("type", "manual")

    if src_type == "manual" or src_type == "supabase_table":
        rows = list_data(automation_id)
        return [r["data"] | {"_id": r["id"], "_last_processed": r.get("last_processed", "")} for r in rows]

    if src_type == "google_sheets":
        sheet_id = data_source.get("sheet_id", "")
        sheet_name = data_source.get("sheet_name", "Sheet1")
        creds_path = data_source.get("creds_path", "")
        creds = Credentials.from_service_account_file(creds_path, scopes=GSHEETS_SCOPES)
        gc = gspread.authorize(creds)
        sh = gc.open_by_key(sheet_id)
        ws = sh.worksheet(sheet_name) if sheet_name else sh.sheet1
        records = ws.get_all_records()
        return [{k.lower().strip().replace(" ", "_"): str(v).strip() for k, v in r.items()} for r in records]

    return []
