FROM node:24-bookworm-slim AS node-runtime
FROM python:3.13-slim-trixie
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && useradd --create-home --uid 1000 node
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml /opt/api/pyproject.toml
RUN python -c "import tomllib,subprocess; p=tomllib.load(open('/opt/api/pyproject.toml','rb')); subprocess.check_call(['pip','install',*p['project']['dependencies'],*p['project']['optional-dependencies']['dev']])"
COPY package.json package-lock.json /opt/web/
RUN cd /opt/web && npm ci
RUN npm install -g @openai/codex@0.163.0 && mkdir -p /home/node/.codex && chown node:node /home/node/.codex
ENV PYTHONPATH=/workspace/apps/api/src HOME=/home/node
WORKDIR /workspace
USER node
