# syntax=docker/dockerfile:1

ARG BUILDPLATFORM
ARG TARGETPLATFORM

FROM --platform=$BUILDPLATFORM node:20-bookworm-slim AS frontend-build
WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
RUN npm ci --workspace client

COPY client ./client
RUN npm run build

FROM --platform=$TARGETPLATFORM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=4000

WORKDIR /app

RUN mkdir -p /app/server/data
COPY server/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY server ./server
COPY --from=frontend-build /app/client/dist ./client/dist

EXPOSE 4000

CMD ["python3", "-m", "server.app"]
