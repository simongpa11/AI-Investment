import asyncio
from scheduler import scan_afternoon

async def main():
    print("Testing pipeline locally...")
    await scan_afternoon()
    print("Test finished.")

if __name__ == "__main__":
    asyncio.run(main())
