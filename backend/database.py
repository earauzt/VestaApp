"""VestaApp ya no usa MongoDB — esto expone el mismo objeto `db` que antes
(`from database import db`), pero respaldado por Supabase (ver mongo_shim.py).
Ningun archivo de rutas necesita cambiar sus imports por este swap.
"""
from mongo_shim import _DB


class _ClientCompat:
    """Compat: server.py llama client.close() al shutdown; supabase-py no lo necesita."""
    def close(self):
        pass


db = _DB()
client = _ClientCompat()
MONGO_URL = None
DB_NAME = None
