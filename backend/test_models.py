import os
from google import genai
from config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)
models = client.models.list()
for m in models:
    if "flash" in m.name:
        print(m.name, m.supported_actions)
