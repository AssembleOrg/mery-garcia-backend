"""
Genera las dos guías del sistema de presentismo.

Son dos documentos y no uno a propósito: el del equipo se reparte entre todas,
y el de Mery lleva la contraseña de una cuenta que aprueba, rechaza y edita
horarios. Mezclarlos convertiría esa contraseña en una credencial compartida.

Se corre con `pnpm run guias`, que prepara el entorno de Python la primera
vez. Necesita reportlab, que no viene con el sistema:

    MERY_PASS='su-contrasena' pnpm run guias
"""

import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

LINK = "ritmo-production-2c5a.up.railway.app"
LINK_CONSOLA = "frontend-mery-garcia-production.up.railway.app"

ROSA = colors.HexColor("#f9bbc4")
ROSA_MED = colors.HexColor("#e8b4c6")
LILA = colors.HexColor("#d4a7ca")
TINTA = colors.HexColor("#4a3540")
TINTA_2 = colors.HexColor("#6b4c57")
TINTA_3 = colors.HexColor("#8b5a6b")
SUAVE = colors.HexColor("#fdf4f6")
BORDE = colors.HexColor("#f0d8de")

EQUIPO = [
    ("Micaela", "micaela@merygarcia.local"),
    ("Rosario Nauda", "rosario@merygarcia.local"),
    ("Luna García", "luna@merygarcia.local"),
    ("Karina Navarro", "karina@merygarcia.local"),
    ("Ivonne", "ivonne@merygarcia.local"),
]


def claves_equipo():
    """Contraseñas del equipo desde EQUIPO_PASS, como `usuario=clave;usuario=clave`.

    El usuario es la parte del correo antes de la arroba. Sin la variable, la
    columna sale en blanco y Mery las entrega aparte.
    """
    import os

    crudo = os.environ.get("EQUIPO_PASS", "")
    claves = {}
    for par in crudo.split(";"):
        if "=" in par:
            usuario, clave = par.split("=", 1)
            claves[usuario.strip().lower()] = clave.strip()
    return claves

MERY_USUARIO = "mery@merygarcia.local"

# ─── Estilos ──────────────────────────────────────────────────────

base = getSampleStyleSheet()

S = {
    "titulo": ParagraphStyle(
        "titulo", parent=base["Title"], fontName="Helvetica-Bold",
        fontSize=27, leading=32, textColor=TINTA, alignment=TA_CENTER, spaceAfter=6,
    ),
    "subtitulo": ParagraphStyle(
        "subtitulo", parent=base["Normal"], fontName="Helvetica",
        fontSize=12, leading=17, textColor=TINTA_3, alignment=TA_CENTER, spaceAfter=22,
    ),
    "h2": ParagraphStyle(
        "h2", parent=base["Heading2"], fontName="Helvetica-Bold",
        fontSize=15, leading=19, textColor=TINTA, spaceBefore=18, spaceAfter=7,
    ),
    "h3": ParagraphStyle(
        "h3", parent=base["Heading3"], fontName="Helvetica-Bold",
        fontSize=11.5, leading=15, textColor=TINTA_2, spaceBefore=11, spaceAfter=4,
    ),
    "p": ParagraphStyle(
        "p", parent=base["Normal"], fontName="Helvetica",
        fontSize=10.5, leading=16, textColor=TINTA_2, alignment=TA_LEFT, spaceAfter=7,
    ),
    "li": ParagraphStyle(
        "li", parent=base["Normal"], fontName="Helvetica",
        fontSize=10.5, leading=16, textColor=TINTA_2, spaceAfter=5,
    ),
    "nota": ParagraphStyle(
        "nota", parent=base["Normal"], fontName="Helvetica",
        fontSize=10, leading=15, textColor=TINTA_2,
    ),
    "nota_t": ParagraphStyle(
        "nota_t", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=10, leading=15, textColor=TINTA,
    ),
    "paso_n": ParagraphStyle(
        "paso_n", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=15, leading=18, textColor=colors.white, alignment=TA_CENTER,
    ),
    "celda": ParagraphStyle(
        "celda", parent=base["Normal"], fontName="Helvetica",
        fontSize=10, leading=14, textColor=TINTA_2,
    ),
    "celda_b": ParagraphStyle(
        "celda_b", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=10, leading=14, textColor=TINTA,
    ),
    "cabecera": ParagraphStyle(
        "cabecera", parent=base["Normal"], fontName="Helvetica-Bold",
        fontSize=9.5, leading=13, textColor=colors.white,
    ),
}


