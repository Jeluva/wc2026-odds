# WC2026 Odds — Documentación de Datos (Perspectiva de Analista)

> Documento de referencia sobre **fuentes, flujo, esquema y métricas** de la aplicación.
> Audiencia: analistas de datos / cualquiera que necesite entender de dónde sale cada número.
> Última revisión: 2026-06-14.

---

## 1. Qué es y qué mide

La app muestra, para cada partido del Mundial 2026, las **probabilidades implícitas** derivadas de las cuotas de la casa de apuestas **DraftKings** (vía la API pública de ESPN), más una capa de **modelos analíticos propios** (Poisson, xG aproximado, BTTS) calculados en el cliente a partir de la forma reciente de cada equipo.

**Importante:** los porcentajes **no son pronósticos propios** — son la *probabilidad implícita en las cuotas del mercado*, salvo la sección de Análisis (Poisson/xG), que sí es un modelo derivado de datos de forma.

---

## 2. Fuentes de datos

Todo proviene de la **API pública de ESPN** (`site.api.espn.com`, sin API key). Tres endpoints:

| Uso | Endpoint | Frecuencia |
|---|---|---|
| Calendario + marcadores + cuotas de todos los partidos | `/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200` | Cada 15 min (scraper) |
| Cuotas detalladas + forma por partido | `/apis/site/v2/sports/soccer/fifa.world/summary?event={id}` | On-demand (al abrir el modal) |
| Estado en vivo (reloj, marcador, estado real) | `/scoreboard?dates={ayer}-{hoy}&limit=50` | Cada 30 s (cliente, solo si hay partido en vivo) |

**Fuentes externas auxiliares:**
- **Banderas:** `flagcdn.com/w40/{iso}.png`, mapeando la abreviatura de ESPN → código ISO 3166-1 alfa-2 (tabla `TEAM_ISO` en `backend/scraper.js`).
- **Colores de equipo:** campos `color` / `alternateColor` (hex) del competidor en ESPN.
- **Casa de apuestas:** el `pickcenter` de ESPN es un **array**; se usa `pickcenter[0]` (DraftKings).

---

## 3. Flujo de datos (pipeline)

```
ESPN API
   │
   ├─ (cada 15 min)  backend/scraper.js  ──►  frontend/public/data/matches.json
   │                                      └►  frontend/public/data/standings.json
   │
   ▼
Frontend (React)
   ├─ useLiveMatches()  ── poll matches.json cada 30 s
   │        └─ si hay partido 'in': poll ESPN scoreboard cada 30 s
   │              └─ superpone estado/marcador REAL sobre el cache  (effectiveMatches)
   │
   └─ MatchDetailModal  ── fetch summary?event={id} on-demand (forma + cuotas extendidas)
```

**Capa de frescura en dos niveles:**
1. **Batch (15 min):** el scraper reescribe los JSON. Es la fuente "oficial" servida estáticamente (no requiere servidor Express).
2. **Tiempo real (30 s):** el hook `useLiveMatches` corrige el desfasaje del batch consultando ESPN en vivo y superponiendo el estado real (`pre`/`in`/`post`), reloj y marcador. Esto evita que un partido ya terminado siga figurando "EN VIVO" hasta el próximo scrape.

> **Nota de diseño relevante para el analista:** el estado y marcador que ve el usuario en vivo **pueden adelantarse** al JSON cacheado. Si comparás `matches.json` con la UI durante un partido, esperá hasta 15 min de diferencia hasta que el batch se ponga al día.

---

## 4. Diccionario de datos

### 4.1 `matches.json` → `matches[]` (`ScrapedMatch`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | string | ID del evento ESPN (clave para el endpoint summary y el overlay en vivo) |
| `date` | string ISO | Hora de inicio (UTC) |
| `name` | string | p. ej. "Scotland at Haiti" |
| `group` | string | "Group A".."Group L" o nombres de eliminatoria ("round-of-32", etc.) |
| `venue` | string | Estadio |
| `statusState` | `'pre'\|'in'\|'post'` | Estado del partido (programado / en vivo / finalizado) |
| `statusDetail` | string | "FT", reloj ("46'"), o vacío |
| `home`, `away` | `ScrapedTeam` | Ver 4.3 |
| `odds` | `MatchOdds`\|null | Ver 4.4. **null** si el partido no tiene cuotas publicadas |
| `espnUrl` | string | Link al partido en ESPN |

