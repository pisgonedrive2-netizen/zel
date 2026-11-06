#!/usr/bin/env python3
"""31 Temmuz 2026: Ramiz + Ponpon bordro ödemesi ve kasa talebi (geriye dönük kayıt)."""
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
env = (ROOT / ".env.local").read_text()


def get(k: str) -> str:
    m = re.search(rf"^{re.escape(k)}=(.*)$", env, re.M)
    if not m:
        raise SystemExit(f"missing {k}")
    return m.group(1).strip().strip('"').strip("'")


URL = get("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
KEY = get("SUPABASE_SERVICE_ROLE_KEY")
PONPON = "c5fba5c8-a7ec-49be-84a5-31b10bb08309"
PAID = "2026-07-31"
KTX_IN = "ktx-2026-07-31-in-maas-kasa"
KTX_RAMIZ = "ktx-2026-07-31-out-ramiz"
KTX_PONPON = "ktx-2026-07-31-out-ponpon"


def req(method: str, path: str, params: str = "", body=None, extra=None):
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra:
        headers.update(extra)
    data = None if body is None else json.dumps(body).encode()
    url = f"{URL}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as res:
            raw = res.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise SystemExit(f"{method} {path}?{params} -> {e.code} {err[:800]}")


def get_rows(path: str, params: str):
    return req("GET", path, params) or []


ce = get_rows(
    "content_expenses",
    "select=id,amount_usd,category,description,review_status,salary_extra_id"
    "&employee_id=eq.emp-ramiz&month=eq.2026-07&review_status=eq.approved"
    "&order=amount_usd.desc",
)
content_sum = round(sum(x["amount_usd"] for x in ce), 2)
if content_sum != 6894:
    raise SystemExit(f"approved content sum {content_sum} != 6894")

ramiz_lines = [
    {
        "lineId": "base",
        "kind": "base_salary",
        "label": "Temel maaş",
        "amountUsd": 10000,
        "paid": True,
        "paidDate": PAID,
        "paidBy": "u-admin",
        "kasaTxId": KTX_RAMIZ,
    },
    {
        "lineId": "rent",
        "kind": "rent",
        "label": "Kira desteği",
        "amountUsd": 1400,
        "paid": True,
        "paidDate": PAID,
        "paidBy": "u-admin",
        "kasaTxId": KTX_RAMIZ,
    },
]
for x in ce:
    desc = (x.get("description") or "").strip().replace("\n", " ")
    label = f"İçerik · {desc}" if desc else f"İçerik · {x['category']}"
    if len(label) > 140:
        label = label[:137] + "…"
    ramiz_lines.append(
        {
            "lineId": f"content:{x['id']}",
            "kind": "content_payroll",
            "label": label,
            "amountUsd": x["amount_usd"],
            "refId": x["id"],
            "paid": True,
            "paidDate": PAID,
            "paidBy": "u-admin",
            "kasaTxId": KTX_RAMIZ,
        }
    )

ramiz_total = round(sum(l["amountUsd"] for l in ramiz_lines), 2)
if ramiz_total != 18294:
    raise SystemExit(f"ramiz total {ramiz_total} != 18294")

# Deduction extra reduces the base line (1500 − 100 = 1400).
ponpon_lines = [
    {
        "lineId": "base",
        "kind": "base_salary",
        "label": "Temel maaş",
        "amountUsd": 1400,
        "paid": True,
        "paidDate": PAID,
        "paidBy": "u-admin",
        "kasaTxId": KTX_PONPON,
    },
]

print("insert ponpon advance deduction")
req(
    "POST",
    "salary_extras",
    params="on_conflict=id",
    extra={"Prefer": "return=representation,resolution=merge-duplicates"},
    body={
        "id": "se-ponpon-adv-2026-07",
        "employee_id": PONPON,
        "month": "2026-07",
        "amount": 100,
        "description": "Açık avans geri ödemesi (1/6) · $600 → kalan $500",
        "type": "deduction",
        "content_expense_id": None,
    },
)

print("insert kasa txs")
kasa_rows = [
    {
        "id": KTX_IN,
        "kasa_id": "kasa-genel",
        "date": f"{PAID}T12:00:00+00:00",
        "direction": "in",
        "amount_usd": 28104,
        "fee_usd": 0,
        "purpose": "Temmuz maaş + kasa talebi",
        "counterparty": "",
        "proof": "",
        "notes": "Personel 19.694 (Ramiz 18.294 + Ponpon 1.400) + kasa talebi 8.410. Maaş sonrası fiziki kasa 1.591 + 8.410 = 10.001.",
        "auto_imported": False,
        "count_in_genel": False,
    },
    {
        "id": KTX_RAMIZ,
        "kasa_id": "kasa-genel",
        "date": f"{PAID}T12:10:00+00:00",
        "direction": "out",
        "amount_usd": 18294,
        "fee_usd": 0,
        "purpose": "Ramiz Temmuz Ayı Ödemesi",
        "counterparty": "Ramiz",
        "proof": "",
        "notes": "Maaş 10.000 + kira 1.400 + içerik 6.894 (22 onaylı kalem)",
        "auto_imported": False,
        "count_in_genel": False,
    },
    {
        "id": KTX_PONPON,
        "kasa_id": "kasa-genel",
        "date": f"{PAID}T12:15:00+00:00",
        "direction": "out",
        "amount_usd": 1400,
        "fee_usd": 0,
        "purpose": "Ponpon Temmuz Ayı Ödemesi",
        "counterparty": "Ponpon",
        "proof": "",
        "notes": "Maaş 1.500 − avans taksiti 100",
        "auto_imported": False,
        "count_in_genel": False,
    },
]
req(
    "POST",
    "kasa_transactions",
    params="on_conflict=id",
    extra={"Prefer": "return=representation,resolution=merge-duplicates"},
    body=kasa_rows,
)

print("upsert payment statuses")
req(
    "POST",
    "payment_statuses",
    params="on_conflict=employee_id,month",
    extra={"Prefer": "return=representation,resolution=merge-duplicates"},
    body=[
        {
            "employee_id": "emp-ramiz",
            "month": "2026-07",
            "paid": True,
            "paid_date": PAID,
            "paid_by": "u-admin",
            "approved_at": f"{PAID}T12:10:00+00:00",
            "kasa_tx_id": KTX_RAMIZ,
            "line_payments": ramiz_lines,
        },
        {
            "employee_id": PONPON,
            "month": "2026-07",
            "paid": True,
            "paid_date": PAID,
            "paid_by": "u-admin",
            "approved_at": f"{PAID}T12:15:00+00:00",
            "kasa_tx_id": KTX_PONPON,
            "line_payments": ponpon_lines,
        },
    ],
)

print("mark approved july content paid")
ids = ",".join(x["id"] for x in ce)
req(
    "PATCH",
    "content_expenses",
    params=f"id=in.({ids})",
    extra={"Prefer": "return=minimal"},
    body={"paid": True, "paid_date": PAID},
)

print("unmark accidental Ramiz August paid (dated 2026-07-09, empty lines)")
req(
    "PATCH",
    "payment_statuses",
    params="employee_id=eq.emp-ramiz&month=eq.2026-08",
    extra={"Prefer": "return=representation"},
    body={
        "paid": False,
        "paid_date": None,
        "paid_by": None,
        "approved_at": None,
        "kasa_tx_id": None,
        "line_payments": [],
    },
)

print("OK ramiz", ramiz_total, "content", content_sum, "lines", len(ramiz_lines))