def p(texto, estilo="p"):
    return Paragraph(texto, S[estilo])


def vinetas(items):
    return ListFlowable(
        [ListItem(Paragraph(t, S["li"]), leftIndent=14) for t in items],
        bulletType="bullet", start="•", bulletColor=LILA,
        bulletFontName="Helvetica", bulletFontSize=11,
        leftIndent=16, spaceAfter=8,
    )


def paso(numero, titulo, cuerpo):
    """Un paso numerado, con el número en un círculo rosa."""
    circulo = Table(
        [[Paragraph(str(numero), S["paso_n"])]],
        colWidths=[11 * mm], rowHeights=[11 * mm],
    )
    circulo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ROSA_MED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("ROUNDEDCORNERS", [5.5 * mm] * 4),
    ]))

    texto = [Paragraph(f"<b>{titulo}</b>", S["h3"]), Paragraph(cuerpo, S["p"])]
    fila = Table([[circulo, texto]], colWidths=[16 * mm, 143 * mm])
    fila.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return fila


def recuadro(titulo, cuerpo, color=SUAVE, borde=BORDE):
    interior = [Paragraph(titulo, S["nota_t"]), Spacer(1, 3), Paragraph(cuerpo, S["nota"])]
    caja = Table([[interior]], colWidths=[159 * mm])
    caja.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.9, borde),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return caja


def tabla(cabeceras, filas, anchos):
    datos = [[Paragraph(c, S["cabecera"]) for c in cabeceras]]
    for fila in filas:
        datos.append([
            Paragraph(celda, S["celda_b"] if i == 0 else S["celda"])
            for i, celda in enumerate(fila)
        ])

    t = Table(datos, colWidths=anchos, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), LILA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDE),
    ]
    for i in range(1, len(datos)):
        if i % 2 == 1:
            estilo.append(("BACKGROUND", (0, i), (-1, i), SUAVE))
    t.setStyle(TableStyle(estilo))
    return t


def pie(texto):
    def decorar(canvas, doc):
        canvas.saveState()
        ancho, alto = A4
        canvas.setFillColor(ROSA)
        canvas.rect(0, alto - 6 * mm, ancho, 6 * mm, stroke=0, fill=1)
        if doc.page > 1:
            canvas.setFillColor(TINTA_3)
            canvas.setFont("Helvetica", 8)
            canvas.drawString(25 * mm, 12 * mm, texto)
            canvas.drawRightString(ancho - 25 * mm, 12 * mm, f"Pagina {doc.page}")
        canvas.restoreState()
    return decorar


def documento(ruta, titulo_meta, pie_texto, historia):
    doc = BaseDocTemplate(
        str(ruta), pagesize=A4,
        leftMargin=25 * mm, rightMargin=25 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title=titulo_meta, author="Mery Garcia",
        subject="Sistema de presentismo",
    )
    marco = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="cuerpo")
    doc.addPageTemplates([PageTemplate(id="normal", frames=[marco], onPage=pie(pie_texto))])
    doc.build(historia)
    print("PDF:", ruta)


# ─── Guía del equipo ──────────────────────────────────────────────

