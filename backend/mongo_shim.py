"""Capa de compatibilidad Mongo -> Supabase.

VestaApp se escribio entero contra la API de consultas de Motor/MongoDB
(`db.coleccion.find_one({...})`, `update_one({...}, {"$set": {...}})`, etc.).
Reescribir cada uno de los ~12 archivos de routes/ a mano contra el query
builder de Supabase es una superficie enorme para traducir sin poder probar
en vivo. Este modulo expone el MISMO patron de llamadas (`db.coleccion.metodo(...)`)
pero contra las tablas `vesta_*` de Supabase por debajo — asi los archivos de
rutas casi no necesitan cambiar.

Cubre el subconjunto de MongoDB realmente usado en este codebase: find_one,
find (con sort/limit/to_list), insert_one, update_one (soporta $set/$inc/$push/
$unset, incluida notacion de punto para columnas jsonb), delete_one,
count_documents, y aggregate (solo para los 2 pipelines que existen: uno es
match+sort, el otro es match+group con sum/cond, ambos resueltos en Python).
"""
import os
import re
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from postgrest.exceptions import APIError

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

_sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else None

COLLECTION_TABLE_MAP = {
    "transactions": "vesta_transactions",
    "incomes": "vesta_incomes",
    "credit_cards": "vesta_credit_cards",
    "debt_payments": "vesta_debt_payments",
    "scheduled_payments": "vesta_scheduled_payments",
    "expected_income": "vesta_expected_income",
    "accounts_receivable": "vesta_accounts_receivable",
    "travel_goals": "vesta_travel_goals",
    "travel_funds": "vesta_travel_funds",
    "known_vendors": "vesta_known_vendors",
    "categorization_rules": "vesta_categorization_rules",
    "chat_history": "vesta_chat_history",
    "personal_budgets": "vesta_personal_budgets",
    "budgets": "vesta_budgets",
    "gmail_tokens": "vesta_gmail_tokens",
    "gmail_oauth_states": "vesta_gmail_oauth_states",
    "gmail_documents": "vesta_gmail_documents",
    "gmail_transactions": "vesta_gmail_transactions",
    "parser_alerts": "vesta_parser_alerts",
    "statement_uploads": "vesta_statement_uploads",
    "bank_accounts": "vesta_bank_accounts",
    "deferred_payments": "vesta_deferred_payments",
    "sri_categorias": "vesta_sri_categorias",
    "profile": "vesta_profile",
}

# Columnas jsonb por tabla (para saber cuando un update de notacion de punto
# o un $push/$inc necesita leer-modificar-escribir en vez de un update directo).
JSONB_COLUMNS = {
    "vesta_transactions": {"attachments", "fuentes"},
    "vesta_travel_goals": {"linked_transactions"},
    "vesta_travel_funds": {"deposits"},
    "vesta_known_vendors": {"aliases"},
    "vesta_categorization_rules": {"keywords"},
    "vesta_personal_budgets": {"categories", "income_projection"},
    "vesta_budgets": {"items"},
    "vesta_accounts_receivable": {"payment_history"},
    "vesta_gmail_tokens": {"scopes"},
    "vesta_gmail_documents": {"raw"},
    "vesta_gmail_transactions": {"raw"},
    "vesta_parser_alerts": {"detalle"},
    "vesta_statement_uploads": {"final_stats", "card_info"},
}


def _unescape_regex(pattern: str) -> str:
    """re.escape() agrega backslashes antes de caracteres especiales; los quitamos
    para volver al texto plano que se usa con ilike."""
    return re.sub(r'\\(.)', r'\1', pattern)


def _strip_anchors(pattern: str):
    """Detecta si un $regex es un match exacto anclado (^...$) o un 'contains'."""
    exact = pattern.startswith('^') and pattern.endswith('$')
    text = pattern
    if text.startswith('^'):
        text = text[1:]
    if text.endswith('$'):
        text = text[:-1]
    return _unescape_regex(text), exact


