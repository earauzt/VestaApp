"""Tests for bank email parsers using realistic email fixtures."""
import pytest
from parsers import (
    dispatch,
    parse_pacificard_consumo,
    parse_diners_consumo,
    parse_pichincha_consumo,
    parse_bolivariano_consumo,
    parse_pacifico_pago,
    parse_pichincha_transferencia,
    parse_pichincha_estado,
    parse_pacificard_estado,
    parse_pacifico_estado,
    parse_bolivariano_estado,
)


# ─── Fixtures ─────────────────────────────────────────────────────

PACIFICARD_CONSUMO_HTML = """
<html><body>
<p>Estimado cliente,</p>
<p>Se ha realizado una transacción con su tarjeta:</p>
<p>Establecimiento: <b>SUPERMAXI SAMBORONDON</b></p>
<p>Fecha de la transacción 2026-03-15 a las 14:32</p>
<p>Monto $ 85.50.</p>
<p>Tarjeta: 545178XXXXXXX325</p>
</body></html>
"""

PACIFICARD_CONSUMO_HTML_2 = """
<html><body>
<p>Estimado cliente,</p>
<p>Se ha realizado una transacción con su tarjeta:</p>
<p>Establecimiento: <b>NETFLIX.COM</b></p>
<p>Fecha de la transacción 2026-04-01 a las 09:00</p>
<p>Monto $ 28.28.</p>
<p>Tarjeta: 545178XXXXXXX325</p>
</body></html>
"""

DINERS_CONSUMO_HTML = """
<html><body>
<p>TARJETA TERMINADA EN 128</p>
<table>
<tr><td>Fecha</td><td>Establecimiento</td><td>Valor</td></tr>
<tr><td>2026-03-20 18:45</td><td>RESTAURANT EL CARACOL</td><td>85,34</td></tr>
</table>
</body></html>
"""

DINERS_CONSUMO_HTML_2 = """
<html><body>
<p>TARJETA TERMINADA EN 128</p>
<p>Valor del consumo: 125,00</p>
<p>Establecimiento: FARMACIA FYBECA</p>
</body></html>
"""

PICHINCHA_CONSUMO_HTML = """
<html><body>
<table>
<tr><td>Valor:</td><td>$ 7,95</td></tr>
<tr><td>Establecimiento:</td><td>UBER *TRIP EC</td></tr>
<tr><td>Tarjeta usada:</td><td>***789</td></tr>
<tr><td>Fecha:</td><td>2026-03-18</td></tr>
</table>
</body></html>
"""

PICHINCHA_CONSUMO_HTML_2 = """
<html><body>
<table>
<tr><td>Valor:</td><td>$ 1.250,00</td></tr>
<tr><td>Establecimiento:</td><td>COLEGIO MENOR SAN FRANCISCO</td></tr>
<tr><td>Tarjeta usada:</td><td>***456</td></tr>
<tr><td>Fecha:</td><td>2026-04-05</td></tr>
</table>
</body></html>
"""

BOLIVARIANO_CONSUMO_HTML = """
<html><body>
<p>Se ha registrado una compra con tarjeta</p>
<p>Monto: 1.50 USD</p>
<p>Tarjeta: **** **** **** *351</p>
<p>Comercio: TIENDA VIRTUAL AMAZON</p>
<p>Fecha: 2026-03-22 10:15:30</p>
</body></html>
"""

BOLIVARIANO_CONSUMO_HTML_2 = """
<html><body>
<p>Se ha registrado una compra con tarjeta</p>
<p>Monto: 45.99 USD</p>
<p>Tarjeta: **** **** **** *351</p>
<p>Comercio: PRIMAX ESTACION SAMBORONDON</p>
<p>Fecha: 2026-04-10 08:30:00</p>
</body></html>
"""

PACIFICO_PAGO_HTML = """
<html><body>
<p>Estimado cliente, se ha registrado el pago de su tarjeta</p>
<p>Valor: $2,500.00</p>
<p>Tarjeta destino: 4516 **** **** 9012</p>
<p>Banco destino: Pacificard</p>
<p>Fecha: 2026-03-25</p>
</body></html>
"""

PACIFICO_PAGO_HTML_2 = """
<html><body>
<p>Pago realizado exitosamente</p>
<p>Valor: $850.00</p>
<p>Tarjeta destino: 3456</p>
<p>Fecha: 2026-04-08</p>
</body></html>
"""

PICHINCHA_TRANSFER_HTML = """
<html><body>
<p>Transferencia realizada con éxito</p>
<p>Monto: USD 15000.00</p>
<p>Cuenta origen: 2200123456</p>
<p>Banco destino: Banco Bolivariano</p>
<p>Fecha: 2026-03-28</p>
</body></html>
"""

