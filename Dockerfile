FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SOKETI_KEY
ARG VITE_SOKETI_HOST
ARG VITE_SOKETI_PORT
ARG VITE_SOKETI_CLUSTER
ARG VITE_SOKETI_TLS

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

COPY . .
RUN for name in VITE_API_URL VITE_SOKETI_KEY VITE_SOKETI_HOST VITE_SOKETI_PORT VITE_SOKETI_CLUSTER VITE_SOKETI_TLS; do \
      value=$(eval printf '%s' "\$$name"); \
      if [ -n "$value" ]; then echo "$name=$value" >> .env.local; fi; \
    done; \
    if [ -f .env.local ]; then echo "overrides:"; cat .env.local; else echo "overrides: nenhum, usando os defaults do codigo"; fi
RUN yarn build

FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/widget.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