def _or_clause_part(key, val) -> str:
    """Una condicion dentro de un $or, en sintaxis PostgREST 'campo.op.valor'."""
    if val is None:
        return f"{key}.is.null"
    if isinstance(val, dict):
        for op, opval in val.items():
            if op == "$exists":
                return f"{key}.is.null" if not opval else f"{key}.not.is.null"
            if op == "$ne":
                return f"{key}.is.null" if opval is None else f"{key}.neq.{opval}"
            if op == "$gte":
                return f"{key}.gte.{opval}"
            if op == "$lte":
                return f"{key}.lte.{opval}"
        return f"{key}.is.null"
    return f"{key}.eq.{val}"


def _apply_filter(q, filt: dict):
    for key, val in (filt or {}).items():
        if key == "$or":
            parts = []
            for sub in val:
                for k2, v2 in sub.items():
                    parts.append(_or_clause_part(k2, v2))
            # de-duplicar (ej. dos ramas de un $or que ambas terminan en "is null")
            q = q.or_(",".join(dict.fromkeys(parts)))
            continue
        if isinstance(val, dict) and any(k.startswith("$") for k in val.keys()):
            for op, opval in val.items():
                if op == "$gte":
                    q = q.gte(key, opval)
                elif op == "$lte":
                    q = q.lte(key, opval)
                elif op == "$gt":
                    q = q.gt(key, opval)
                elif op == "$lt":
                    q = q.lt(key, opval)
                elif op == "$ne":
                    q = q.neq(key, opval) if opval is not None else q.not_.is_("null", key)
                elif op == "$in":
                    q = q.in_(key, list(opval))
                elif op == "$nin":
                    q = q.not_.in_(key, list(opval))
                elif op == "$regex":
                    text, exact = _strip_anchors(opval)
                    q = q.ilike(key, text if exact else f"%{text}%")
                elif op == "$exists":
                    # Sin sub-indice (ej. "campo.1") no distinguimos "no existe" de "array corto";
                    # aproximamos a not-null / is-null, suficiente para los usos actuales.
                    base_key = key.split(".")[0]
                    q = q.not_.is_("null", base_key) if opval else q.is_("null", base_key)
                # $options se procesa junto con $regex, no necesita rama propia
        elif val is None:
            q = q.is_("null", key)
        else:
            q = q.eq(key, val)
    return q


def _strip_id(doc):
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    extra = doc.pop("extra", None)
    if extra:
        for k, v in extra.items():
            doc.setdefault(k, v)
    return doc


_MISSING_COLUMN_RE = re.compile(r"Could not find the '([^']+)' column")


def _missing_column(exc: Exception):
    """Mongo era schema-less; el codigo original guarda campos que la tabla
    Postgres actual no tiene. En vez de un 500, detectamos el error de columna
    faltante de PostgREST (PGRST204) y devolvemos el nombre de la columna para
    que el llamador la mueva a la columna `extra` (jsonb) de respaldo."""
    msg = str(getattr(exc, "message", "") or exc)
    m = _MISSING_COLUMN_RE.search(msg)
    return m.group(1) if m else None


class _Cursor:
    def __init__(self, table: str, filt: dict, projection=None):
        self._table = table
        self._filt = filt or {}
        self._sort = []
        self._limit_n = None

    def sort(self, key, direction=1):
        self._sort.append((key, direction))
        return self

    def limit(self, n):
        self._limit_n = n
        return self

    def _build(self):
        q = _sb.table(self._table).select("*")
        q = _apply_filter(q, self._filt)
        for key, direction in self._sort:
            q = q.order(key, desc=(direction == -1))
        if self._limit_n:
            q = q.limit(self._limit_n)
        return q

    async def to_list(self, length=None):
        if length and not self._limit_n:
            self._limit_n = length
        q = self._build()
        resp = await asyncio.to_thread(q.execute)
        return [_strip_id(d) for d in (resp.data or [])]

    def __aiter__(self):
        self._iter_rows = None
        self._iter_idx = 0
        return self

    async def __anext__(self):
        if self._iter_rows is None:
            self._iter_rows = await self.to_list()
            self._iter_idx = 0
        if self._iter_idx >= len(self._iter_rows):
            raise StopAsyncIteration
        row = self._iter_rows[self._iter_idx]
        self._iter_idx += 1
        return row


class _Result:
    def __init__(self, matched_count=0, upserted_id=None, deleted_count=None):
        self.matched_count = matched_count
        self.modified_count = matched_count
        self.deleted_count = deleted_count if deleted_count is not None else matched_count
        self.upserted_id = upserted_id