def guia_equipo(carpeta, claves=None):
    claves = claves or {}
    h = [Spacer(1, 24 * mm)]
    h.append(p("Registro de entrada y salida", "titulo"))
    h.append(p("Una guía corta para arrancar. No hace falta instalar nada.", "subtitulo"))

    h.append(recuadro(
        "En dos frases",
        "Desde ahora vas a marcar tu entrada y tu salida desde tu celular, con un botón. "
        "Sirve para que tus horas queden registradas de forma clara y para que nadie "
        "tenga que acordarse de nada a fin de mes.",
    ))
    h.append(Spacer(1, 9))

    h.append(p("Tu dirección para entrar", "h2"))
    h.append(p(f'Abrí el navegador de tu celular y entrá a <b><font color="#4a3540">{LINK}</font></b>'))
    h.append(p(
        "Te conviene guardarlo en la pantalla de inicio la primera vez: así después lo abrís "
        "de un toque, como cualquier aplicación. En el menú del navegador vas a encontrar "
        "la opción «Agregar a pantalla de inicio»."
    ))

    h.append(Spacer(1, 6))
    h.append(p("Tu usuario", "h2"))
    if claves:
        h.append(p("Cada una entra con su propio correo y su contraseña. Buscá tu fila."))
    else:
        h.append(p("Cada una entra con su propio correo. La contraseña te la entrega Mery aparte."))
    h.append(tabla(
        ["Nombre", "Correo con el que entrás", "Contraseña"],
        [[n, c, claves.get(c.split("@")[0], "")] for n, c in EQUIPO],
        [38 * mm, 76 * mm, 45 * mm],
    ))
    h.append(Spacer(1, 8))
    h.append(recuadro(
        "Tu contraseña es tuya",
        "No la compartas ni fiches por otra compañera. Cada marca queda registrada a nombre "
        "de quien entró, así que si prestás tu usuario, las horas van a quedar mal cargadas. "
        "Si te la olvidás, pedile a Mery que te dé una nueva.",
    ))

    h.append(PageBreak())

    h.append(p("Cómo marcar tu entrada", "h2"))
    h.append(p(
        "Es un botón y listo. La primera vez el celular te va a pedir permiso para usar "
        "tu ubicación: tocá «Permitir», es lo que confirma que estás en el salón."
    ))
    h.append(Spacer(1, 4))
    h.append(paso(1, "Abrí la aplicación al llegar",
                  "Vas a ver tu turno del día y un botón grande abajo."))
    h.append(paso(2, "Esperá a que encuentre tu ubicación",
                  "Arriba del botón aparece un cartelito. Cuando dice «Ubicación» seguido "
                  "de una distancia chica, ya está lista. Tarda unos segundos."))
    h.append(paso(3, "Tocá el botón para marcar tu entrada",
                  "Se pone en «Marcando…» un instante y después te muestra la hora que quedó "
                  "registrada. Eso es todo."))
    h.append(paso(4, "Al irte, marcá tu salida",
                  "Mismo botón, misma pantalla. Ahora te va a ofrecer marcar la salida, y "
                  "abajo vas a ver cuántas horas hiciste en el día."))

    h.append(Spacer(1, 6))
    h.append(recuadro(
        "El truco que más ayuda: conectate al wifi del salón",
        "Con el wifi encendido, el celular sabe mucho mejor dónde estás. Con datos solamente, "
        "a veces la señal rebota y calcula que estás a varias cuadras, aunque estés adentro. "
        "No pasa nada grave si ocurre —tu marca igual se guarda— pero con wifi te vas a "
        "ahorrar la molestia.",
    ))

    h.append(p("Si hacés una pausa", "h2"))
    h.append(p(
        "Si en algún momento salís y volvés, podés marcar el inicio y el fin de la pausa "
        "desde la misma pantalla. Si tu jornada es corrida, no tenés que hacer nada de esto."
    ))

    h.append(p("Si algo no sale como esperabas", "h2"))
    h.append(p(
        "Tranquila: es muy difícil romper algo. Estas son las situaciones más comunes y "
        "qué conviene hacer en cada una."
    ))

    for titulo, cuerpo in [
        ("Me apareció que la marca «queda a revisar»",
         "Quiere decir que el celular no pudo confirmar del todo dónde estabas —casi siempre "
         "es la señal—. <b>Tu marca se guardó igual y no perdés esas horas.</b> Mery la "
         "aprueba desde su pantalla y queda cerrada. No tenés que volver a marcar."),
        ("Me olvidé de marcar la entrada o la salida",
         "Avisale a Mery el mismo día o al día siguiente. Ella puede cargar la hora a mano. "
         "Lo importante es avisar cuando te acordás, no dejarlo pasar."),
        ("Me quedé sin batería o me olvidé el celular",
         "Decíselo a Mery al llegar así lo deja registrado. Si el salón tiene una tablet "
         "disponible, también vas a poder marcar desde ahí."),
        ("No tengo señal en ese momento",
         "Marcá igual. La aplicación guarda la marca en el celular y la manda sola cuando "
         "vuelve la conexión, con la hora real en la que la hiciste."),
        ("La aplicación no me deja entrar",
         "Fijate que el correo esté escrito completo y sin espacios de más. Si aun así no "
         "entra, pedile a Mery una contraseña nueva."),
    ]:
        h.append(KeepTogether([p(titulo, "h3"), p(cuerpo)]))

    h.append(Spacer(1, 8))
    h.append(p("Qué más podés ver ahí", "h2"))
    h.append(p("Además del botón para marcar, en el menú vas a encontrar:"))
    h.append(vinetas([
        "<b>Mis turnos</b> — los días y horarios que tenés asignados para los próximos días.",
        "<b>Mis horas</b> — cuántas horas llevás hechas en el mes.",
        "<b>Mi calendario</b> — el mes completo, día por día.",
        "<b>Licencias y vacaciones</b> — para pedir días y ver si ya te los aprobaron.",
    ]))

    h.append(KeepTogether([
        p("Para pedir un día", "h3"),
        p("Entrá a «Licencias y vacaciones», elegí el motivo y las fechas, y enviá el pedido. "
          "Le llega a Mery y vas a poder ver en la misma pantalla cuando lo aprueba. "
          "Sigue valiendo avisar personalmente: esto es para que quede registrado."),
    ]))

    h.append(Spacer(1, 12))
    h.append(recuadro(
        "¿Te quedó alguna duda?",
        "Hablá con Mery y lo vemos juntas. Los primeros días son de acostumbrarse, y cualquier "
        "cosa que se cargue mal se puede corregir después sin problema.",
        color=colors.HexColor("#f6eef4"), borde=LILA,
    ))

    documento(
        carpeta / "guia-presentismo-equipo.pdf",
        "Guia de presentismo - equipo",
        "Mery Garcia · Guia de presentismo",
        h,
    )