PICHINCHA_TRANSFER_HTML_2 = """
<html><body>
<p>Transferencia interbancaria</p>
<p>Valor: USD 3500.50</p>
<p>Fecha: 2026-04-12</p>
</body></html>
"""

PICHINCHA_ESTADO_HTML = """
<html><body>
<p>Adjuntamos su estado de cuenta</p>
<p>Tarjeta: **** **** **** 7890</p>
<p>Mínimo a pagar: $125.50</p>
<p>Total a pagar: $3,450.00</p>
</body></html>
"""

PACIFICARD_ESTADO_HTML = """
<html><body>
<p>Estado de cuenta Pacificard</p>
<p>Tarjeta: 5451-78XX-XXXX-X325</p>
<p>Fecha de corte: 24/MAR/2026</p>
<p>Fecha máxima de pago: 08/ABR/2026</p>
<p>Saldo al corte: $4,250.00</p>
<p>Pago mínimo: $212.50</p>
<p>Pago sugerido: $1,500.00</p>
</body></html>
"""

PACIFICARD_ESTADO_HTML_2 = """
<html><body>
<p>Estado de cuenta Pacificard</p>
<p>Tarjeta: 5451-78XX-XXXX-X325</p>
<p>Fecha de corte: 24/ENE/2026</p>
<p>Fecha máxima de pago: 08/FEB/2026</p>
<p>Saldo al corte: $1,800.00</p>
<p>Pago mínimo: $90.00</p>
<p>Pago sugerido: $600.00</p>
</body></html>
"""


# ─── PacifiCard consumo ──────────────────────────────────────────

