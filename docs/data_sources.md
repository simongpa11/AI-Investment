# Fuentes de Datos (Data Sources)

Este documento describe las fuentes de información utilizadas por el AI Investment Scanner para generar el ranking de tendencias.

## DATOS DE MERCADO

**Fuente:** Yahoo Finance
**Acceso:** Librería `yfinance` en Python
**Periodo usado:** 250 días de cotización previos a la fecha del escaneo.

**Datos extraídos directamente:**
- Precios históricos OHLC (Open, High, Low, Close) ajustados.
- Volumen diario.
- Capitalización de mercado (Market Cap).
- Sector al que pertenece la empresa.

**Métricas derivadas de estos datos:**
- Medias móviles (MA50, MA200).
- Average True Range (ATR).
- Distancia al máximo de 52 semanas.
- Anomalías de volumen (Spikes).
- Fuerza relativa frente al mercado general.

---

## NOTICIAS Y NARRATIVA

**Fuente principal:** Finnhub API (`https://finnhub.io/api/v1`)
**Fuente secundaria:** Yahoo Finance RSS (Fallback si falla Finnhub)
**Periodo usado:** Los últimos 30 días naturales.

**Datos extraídos de las noticias:**
- Titular (Headline)
- Resumen (Summary / Description)
- Fecha de publicación
- Fuente / Medio periodístico (ej. Bloomberg, Reuters, etc.)

---

## ANÁLISIS DE CONTEXTO E INTELIGENCIA

**Modelo utilizado:** Google Gemini 1.5 Flash (via API)

**Función:**
Clasificación semántica de las noticias recientes y detección de narrativa.

**Datos generados por el modelo:**
- **Tipo de narrativa:** Clasifica las noticias en categorías predefinidas (resultados financieros, nuevos contratos, regulación, innovación tecnológica, rumor / hype, análisis de mercado).
- **Tono:** Sentimiento general de las noticias (alcista, bajista, neutral).
- **Plausibilidad Estratégica:** Evaluación subjetiva del modelo sobre la consistencia de la narrativa.
- **Narrativa Emergente:** Identificación de si el activo está comenzando a captar nueva atención del mercado.

La combinación de estas variables genera un *Narrative Score* que se suma al *Trend Score* técnico final.
