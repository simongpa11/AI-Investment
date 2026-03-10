"""
Gemini LLM client for narrative analysis.
Uses the new google-genai SDK.
""" 
from __future__ import annotations
import logging
import json
from typing import Optional
from google import genai
from google.genai import types

from config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

_client = None


def get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


NARRATIVE_PROMPT = """
You are a financial analyst analyzing news articles about a stock or asset.

Given the following news articles about {symbol} ({name}):

{articles_text}

Analyze these articles and return a JSON object with EXACTLY this structure:
{{
  "narrative_type": "resultados financieros|nuevos contratos|regulación|innovación tecnológica|rumor / hype|análisis de mercado|other",
  "language_quality": "technical|balanced|hype",
  "strategic_plausibility": 8,
  "tone": "alcista|neutral|bajista",
  "key_themes": ["theme1", "theme2", "theme3"],
  "emerging_narrative": true,
  "tone_trend": "improving|stable|deteriorating",
  "summary": "One concise sentence summarizing the narrative and its investment relevance."
}}

Guidelines:
- narrative_type: dominant story type (must be one of the exact options provided)
- language_quality: technical=data-driven, balanced=mix, hype=emotional/speculative
- strategic_plausibility: 1-10 (10=very credible)
- tone: overall sentiment (alcista, neutral, bajista)
- emerging_narrative: true if this is a newly forming story not yet fully priced in
- summary: 1 sentence max 120 chars, in Spanish, investment-relevant

Return ONLY valid JSON format, no markdown fences, no explanation.
"""

SECTOR_SUMMARY_PROMPT = """
You are a financial market analyst. Given news summaries from multiple companies in the {sector} sector:

{summaries}

Return JSON:
{{
  "sector_theme": "one sentence about dominant sector narrative",
  "rotation_signal": "strong|moderate|weak|none",
  "risk_factors": ["risk1", "risk2"],
  "opportunities": ["opp1", "opp2"]
}}

Return ONLY valid JSON.
"""


async def analyze_narrative(symbol: str, name: str, articles: list) -> Optional[dict]:
    """Send news articles to Gemini for narrative classification."""
    if not articles:
        return None

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
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
            ),
        )
        text = response.text.strip() if response.text else ""
        # Strip potential markdown fences
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                if part.startswith("json"):
                    text = part[4:].strip()
                    break
                elif "{" in part:
                    text = part.strip()
                    break
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error for {symbol}: {e}")
        return None
    except Exception as e:
        logger.error(f"Gemini error for {symbol}: {e}")
        return None


async def analyze_sector_narrative(sector: str, summaries: list) -> Optional[dict]:
    """Analyze collective sector narrative."""
    if not summaries:
        return None
    prompt = SECTOR_SUMMARY_PROMPT.format(
        sector=sector,
        summaries="\n".join([f"- {s}" for s in summaries[:10]]),
    )
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = response.text.strip() if response.text else ""
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception as e:
        logger.error(f"Sector analysis error for {sector}: {e}")
        return None