class _Collection:
    def __init__(self, name: str):
        self.table = COLLECTION_TABLE_MAP.get(name, name)

    async def find_one(self, filt=None, projection=None, sort=None):
        q = _sb.table(self.table).select("*")
        q = _apply_filter(q, filt or {})
        if sort:
            for key, direction in sort:
                q = q.order(key, desc=(direction == -1))
        q = q.limit(1)
        resp = await asyncio.to_thread(q.execute)
        rows = resp.data or []
        return _strip_id(rows[0]) if rows else None

    def find(self, filt=None, projection=None):
        return _Cursor(self.table, filt, projection)

    async def insert_one(self, doc: dict):
        clean = {k: v for k, v in doc.items() if k != "_id"}
        for _ in range(10):
            try:
                await asyncio.to_thread(lambda p=clean: _sb.table(self.table).insert(p).execute())
                return type("InsertResult", (), {"inserted_id": clean.get("id")})()
            except APIError as e:
                col = _missing_column(e)
                if not col or col not in clean:
                    raise
                clean.setdefault("extra", {})[col] = clean.pop(col)
        raise RuntimeError(f"insert_one: demasiadas columnas faltantes en {self.table}")

    async def insert_many(self, docs: list):
        clean = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        for _ in range(10):
            if not clean:
                break
            try:
                await asyncio.to_thread(lambda p=clean: _sb.table(self.table).insert(p).execute())
                break
            except APIError as e:
                col = _missing_column(e)
                moved = False
                for d in clean:
                    if col and col in d:
                        d.setdefault("extra", {})[col] = d.pop(col)
                        moved = True
                if not moved:
                    raise
        return type("InsertManyResult", (), {"inserted_ids": [d.get("id") for d in clean]})()

    async def _fetch_one_raw(self, filt):
        q = _sb.table(self.table).select("*")
        q = _apply_filter(q, filt or {})
        q = q.limit(1)
        resp = await asyncio.to_thread(q.execute)
        rows = resp.data or []
        if not rows:
            return None
        row = dict(rows[0])
        for k, v in (row.get("extra") or {}).items():
            row.setdefault(k, v)
        return row

    async def update_one(self, filt: dict, update: dict, upsert: bool = False):
        jsonb_cols = JSONB_COLUMNS.get(self.table, set())
        current = await self._fetch_one_raw(filt)

        set_fields = dict(update.get("$set", {}))
        inc_fields = update.get("$inc", {})
        push_fields = update.get("$push", {})
        unset_fields = update.get("$unset", {})

        # Notacion de punto ("categories.Foo") -> leer-modificar-escribir sobre la columna jsonb.
        nested_updates = {}
        for key in list(set_fields.keys()):
            if "." in key:
                col, subkey = key.split(".", 1)
                nested_updates.setdefault(col, {})[subkey] = set_fields.pop(key)
        for key in list(unset_fields.keys()):
            if "." in key:
                col, subkey = key.split(".", 1)
                nested_updates.setdefault(col, {})[subkey] = "__DELETE__"

        base = dict(current) if current else {}
        for col, changes in nested_updates.items():
            current_json = dict((current or {}).get(col) or {}) if current else {}
            for subkey, val in changes.items():
                if val == "__DELETE__":
                    current_json.pop(subkey, None)
                else:
                    current_json[subkey] = val
            set_fields[col] = current_json

        for key, delta in inc_fields.items():
            base_val = (current or {}).get(key, 0) or 0
            set_fields[key] = base_val + delta

        for key, val in push_fields.items():
            existing = list((current or {}).get(key) or [])
            existing.append(val)
            set_fields[key] = existing

        if current:
            if set_fields:
                existing_extra = dict(current.get("extra") or {})
                for _ in range(10):
                    try:
                        q = _sb.table(self.table).update(set_fields)
                        q = _apply_filter(q, filt)
                        await asyncio.to_thread(q.execute)
                        break
                    except APIError as e:
                        col = _missing_column(e)
                        if not col or col not in set_fields:
                            raise
                        existing_extra[col] = set_fields.pop(col)
                        set_fields["extra"] = existing_extra
            return _Result(matched_count=1)
        elif upsert:
            new_doc = {**filt, **set_fields}
            for col, changes in nested_updates.items():
                merged = {k: v for k, v in changes.items() if v != "__DELETE__"}
                new_doc[col] = merged
            new_doc = {k: v for k, v in new_doc.items() if not isinstance(v, dict) or k not in ("$or",)}
            for _ in range(10):
                try:
                    await asyncio.to_thread(lambda p=new_doc: _sb.table(self.table).upsert(p).execute())
                    break
                except APIError as e:
                    col = _missing_column(e)
                    if not col or col not in new_doc:
                        raise
                    new_doc.setdefault("extra", {})[col] = new_doc.pop(col)
            return _Result(matched_count=0, upserted_id=new_doc.get("id"))
        return _Result(matched_count=0)

    async def update_many(self, filt: dict, update: dict):
        set_fields = dict(update.get("$set", {}))
        if not set_fields:
            return _Result(matched_count=0)
        for _ in range(10):
            try:
                q = _sb.table(self.table).update(set_fields)
                q = _apply_filter(q, filt)
                resp = await asyncio.to_thread(q.execute)
                return _Result(matched_count=len(resp.data or []))
            except APIError as e:
                col = _missing_column(e)
                if not col or col not in set_fields:
                    raise
                # update_many no tiene una fila "current" por registro para mezclar
                # con su extra individual; se descarta el campo desconocido en vez
                # de arriesgar sobreescribir el extra de otras filas.
                logger.warning("update_many: columna '%s' no existe en %s, se omite", col, self.table)
                set_fields.pop(col)
                if not set_fields:
                    return _Result(matched_count=0)
        return _Result(matched_count=0)

    async def delete_one(self, filt: dict):
        q = _sb.table(self.table).delete()
        q = _apply_filter(q, filt)
        resp = await asyncio.to_thread(q.execute)
        return _Result(matched_count=len(resp.data or []))

    async def count_documents(self, filt=None):
        q = _sb.table(self.table).select("id", count="exact")
        q = _apply_filter(q, filt or {})
        resp = await asyncio.to_thread(q.execute)
        return resp.count or 0

    def aggregate(self, pipeline: list):
        return _AggregateCursor(self.table, pipeline)


