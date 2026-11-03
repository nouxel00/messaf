# API d'administration de MESSAF
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY messaf_api ./messaf_api

# Compte sans privilèges
RUN useradd --system --uid 10001 --no-create-home api
USER api

EXPOSE 8000
CMD ["uvicorn", "messaf_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
