import asyncio, httpx
from bs4 import BeautifulSoup

async def get(url):
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, 'html.parser')
        table = soup.find('table', {'class': 'wikitable'})
        for row in table.find_all('tr')[1:2]:
            cols = row.find_all(['td', 'th'])
            print([c.text.strip() for c in cols])

asyncio.run(get('https://en.wikipedia.org/wiki/List_of_S%26P_600_companies'))