class TestPacificardConsumo:
    def test_basic_consumo(self):
        r = parse_pacificard_consumo(
            "notificaciones@infopacificard.com.ec",
            "Notificacion de consumo",
            PACIFICARD_CONSUMO_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "consumo"
        assert r["banco"] == "Pacificard"
        assert r["comercio"] == "SUPERMAXI SAMBORONDON"
        assert r["monto"] == 85.50
        assert r["fecha"] == "2026-03-15"
        assert r["tarjeta_ultimos4"] == "325"

    def test_subscription_consumo(self):
        r = parse_pacificard_consumo(
            "notificaciones@infopacificard.com.ec",
            "Notificacion de consumo",
            PACIFICARD_CONSUMO_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 28.28
        assert r["comercio"] == "NETFLIX.COM"

    def test_wrong_sender_returns_none(self):
        r = parse_pacificard_consumo("otro@banco.com", "test", PACIFICARD_CONSUMO_HTML, "")
        assert r is None


# ─── Diners Club consumo ─────────────────────────────────────────

class TestDinersConsumo:
    def test_table_format(self):
        r = parse_diners_consumo(
            "servicios@dinersclub.com.ec",
            "Notificacion de consumo",
            DINERS_CONSUMO_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "consumo"
        assert r["banco"] == "Diners Club"
        assert r["comercio"] == "RESTAURANT EL CARACOL"
        assert r["monto"] == 85.34
        assert r["tarjeta_ultimos4"] == "128"

    def test_fallback_valor(self):
        r = parse_diners_consumo(
            "servicios@dinersclub.com.ec",
            "Consumo aprobado",
            DINERS_CONSUMO_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 125.0
        assert r["comercio"] == "FARMACIA FYBECA"


# ─── Banco Pichincha consumo ─────────────────────────────────────

class TestPichinchaConsumo:
    def test_basic(self):
        r = parse_pichincha_consumo(
            "servicios@tarjetasbancopichincha.com",
            "Consumo aprobado",
            PICHINCHA_CONSUMO_HTML, ""
        )
        assert r is not None
        assert r["monto"] == 7.95
        assert r["comercio"] == "UBER *TRIP EC"
        assert r["tarjeta_ultimos4"] == "789"
        assert r["fecha"] == "2026-03-18"

    def test_large_amount_with_dot_separator(self):
        r = parse_pichincha_consumo(
            "servicios@tarjetasbancopichincha.com",
            "Consumo aprobado",
            PICHINCHA_CONSUMO_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 1250.0
        assert r["comercio"] == "COLEGIO MENOR SAN FRANCISCO"


# ─── Banco Bolivariano consumo ───────────────────────────────────

class TestBolivarianoConsumo:
    def test_basic(self):
        r = parse_bolivariano_consumo(
            "Avisos24@bolivariano.com",
            "Compra con tarjeta aprobada",
            BOLIVARIANO_CONSUMO_HTML, ""
        )
        assert r is not None
        assert r["monto"] == 1.50
        assert r["tarjeta_ultimos4"] == "351"
        assert r["comercio"] == "TIENDA VIRTUAL AMAZON"

    def test_gas_station(self):
        r = parse_bolivariano_consumo(
            "Avisos24@bolivariano.com",
            "Compra con tarjeta aprobada",
            BOLIVARIANO_CONSUMO_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 45.99

    def test_wrong_subject_returns_none(self):
        r = parse_bolivariano_consumo(
            "Avisos24@bolivariano.com",
            "Promocion especial",
            BOLIVARIANO_CONSUMO_HTML, ""
        )
        assert r is None


# ─── Banco del Pacífico pago ─────────────────────────────────────

class TestPacificoPago:
    def test_basic(self):
        r = parse_pacifico_pago(
            "intermail@bancopacifico.ec",
            "Pago de tarjeta",
            PACIFICO_PAGO_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "pago_tarjeta"
        assert r["monto"] == 2500.0

    def test_simple_pago(self):
        r = parse_pacifico_pago(
            "intermail@bancopacifico.ec",
            "Pago registrado",
            PACIFICO_PAGO_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 850.0


# ─── Banco Pichincha transferencia ───────────────────────────────

class TestPichinchaTransferencia:
    def test_basic(self):
        r = parse_pichincha_transferencia(
            "banco@pichincha.com",
            "Transferencia exitosa",
            PICHINCHA_TRANSFER_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "transferencia"
        assert r["monto"] == 15000.0

    def test_interbancaria(self):
        r = parse_pichincha_transferencia(
            "banco@pichincha.com",
            "Transferencia interbancaria",
            PICHINCHA_TRANSFER_HTML_2, ""
        )
        assert r is not None
        assert r["monto"] == 3500.50


# ─── Estado de cuenta parsers ────────────────────────────────────

class TestPichinchaEstado:
    def test_basic(self):
        r = parse_pichincha_estado(
            "documentoselectronicos@pichincha.com",
            "Estado de cuenta",
            PICHINCHA_ESTADO_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "estado_de_cuenta"
        assert r["monto"] == 3450.0
        assert r["has_pdf_attachment"] is True

    def test_wrong_sender(self):
        r = parse_pichincha_estado("otro@banco.com", "test", "", "")
        assert r is None


class TestPacificardEstado:
    def test_basic(self):
        r = parse_pacificard_estado(
            "estadodecuenta@pacificard.ec",
            "Estado de cuenta",
            PACIFICARD_ESTADO_HTML, ""
        )
        assert r is not None
        assert r["tipo"] == "estado_de_cuenta"
        assert r["fecha_corte"] == "2026-03-24"
        assert r["fecha_max_pago"] == "2026-04-08"
        assert r["monto"] == 4250.0
        assert r["has_pdf_attachment"] is True

    def test_january_date(self):
        r = parse_pacificard_estado(
            "estadodecuenta@pacificard.ec",
            "Estado de cuenta enero",
            PACIFICARD_ESTADO_HTML_2, ""
        )
        assert r is not None
        assert r["fecha_corte"] == "2026-01-24"
        assert r["monto"] == 1800.0


class TestPacificoEstado:
    def test_basic(self):
        r = parse_pacifico_estado(
            "estadoscuenta@bancodelpacifico.com.ec",
            "Estado de cuenta",
            "", ""
        )
        assert r is not None
        assert r["tipo"] == "estado_de_cuenta"
        assert r["has_pdf_attachment"] is True

    def test_wrong_sender(self):
        r = parse_pacifico_estado("otro@banco.com", "test", "", "")
        assert r is None


class TestBolivarianoEstado:
    def test_basic(self):
        r = parse_bolivariano_estado(
            "Avisos24@bolivariano.com",
            "Estado de cuenta disponible",
            "", ""
        )
        assert r is not None
        assert r["tipo"] == "estado_de_cuenta_sin_adjunto"
        assert r["notificacion"] is not None
        assert "bolivariano.com" in r["notificacion"]

    def test_wrong_subject(self):
        r = parse_bolivariano_estado(
            "Avisos24@bolivariano.com",
            "Compra con tarjeta",
            "", ""
        )
        assert r is None


# ─── Dispatch ─────────────────────────────────────────────────────

class TestDispatch:
    def test_pacificard_routed(self):
        r = dispatch(
            "notificaciones@infopacificard.com.ec",
            "Notificacion",
            PACIFICARD_CONSUMO_HTML, ""
        )
        assert r is not None
        assert r["parser"] == "parse_pacificard_consumo"

    def test_unknown_sender_returns_none(self):
        r = dispatch("unknown@random.com", "Hello", "<p>test</p>", "test")
        assert r is None

    def test_bolivariano_estado_before_consumo(self):
        """Estado de cuenta should match before consumo for same sender."""
        r = dispatch(
            "Avisos24@bolivariano.com",
            "Estado de cuenta disponible",
            "", ""
        )
        assert r is not None
        assert r["tipo"] == "estado_de_cuenta_sin_adjunto"
