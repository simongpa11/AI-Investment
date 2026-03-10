import asyncio
from dotenv import load_dotenv
load_dotenv()
from modules.narrative import scan_narrative

async def main():
    print("Running scan_narrative...")
    res = await scan_narrative("XLF", "State Street Financial Select Sector SPDR ETF")
    print("\n--- RESULTS ---")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
