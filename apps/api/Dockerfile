FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10001 madplanner
USER madplanner

EXPOSE 8000

CMD ["uvicorn", "madplanner.main:app", "--host", "0.0.0.0", "--port", "8000"]

