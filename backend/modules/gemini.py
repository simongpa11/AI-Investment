"""
Gemini LLM client for narrative analysis.
""" 
import logging
import json
from typing import Optional
import google.generativeai as genai
from config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)
_model = None


def get_model():
    global _model
    if _model is None:
        _model = genai.GenerativeModel("gemini-1.5-flash")
    return _model


NARRATIVE_PROMPT = """
You are a financial analyst analyzing news articles about a stock or asset.

Given the following news articles about {symbol} ({name}):

{articles_text}

Analyze these articles and return a JSON object with EXACTLY this structure:
{{
  "narrative_type": "earnings|M&A|innovation|regulatory|macro|guidance|product|rumor|analyst|other",
  "language_quality": "technical|balanced|hype",
  "strategic_plausibility": 8,
  "tone": "bullish|neutral|bearish",
  "key_themes": ["theme1", "theme2", "theme3"],
  "tone_trend": "improving|stable|deteriorating",
  "summary": "One concise sentence summarizing the narrative and its investment relevance.",
  "hype_indicators": ["list of specific hype phrases detected, or empty"],
  "catalyst_type": "earnings|product|partnership|market|none"
}}

Guidelines:
- narrative_type: dominant story type
- language_quality: technical=data-driven/analyst reports, balanced=mix, hype=emotional/speculative
- strategic_plausibility: 1-10 (10=very credible based on fundamentals)
- tone: overall market sentiment in articles
- tone_trend: is tone improving or worsening vs older articles?
- summary: investment-relevant summary in 1 sentence, max 120 chars
- hype_indicators: exact phrases that signal hype (e.g., "moon", "10x", "game changer")

Return ONLY valid JSON, no markdown, no explanation.
"""


async def analyze_narrative(symbol: str, name: str, articles: list[dict]) -> Optional[dict]:
    """
    Send news articles to Gemini for narrative classification.
    Returns structured analysis dict.
    """
    if not articles:
        return None

    # Prepare article text (last 15 most recent)
    articles_text = ""
    for i, a in enumerate(articles[:15]):
        headline = a.get("headline") or a.get("title") or ""
        summary = a.get("summary") or a.get("description") or ""
        source = a.get("source") or ""
        date_str = a.get("datetime") or a.get("publishedAt") or ""
        articles_text += f"\n[{i+1}] ({source}, {date_str}) {headline}\n{summary}\n"

    prompt = NARRATIVE_PROMPT.format(
        symbol=symbol, name=name, articles_text=articles_text
    )

    try:
        model = get_model()
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=800,
            ),
        )
        text = response.text.strip()
        # Strip potential markdown fences
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error for {symbol}: {e}")
        return None
    except Exception as e:
        logger.error(f"Gemini error for {symbol}: {e}")
        return None


SECTOR_SUMMARY_PROMPT = """
You are a financial market analyst. Given these news summaries from multiple companies in the {sector} sector:

{summaries}

Analyze the collective narrative and return JSON:
{{
  "sector_theme": "one sentence about dominant sector narrative",
  "rotation_signal": "strong|moderate|weak|none",
  "risk_factors": ["risk1", "risk2"],
  "opportunities": ["opp1", "opp2"]
}}

Return ONLY valid JSON.
"""


async def analyze_sector_narrative(sector: str, summaries: list[str]) -> Optional[dict]:
    """Analyze collective sector narrative from multiple company summaries."""
    if not summaries:
        return None
    prompt = SECTOR_SUMMARY_PROMPT.format(
        sector=sector,
        summaries="\n".join([f"- {s}" for s in summaries[:10]]),
    )
    try:
        model = get_model()
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Sector analysis error for {sector}: {e}")
        return None
