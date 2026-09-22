"""
Reporte PDF de señas activas con más de N días (por defecto 30).

Lee la base de caja (POSTGRES_URL del .env) con psql y arma un PDF apaisado,
agrupado por antigüedad, con el origen de cada seña (reserva online o carga
manual), el método de pago original y avisos útiles para revisarlas:
  - "Turno pasado": seña de reserva online cuyo turno ya ocurrió y la seña
    sigue activa (probablemente no se aplicó al cobrar).
  - "Varias señas": la clienta tiene más de una seña activa en esa moneda.

Uso:
    scripts/.venv/bin/python scripts/reporte-senas-antiguas.py [dias] [carpeta]
"""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

RAIZ = Path(__file__).resolve().parent.parent

ROSA = colors.HexColor("#f9bbc4")
TINTA = colors.HexColor("#4a3540")
TINTA_2 = colors.HexColor("#6b4c57")
TINTA_3 = colors.HexColor("#8b5a6b")
SUAVE = colors.HexColor("#fdf4f6")
BORDE = colors.HexColor("#f0d8de")
ALERTA = colors.HexColor("#8b1538")

METODO = {
    "EFECTIVO": "Efectivo",
    "TARJETA": "Tarjeta",
    "TRANSFERENCIA": "Transferencia",
    "CHEQUE": "Cheque",
    "QR": "QR",
    "GIFT_CARD": "Gift card",
    "MERCADO_PAGO": "Mercado Pago",
}

TRAMOS = [
    (180, None, "Más de 6 meses"),
    (90, 180, "Entre 3 y 6 meses"),
    (60, 90, "Entre 2 y 3 meses"),
    (0, 60, "Entre 30 y 60 días"),
]


def database_url() -> str:
    url = os.environ.get("POSTGRES_URL")
    if url:
        return url
    for linea in (RAIZ / ".env").read_text().splitlines():
        if linea.startswith("POSTGRES_URL="):
            return linea.split("=", 1)[1].strip().strip('"')
    sys.exit("Falta POSTGRES_URL (en el entorno o en .env)")


SQL = """
with base as (
  select p.*,
    coalesce(
      nullif(right(regexp_replace(c0.telefono, '\\D', '', 'g'), 8), ''),
      lower(trim(c0.nombre))
    ) as persona
  from prepagos_guardados p
  left join clientes c0 on c0.id = p.cliente_id
  where p.estado = 'ACTIVO' and p."deletedAt" is null
),
fichas as (
  select persona, count(distinct cliente_id) as n from base group by persona
),
activas as (
  select b.*,
    count(*) over (partition by b.cliente_id, b.moneda) as n_misma_moneda,
    f.n as n_fichas
  from base b
  join fichas f on f.persona is not distinct from b.persona
)
select
  coalesce(c.nombre, '(sin cliente)'),
  coalesce(c.telefono, ''),
  a.monto,
  a.moneda,
  coalesce(a."tipoPago"::text, ''),
  to_char(a."fechaCreacion" at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
  extract(day from now() - a."fechaCreacion")::int,
  coalesce(a."bookingCode", ''),
  coalesce(array_to_string(array(select jsonb_array_elements_text(a."serviciosReservados")), ', '), a."servicioReservado", ''),
  coalesce(a."empleadoReservado", ''),
  coalesce(to_char(a."fechaTurno" at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'), ''),
  case when a."fechaTurno" is not null and a."fechaTurno" < now() then 1 else 0 end,
  a.n_misma_moneda,
  a.n_fichas,
  replace(replace(coalesce(a.observaciones, ''), E'\\t', ' '), E'\\n', ' ')
from activas a
left join clientes c on c.id = a.cliente_id
where a."fechaCreacion" < now() - interval '{dias} days'
order by a."fechaCreacion" asc
"""