> **Filtro de fase de grupos:** para separar grupos de eliminatorias, usar la regex `/^Group [A-L]$/i` sobre `group`. Las llaves usan nombres como "round-of-32".

### 4.2 `standings.json` → `standings` (`Record<string, ScrapedStandingEntry[]>`)

Diccionario keyed por nombre de grupo. Cada entrada: `played, won, drawn, lost, gf, ga, gd, pts` (estadística estándar de tabla) + identidad del equipo (`name, flagUrl, color`, etc.).

### 4.3 `ScrapedTeam`

`id, name, abbr, color (#hex), altColor (#hex), isoCode, flagUrl, score (int|null), winner (bool)`.

### 4.4 `MatchOdds` — el núcleo cuantitativo

| Grupo | Campos | Notas |
|---|---|---|
| **Moneyline (cierre)** | `homeMoneyline, drawMoneyline, awayMoneyline` | Formato americano (string, p. ej. "+150", "-200", "EVEN") |
| **Moneyline (apertura)** | `*MoneylineOpen` | Para calcular movimiento de línea (▲▼) |
| **Probabilidades normalizadas** | `homeWinPct, drawPct, awayWinPct` | **Suman ~100%** — vig removido (ver §5) |
| **Over/Under** | `overUnder` (línea de goles), `overOdds, underOdds`, `*OddsOpen` | |
| **Spread / Hándicap** | `spreadHomeLine, spreadHomeOdds, spreadLine, spreadOdds, spreadOddsOpen` | Ambos lados |
| **Deep-links DraftKings** | `dkHomeBetUrl`, `dkDrawBetUrl`, ... | URL `preurl` extraída del redirect de ESPN |
| `provider` | string | Casa de apuestas (default "DraftKings") |

---

## 5. Definiciones de métricas y fórmulas

Esta es la sección crítica para interpretar correctamente cada porcentaje.

### 5.1 Cuota americana → probabilidad implícita
`backend/scraper.js → mlToImplied()`

```
si ml > 0:   p = 100 / (ml + 100)
si ml < 0:   p = |ml| / (|ml| + 100)
```
Ej.: +150 → 40,0 %  ·  −200 → 66,7 %.

### 5.2 Normalización (remoción del overround / vig)
`normalizePcts()`

Las probabilidades implícitas crudas de una casa **suman >100 %** (el margen de la casa, "overround" o *vig*, típicamente ~105 %). Para mostrar probabilidades "limpias" se normaliza:

```
homeWinPct = p_home / (p_home + p_draw + p_away) × 100
```
(ídem draw y away). Por eso el **1X2 mostrado suma exactamente 100 %**: el margen de la casa fue removido proporcionalmente.

> 📌 **FAQ del analista — "¿Por qué los porcentajes suman más de 100 %?"**
> Solo deben sumar 100 % **dentro de un mismo mercado**. Los distintos mercados (1X2, Doble Oportunidad, Draw No Bet, Over/Under) son apuestas **independientes y solapadas**; no se suman entre sí. Ver §5.3.

### 5.3 Doble Oportunidad (Double Chance)
`MatchDetailModal.tsx → dcPcts` — derivado del 1X2 ya normalizado:

```
1X (Local o Empate)   = homeWinPct + drawPct
X2 (Empate o Visita)  = drawPct    + awayWinPct
12 (Local o Visita)   = homeWinPct + awayWinPct
```
Las tres opciones suman **≈200 %** por diseño: cada resultado del 1X2 aparece en exactamente dos de las tres combinaciones (2 × 100 % = 200 %). **No es un error** — es la naturaleza del mercado.

### 5.4 Draw No Bet (DNB)
`dnbPcts` — se elimina el empate y se renormaliza sobre los dos resultados restantes:

