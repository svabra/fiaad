FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src

WORKDIR /app
RUN addgroup --system --gid 10001 daaif && adduser --system --uid 10001 --ingroup daaif daaif
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src ./src
RUN chown -R daaif:daaif /app
USER daaif

EXPOSE 8002
CMD ["python", "-m", "daaif_mcp.main"]

