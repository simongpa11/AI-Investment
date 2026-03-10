# Estrategia de Escaneo de Tendencias

## 1. Filosofía del sistema

El sistema busca detectar **tendencias tempranas en acciones líquidas**, combinando señales cuantitativas del precio y volumen con la validación cualitativa de la narrativa del mercado. 

El objetivo no es el *day trading* ni predecir suelos absolutos, sino identificar el punto exacto donde el capital inteligente (instituciones) comienza a acumular posiciones, generando:
- Momentum técnico a corto y medio plazo.
- Breakouts estructurales de resistencias importantes.
- Anomalías de volumen que denotan fuerte interés comprador.
- Narrativa emergente o catalizadores reales que sustenten la subida.

---

## 2. Pipeline de Análisis

El flujo de trabajo del escáner consta de los siguientes pasos consecutivos:

1. **Generación del Universo:** 
   Se construye una lista amplia de acciones basándose en índices de mercado relevantes (ej. Russell 3000 y STOXX Europe 600).
   
2. **Filtrado de Liquidez:** 
   Se eliminan del universo las *microcaps* y *penny stocks* aplicando filtros mínimos de precio ($3), volumen medio diario (> 500,000) y capitalización de mercado (> $200M).

3. **Cálculo de Indicadores Técnicos (Datos de mercado):** 
   Se extraen datos de los últimos 250 días para calcular medias móviles, ATR, distancia a máximos, fuerza relativa y picos de volumen.

4. **Detección de Breakout y Momentum:** 
   Se aplican las reglas técnicas para evaluar la calidad estructural del activo y se asigna un puntaje parcial.

5. **Análisis de Noticias (Top Ranking):** 
   Para las acciones con mejor puntuación técnica, se recuperan las noticias recientes (últimos 30 días).

6. **Evaluación Narrativa por LLM:** 
   Se utiliza un modelo de IA (Gemini) para clasificar semánticamente el conjunto de noticias, evaluar el tono, descartar "hype" y confirmar catalizadores reales.

7. **Ranking de acciones por Trend Score:** 
   Se combina el puntaje técnico y el puntaje narrativo para emitir el **Trend Score Final** y ordenar la lista de resultados para el usuario.

---

## 3. Objetivo del Sistema

Detectar acciones con **probabilidad elevada de entrar en tendencias alcistas sostenidas**, proporcionando al inversor una lista reducida, depurada y justificada de activos sobre los que realizar una diligencia debida en profundidad.

---

## 4. Limitaciones

Todo usuario que utilice este sistema debe ser consciente de las siguientes limitaciones inherentes al mismo:

- **Retraso de Datos:** Los datos extraídos de proveedores gratuitos (Yahoo Finance, Finnhub, RSS) pueden tener ligeros retrasos y no representan el *tick-by-tick* institucional absoluto. Las anomalías de volumen extremadamente breves podrían no registrarse en marcos diarios.
- **Latencia Informativa:** Las noticias publicadas a menudo llegan tarde a los inversores minoristas; los grandes movimientos del mercado a veces preceden a la publicación de la "narrativa" oficial en los medios.
- **Falsos Positivos de la IA:** Ocasionalmente, el LLM puede interpretar un PR hiperbólico (una nota de prensa financiada por la empresa) como una "innovación tecnológica" válida, a pesar de los esfuerzos del prompt por identificar el *hype*.
- **No es Asesoramiento Financiero:** Este sistema es exclusivamente una herramienta de filtrado cuantitativo y cualitativo de datos públicos para la toma de decisiones algorítmicas o personales discrecionales. No constituye asesoramiento de inversión regulado en ninguna jurisdicción.
