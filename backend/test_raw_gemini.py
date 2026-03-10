import asyncio
from dotenv import load_dotenv
load_dotenv()
from modules.narrative import fetch_news
from modules.gemini import get_client, NARRATIVE_PROMPT, types

async def main():
    print("Fetching news...")
    articles = await fetch_news("XLF")
    articles_text = ""
    for i, a in enumerate(articles[:15]):
        headline = a.get("headline") or a.get("title") or ""
        summary = a.get("summary") or a.get("description") or ""
        source = a.get("source") or ""
        date_str = a.get("datetime") or a.get("publishedAt") or ""
        articles_text += f"\n[{i+1}] ({source}, {date_str}) {headline}\n{summary}\n"

    prompt = NARRATIVE_PROMPT.format(
        symbol="XLF", name="State Street Financial Select Sector SPDR ETF", articles_text=articles_text
    )
    print("Calling Gemini...")
    client = get_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
        ),
    )
    print("\n--- RAW TEXT ---")
    text = response.text.strip() if response.text else ""
    print("FINISH REASON:", response.candidates[0].finish_reason)
    print(repr(text))
    print(text)

if __name__ == "__main__":
    asyncio.run(main())