class _AggregateCursor:
    """Soporta unicamente los 2 pipelines reales de este codebase:
    [$match, $sort] y [$match, $group con $sum/$cond] — ambos resueltos
    trayendo las filas filtradas y agregando en Python."""

    def __init__(self, table: str, pipeline: list):
        self.table = table
        self.pipeline = pipeline

    async def _rows(self):
        filt = {}
        sort = []
        for stage in self.pipeline:
            if "$match" in stage:
                filt = stage["$match"]
            if "$sort" in stage:
                sort = list(stage["$sort"].items())
        q = _sb.table(self.table).select("*")
        q = _apply_filter(q, filt)
        for key, direction in sort:
            q = q.order(key, desc=(direction == -1))
        resp = await asyncio.to_thread(q.execute)
        return [_strip_id(d) for d in (resp.data or [])]

    async def _grouped(self):
        rows = await self._rows()
        group_stage = next((s["$group"] for s in self.pipeline if "$group" in s), None)
        if not group_stage:
            return rows
        group_key_field = group_stage["_id"].lstrip("$")
        buckets = {}
        for row in rows:
            key = row.get(group_key_field)
            b = buckets.setdefault(key, {"_id": key, "total": 0, "null_monto": 0})
            b["total"] += 1
            if row.get("monto") is None:
                b["null_monto"] += 1
        return list(buckets.values())

    async def to_list(self, length=None):
        has_group = any("$group" in s for s in self.pipeline)
        rows = await (self._grouped() if has_group else self._rows())
        return rows[:length] if length else rows

    def __aiter__(self):
        self._pending = None
        self._idx = 0
        return self

    async def __anext__(self):
        if self._pending is None:
            has_group = any("$group" in s for s in self.pipeline)
            self._pending = await (self._grouped() if has_group else self._rows())
            self._idx = 0
        if self._idx >= len(self._pending):
            raise StopAsyncIteration
        row = self._pending[self._idx]
        self._idx += 1
        return row


class _DB:
    def __getattr__(self, name):
        return _Collection(name)