def consultar(dias: int):
    salida = subprocess.run(
        ["psql", database_url(), "-At", "-F", "\t", "-c", SQL.format(dias=dias)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    filas = []
    for linea in salida.splitlines():
        if not linea.strip():
            continue
        (nombre, tel, monto, moneda, metodo, fecha, dias_ant, codigo, servicios,
         profesional, turno, turno_pasado, n_moneda, n_fichas, obs) = linea.split("\t")
        filas.append({
            "nombre": nombre,
            "telefono": tel,
            "monto": float(monto),
            "moneda": moneda,
            "metodo": METODO.get(metodo, metodo or "-"),
            "fecha": fecha,
            "dias": int(dias_ant),
            "codigo": codigo,
            "servicios": servicios,
            "profesional": profesional,
            "turno": turno,
            "turno_pasado": turno_pasado == "1",
            "varias": int(n_moneda) > 1,
            "duplicada": int(n_fichas) > 1,
            "obs": obs,
        })
    return filas


def dinero(monto: float, moneda: str) -> str:
    entero = f"{monto:,.0f}".replace(",", ".")
    return f"USD {entero}" if moneda == "USD" else f"$ {entero}"


def esc(texto: str) -> str:
    return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


base = getSampleStyleSheet()
S = {
    "titulo": ParagraphStyle("titulo", parent=base["Title"], fontName="Helvetica-Bold",
                             fontSize=20, leading=24, textColor=TINTA, spaceAfter=2),
    "sub": ParagraphStyle("sub", parent=base["Normal"], fontName="Helvetica",
                          fontSize=10, leading=14, textColor=TINTA_3, spaceAfter=10),
    "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold",
                         fontSize=12.5, leading=16, textColor=TINTA, spaceBefore=12, spaceAfter=5),
    "celda": ParagraphStyle("celda", parent=base["Normal"], fontName="Helvetica",
                            fontSize=8, leading=10, textColor=TINTA),
    "celda_chica": ParagraphStyle("celda_chica", parent=base["Normal"], fontName="Helvetica",
                                  fontSize=7, leading=9, textColor=TINTA_2),
    "num": ParagraphStyle("num", parent=base["Normal"], fontName="Helvetica-Bold",
                          fontSize=8, leading=10, textColor=TINTA, alignment=TA_RIGHT),
    "cab": ParagraphStyle("cab", parent=base["Normal"], fontName="Helvetica-Bold",
                          fontSize=7.5, leading=9, textColor=TINTA),
    "kpi_n": ParagraphStyle("kpi_n", parent=base["Normal"], fontName="Helvetica-Bold",
                            fontSize=15, leading=18, textColor=TINTA, alignment=TA_CENTER),
    "kpi_l": ParagraphStyle("kpi_l", parent=base["Normal"], fontName="Helvetica",
                            fontSize=8, leading=10, textColor=TINTA_3, alignment=TA_CENTER),
    "nota": ParagraphStyle("nota", parent=base["Normal"], fontName="Helvetica",
                           fontSize=8, leading=11, textColor=TINTA_2),
}


def origen(f) -> str:
    if f["codigo"]:
        partes = [f"<b>Reserva online {esc(f['codigo'])}</b>"]
        if f["servicios"]:
            partes.append(esc(f["servicios"]))
        if f["profesional"]:
            partes.append(f"con {esc(f['profesional'])}")
        if f["turno"]:
            partes.append(f"turno {f['turno']}")
        return " · ".join(partes)
    obs = f["obs"].strip()
    texto = "Carga manual en caja"
    if f["servicios"]:
        texto += f" · {esc(f['servicios'])}"
    ruido = ("Seña ARS creada", "Seña USD creada")
    if obs and not obs.startswith(ruido):
        texto += f"<br/><font color='#8b5a6b'>{esc(obs[:140])}</font>"
    return texto


def avisos(f) -> str:
    marcas = []
    if f["turno_pasado"]:
        marcas.append("Turno pasado")
    if f["varias"]:
        marcas.append("Varias señas")
    if f["duplicada"]:
        marcas.append("Ficha duplicada")
    if not marcas:
        return ""
    return f"<font color='#8b1538'><b>{' · '.join(marcas)}</b></font>"


def tabla_tramo(filas):
    cab = ["Clienta", "Monto", "Método", "Fecha", "Días", "Origen", "Revisar"]
    datos = [[Paragraph(c, S["cab"]) for c in cab]]
    for f in filas:
        cliente = f"<b>{esc(f['nombre'])}</b>"
        if f["telefono"]:
            cliente += f"<br/><font size='7' color='#8b5a6b'>{esc(f['telefono'])}</font>"
        datos.append([
            Paragraph(cliente, S["celda"]),
            Paragraph(dinero(f["monto"], f["moneda"]), S["num"]),
            Paragraph(f["metodo"], S["celda"]),
            Paragraph(f["fecha"], S["celda"]),
            Paragraph(str(f["dias"]), S["num"]),
            Paragraph(origen(f), S["celda_chica"]),
            Paragraph(avisos(f), S["celda_chica"]),
        ])
    anchos = [52 * mm, 24 * mm, 25 * mm, 20 * mm, 12 * mm, 105 * mm, 26 * mm]
    t = Table(datos, colWidths=anchos, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ROSA),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SUAVE]),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def kpis(filas):
    ars = sum(f["monto"] for f in filas if f["moneda"] == "ARS")
    usd = sum(f["monto"] for f in filas if f["moneda"] == "USD")
    pasados = sum(1 for f in filas if f["turno_pasado"])
    revisar = len({f["nombre"] for f in filas if f["varias"] or f["duplicada"]})
    celdas = [
        (str(len(filas)), "señas"),
        (dinero(ars, "ARS"), "total en pesos"),
        (dinero(usd, "USD"), "total en dólares"),
        (str(pasados), "con turno ya pasado"),
        (str(revisar), "clientas con señas repetidas"),
    ]
    fila_n = [Paragraph(n, S["kpi_n"]) for n, _ in celdas]
    fila_l = [Paragraph(l, S["kpi_l"]) for _, l in celdas]
    t = Table([fila_n, fila_l], colWidths=[53 * mm] * 5)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SUAVE),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDE),
        ("LINEAFTER", (0, 0), (-2, -1), 0.6, BORDE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def pie(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(TINTA_3)
    canvas.drawString(12 * mm, 8 * mm, "Mery García · Señas activas antiguas")
    canvas.drawRightString(landscape(A4)[0] - 12 * mm, 8 * mm, f"Página {doc.page}")
    canvas.restoreState()


def main():
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    carpeta = Path(sys.argv[2]) if len(sys.argv) > 2 else RAIZ / "reportes"
    carpeta.mkdir(parents=True, exist_ok=True)

    filas = consultar(dias)
    hoy = datetime.now(timezone.utc).astimezone()
    ruta = carpeta / f"senas-antiguas-{hoy:%Y-%m-%d}.pdf"

    doc = SimpleDocTemplate(
        str(ruta), pagesize=landscape(A4),
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=14 * mm,
        title="Señas activas antiguas", author="Mery García",
    )
    h = [
        Paragraph("Señas activas con más de %d días" % dias, S["titulo"]),
        Paragraph(f"Generado el {hoy:%d/%m/%Y %H:%M} · ordenadas de la más antigua a la más reciente", S["sub"]),
        kpis(filas),
        Spacer(1, 6),
        Paragraph(
            "<b>Turno pasado</b>: la seña entró por una reserva online, el turno ya ocurrió y la seña "
            "sigue activa; lo más probable es que no se haya descontado al cobrar. "
            "<b>Varias señas</b>: la clienta tiene más de una seña activa en la misma moneda; "
            "conviene confirmar que no sea el mismo dinero cargado dos veces. "
            "<b>Ficha duplicada</b>: la misma persona (mismo teléfono o nombre) tiene más de una ficha "
            "de cliente con señas activas; conviene unificarlas.",
            S["nota"],
        ),
    ]
    for desde, hasta, titulo in TRAMOS:
        grupo = [f for f in filas
                 if f["dias"] >= max(desde, dias) and (hasta is None or f["dias"] < hasta)]
        if not grupo:
            continue
        ars = sum(f["monto"] for f in grupo if f["moneda"] == "ARS")
        usd = sum(f["monto"] for f in grupo if f["moneda"] == "USD")
        totales = dinero(ars, "ARS") + (f" · {dinero(usd, 'USD')}" if usd else "")
        h.append(Paragraph(f"{titulo} <font size='9' color='#8b5a6b'>· {len(grupo)} señas · {totales}</font>", S["h2"]))
        h.append(tabla_tramo(grupo))

    doc.build(h, onFirstPage=pie, onLaterPages=pie)
    print(f"PDF: {ruta} ({len(filas)} señas)")


if __name__ == "__main__":
    main()
