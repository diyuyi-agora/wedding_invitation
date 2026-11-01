ARG NODE_IMAGE=node:24-alpine
FROM ${NODE_IMAGE}

WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev --ignore-scripts && npm cache clean --force

COPY server/app.js server/analytics.js server/config.js server/index.js ./server/
COPY index.html app.js config.js game.css reference-ui.css ./
COPY assets ./assets
COPY *.txt ./
COPY 婚礼邀请函.html 资源来源.md ./

ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000
EXPOSE 5000
CMD ["node", "server/index.js"]