# ─── Guía de Mery ─────────────────────────────────────────────────

def guia_mery(carpeta, password):
    h = [Spacer(1, 24 * mm)]
    h.append(p("Presentismo del equipo", "titulo"))
    h.append(p("Tu guía para el día a día. Documento personal.", "subtitulo"))

    h.append(recuadro(
        "Cómo entrás",
        f"Desde tu web de siempre: <b>{LINK_CONSOLA}</b>, con el usuario y la contraseña que "
        "ya usás. Ahí vas a ver una sección nueva, <b>Presentismo</b>, con todo lo de este "
        "documento.",
    ))
    h.append(Spacer(1, 8))

    h.append(p("Tu acceso al sistema del equipo", "h2"))
    h.append(p(
        "Además, tenés una cuenta propia en el sistema donde las chicas fichan. La vas a "
        "necesitar pocas veces —para dar de alta a alguien nuevo o cambiar sus datos—, "
        "porque el día a día lo resolvés desde tu web."
    ))
    h.append(tabla(
        ["Dónde", "Usuario", "Contraseña"],
        [[LINK, MERY_USUARIO, password]],
        [72 * mm, 52 * mm, 35 * mm],
    ))
    h.append(Spacer(1, 8))
    h.append(recuadro(
        "Guardá este documento para vos",
        "Esta contraseña abre la administración completa: aprobar, rechazar, cambiar horarios "
        "y ver los datos de todo el equipo. No va en la guía que se reparte, justamente por eso.",
    ))

    h.append(PageBreak())

    h.append(p("Lo que vas a hacer todos los días", "h2"))
    h.append(p("La sección Presentismo tiene cinco solapas. Esto es para qué sirve cada una."))

    h.append(paso(1, "Hoy — quién está trabajando",
                  "Se actualiza sola: cuando alguien marca su entrada o su salida, la pantalla "
                  "lo muestra en el momento, sin que tengas que refrescar nada. Arriba ves "
                  "cuántas están trabajando, cuántas llegaron tarde y cuántas faltaron."))
    h.append(paso(2, "Pendientes — lo que espera tu decisión",
                  "Acá llegan los pedidos de licencia y vacaciones, y las marcas que quedaron "
                  "dudosas. Tildás las que querés y las aprobás o rechazás todas juntas."))
    h.append(paso(3, "Semana — los turnos de esa semana",
                  "Una grilla con cada persona y cada día. Tocás una celda y cambiás el "
                  "horario de ESE día nada más."))
    h.append(paso(4, "Horario fijo — lo que se repite siempre",
                  "El horario habitual de cada una. Si alguien cambia de horario para "
                  "adelante, se edita acá."))
    h.append(paso(5, "Reportes y Equipo",
                  "El detalle de entradas y salidas de un período, con botón para bajarlo en "
                  "PDF; y el listado de quién está dado de alta."))

    h.append(Spacer(1, 6))
    h.append(recuadro(
        "La diferencia que más conviene tener clara",
        "<b>Semana</b> cambia un día suelto: «este sábado Luna entra a las 12». "
        "<b>Horario fijo</b> cambia de ahí en adelante: «Micaela pasa a entrar 11 siempre». "
        "Si usás Horario fijo para algo de un solo día, se lo vas a estar cambiando todas "
        "las semanas sin querer.",
    ))

    h.append(p("Publicar la semana", "h2"))
    h.append(p(
        "Cuando cambiás turnos, los cambios no se ven en el teléfono de las chicas hasta que "
        "tocás <b>Publicar</b>. Es a propósito: te deja acomodar la semana tranquila y recién "
        "avisar cuando está lista. El botón te muestra cuántos cambios hay sin publicar."
    ))
    h.append(p(
        "La semana siguiente se arma sola los domingos a la noche, a partir del horario fijo. "
        "No tenés que cargar nada todas las semanas; solo ajustar lo que cambie."
    ))

    h.append(p("Sobre las marcas «a revisar»", "h2"))
    h.append(p(
        "De vez en cuando una marca va a aparecer para revisar. Casi siempre es la señal del "
        "celular, que en la calle a veces calcula mal la distancia. <b>La marca se guardó y "
        "las horas están.</b> Solo tenés que confirmarla desde Pendientes."
    ))
    h.append(recuadro(
        "Un consejo para pasarle al equipo",
        "Que fichen con el wifi del salón conectado. Con wifi el celular ubica mucho mejor y "
        "casi no van a aparecer marcas para revisar. Ya está en la guía de ellas, pero "
        "recordalo los primeros días.",
    ))

    h.append(p("Si alguien se olvidó de fichar", "h2"))
    h.append(p(
        "Entrá a <b>Semana</b>, buscá el día y cargale el turno con el horario real. "
        "Si te avisa después de fin de mes, el reporte de ese período lo va a reflejar "
        "igual una vez corregido."
    ))

    h.append(Spacer(1, 10))
    h.append(recuadro(
        "Los primeros días",
        "Mirá la solapa Pendientes una vez por día hasta agarrarle la mano. Después se vuelve "
        "algo de un minuto: se resuelve lo que haya y listo.",
        color=colors.HexColor("#f6eef4"), borde=LILA,
    ))

    documento(
        carpeta / "guia-presentismo-mery.pdf",
        "Guia de presentismo - Mery",
        "Presentismo · guia de Mery",
        h,
    )


if __name__ == "__main__":
    destino = Path(sys.argv[1] if len(sys.argv) > 1 else "reportes")
    destino.mkdir(parents=True, exist_ok=True)
    # La contraseña se pasa por variable de entorno para no dejarla en el repo.
    import os
    clave = os.environ.get("MERY_PASS", "(pedirsela al administrador)")
    guia_equipo(destino, claves_equipo())
    guia_mery(destino, clave)