```
homeDNB = homeWinPct / (homeWinPct + awayWinPct) × 100
awayDNB = awayWinPct / (homeWinPct + awayWinPct) × 100
```
Suman 100 %.

### 5.5 Over/Under implícito
`ouPcts = normalizedPctPair(overOdds, underOdds)` — par de probabilidades implícitas de las cuotas Over/Under, normalizado a 100 % entre los dos lados (mismo método que §5.1–5.2 aplicado a dos resultados).

### 5.6 Movimiento de línea (▲▼)
`oddsMovement(open, close)` — compara cuota de apertura vs cierre con un umbral de 4 puntos americanos:
- **▲ "in"** (más probable ahora): la línea se *acortó* (`close < open − 4`).
- **▼ "out"** (menos probable): la línea se *alargó* (`close > open + 4`).

### 5.7 Modelo Poisson de marcadores (pestaña Análisis)
`poisson(λ, k) = e^(−λ) · λ^k / k!`

- **λ (goles esperados, proxy de xG):**
  `λH = promedio de goles anotados por el local en sus últimos 5 partidos` (de `summary.lastFiveGames`). Fallback si no hay forma: `homeWinPct / 40`.
- **Marcadores más probables:** producto de Poisson independiente para cada equipo sobre la grilla 0–5 × 0–5, top 8 ordenados por probabilidad.
- **BTTS (ambos marcan):** `(1 − P(local=0)) · (1 − P(visita=0)) × 100`.

> ⚠️ Supuestos del modelo Poisson: (a) goles de cada equipo independientes; (b) λ estimado solo con los **últimos 5 partidos** (muestra chica, alta varianza); (c) no ajusta por rival, localía ni importancia del partido. Tratarlo como ilustrativo, no predictivo.

---

## 6. Frescura y cadencia de actualización

| Dato | Origen | Latencia máx. |
|---|---|---|
| Calendario, cuotas, tabla | scraper batch | ~15 min |
| Estado en vivo / reloj / marcador | overlay ESPN cliente | ~30 s |
| Forma reciente (últimos 5) | summary on-demand | al abrir el modal |

---

## 7. Limitaciones y caveats de calidad de datos

1. **Una sola casa de apuestas:** todas las probabilidades implícitas vienen de DraftKings (`pickcenter[0]`). No hay consenso de mercado ni promedio de varias casas.
2. **Cobertura de cuotas parcial:** `odds` puede ser `null` (partidos sin línea publicada, típicamente eliminatorias aún sin definir rivales).
3. **Mapeo de banderas por abreviatura:** si la abreviatura ESPN no está en `TEAM_ISO`, se hace fallback a las primeras 2 letras en minúscula → puede dar una bandera incorrecta para equipos no mapeados.
4. **Desfasaje batch vs vivo:** durante un partido, `matches.json` (15 min) puede contradecir lo que muestra la UI (overlay 30 s). La UI es la más fresca.
5. **Probabilidad implícita ≠ probabilidad real:** las cuotas incorporan el margen de la casa y sesgos de mercado. La normalización quita el margen *proporcionalmente* (supuesto simplificador), no de forma exacta.
6. **Ventana horaria UTC:** el overlay en vivo consulta `dates={ayer}-{hoy}` en UTC; cerca de los límites de día UTC podría no incluir un evento por zona horaria.
7. **Modelo Poisson:** ver §5.7 — muestra chica, supuestos fuertes.

---

## 8. Glosario rápido

- **Probabilidad implícita:** probabilidad que la cuota "asume", antes de quitar el margen.
- **Overround / vig:** margen de la casa; hace que las probabilidades implícitas crudas sumen >100 %.
- **1X2:** mercado de resultado (1 = local, X = empate, 2 = visita).
- **Doble Oportunidad:** cubre 2 de los 3 resultados.
- **Draw No Bet (DNB):** si empata, se devuelve la apuesta.
- **BTTS:** *Both Teams To Score* (ambos equipos marcan).
- **λ (lambda):** goles esperados por equipo; proxy de xG en el modelo Poisson.
