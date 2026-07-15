"""
fetch_antrian.py — Fetch data antrian dari dashboard Wings Corp via direct API
Menggunakan requests library (HTTP biasa) — tidak perlu Playwright/Chromium
"""

import requests

# ─── KONFIGURASI ──────────────────────────────────────────────────────────────
DEFAULT_CONFIG = {
    "dashboard_url": "https://dashboardcpmanuf.wingscorp.com:3000",
    "api_path": "/dashboard/antrianTimbang",
    "plant": "1001",
    "transplan": "H191",
    "typeCode": "",
    "timeout": 15,
}

# ─── FILTER: hanya yang masuk antrian (timbang_in) dengan tipe Bongkar ────────
def _is_bongkar(type_desc: str) -> bool:
    if not type_desc:
        return False
    t = type_desc.lower()
    return "bongkar" in t


def fetch_antrian(config: dict = None) -> dict:
    """
    Panggil API dashboard, return data yang sudah difilter.

    Returns:
        {"success": True/False,
         "data": [{"no_polisi": "...", "vendor": "..."}, ...],
         "error": "..." (jika gagal)}
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    url = cfg["dashboard_url"].rstrip("/") + cfg["api_path"]
    params = {
        "transplan": cfg.get("transplan", ""),
        "plant": cfg.get("plant", ""),
        "typeCode": cfg.get("typeCode", ""),
    }

    try:
        resp = requests.get(url, params=params, timeout=cfg.get("timeout", 15))
        resp.raise_for_status()
        json_data = resp.json()
    except requests.exceptions.Timeout:
        return {"success": False, "data": [], "error": "Timeout koneksi ke dashboard"}
    except requests.exceptions.ConnectionError as e:
        return {"success": False, "data": [], "error": f"Gagal koneksi: {e}"}
    except requests.exceptions.HTTPError as e:
        return {"success": False, "data": [], "error": f"HTTP {e.response.status_code}"}
    except ValueError:
        return {"success": False, "data": [], "error": "Response bukan JSON"}

    # Ambil data timbang_in
    try:
        timbang_in = json_data.get("data", {}).get("timbang_in", {})
        raw_items = timbang_in.get("data", [])
    except (AttributeError, TypeError):
        return {"success": False, "data": [], "error": "Struktur response tidak dikenali"}

    if not raw_items:
        return {"success": True, "data": [], "error": None}

    # Filter: hanya Bongkar, ambil no_polisi + vendor
    filtered = []
    for item in raw_items:
        type_desc = item.get("type_desc", "")
        if not _is_bongkar(type_desc):
            continue

        no_polisi = (item.get("no_vehicle") or "").strip().upper()
        vendor = (item.get("vendor_txt") or "").strip()

        if no_polisi:
            filtered.append({
                "no_polisi": no_polisi,
                "vendor": vendor,
                "type_desc": type_desc,
            })

    return {"success": True, "data": filtered, "error": None}


# ─── CLI MODE ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    import sys

    result = fetch_antrian()
    if result["success"] and result["data"]:
        print(f"  ✅ Berhasil! {len(result['data'])} kendaraan:\n")
        for i, item in enumerate(result["data"], 1):
            print(f"  {i}. {item['no_polisi']:12s} | {item['vendor'][:40]:40s} | {item['type_desc']}")
    elif result["success"]:
        print("  ✅ Berhasil, tapi tidak ada data Bongkar masuk.")
        print(f"  Error: {result['error']}")
    else:
        print(f"  ❌ Gagal: {result['error']}")
        sys.exit(1)
