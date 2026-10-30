FROM mcr.microsoft.com/playwright:v1.47.2-jammy

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw
ENV DATA_DIR=/var/data

WORKDIR /app

COPY package.json package-lock.json* ./

# CHANGED: npm ci to npm install
RUN npm install --omit=dev \
 && PLAYWRIGHT_BROWSERS_PATH=/opt/pw npx playwright install chromium \
 && PLAYWRIGHT_BROWSERS_PATH=/opt/pw npx playwright install-deps chromium

COPY db.js solver.js server.js ./

EXPOSE 10000

CMD ["node", "server.js"]