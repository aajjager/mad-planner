FROM python:3.13-slim-trixie

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl --fail --show-error --location -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    && printf '%s\n' \
        'Types: deb' \
        'URIs: https://apt.postgresql.org/pub/repos/apt' \
        'Suites: trixie-pgdg' \
        'Components: main' \
        'Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc' \
        > /etc/apt/sources.list.d/pgdg.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-18 tesseract-ocr tesseract-ocr-eng tesseract-ocr-dan tesseract-ocr-nld \
    && rm -rf /var/lib/apt/lists/*

# Pin and verify the official accuracy-focused models. Runtime OCR stays offline.
COPY ocr-models.sha256 /tmp/ocr-models.sha256
RUN sed -i 's/\r$//' /tmp/ocr-models.sha256 \
    && mkdir -p /opt/madplanner/tessdata_best \
    && cd /opt/madplanner/tessdata_best \
    && while read -r checksum model; do \
        curl --fail --show-error --location --retry 3 \
          "https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/$model" -o "$model"; \
       done < /tmp/ocr-models.sha256 \
    && sha256sum -c /tmp/ocr-models.sha256 \
    && curl --fail --show-error --location --retry 3 \
       https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/LICENSE -o LICENSE
ENV MADPLANNER_TESSDATA_DIR=/opt/madplanner/tessdata_best \
    OMP_THREAD_LIMIT=2

COPY pyproject.toml ./
COPY src ./src
COPY alembic.ini ./
COPY migrations ./migrations

RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10001 madplanner
USER madplanner

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn madplanner.main:app --host 0.0.0.0 --port 8000"]
