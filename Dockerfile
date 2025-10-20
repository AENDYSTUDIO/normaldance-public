# Многоэтапная сборка для NormalDance

# Этап 1: Установка зависимостей
FROM node:25-alpine AS deps
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package.json package-lock.json ./
COPY mobile-app/package.json mobile-app/package-lock.json ./mobile-app/

# Установка зависимостей для основного приложения
RUN npm ci --only=production

# Установка зависимостей для мобильного приложения
WORKDIR /app/mobile-app
RUN npm ci --only=production

WORKDIR /app

# Этап 2: Сборка приложения
FROM node:25-alpine AS builder
WORKDIR /app

# Копирование зависимостей
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mobile-app/node_modules ./mobile-app/node_modules

# Копирование исходного кода
COPY . .

# Сборка основного приложения
RUN npm run build

# Сборка мобильного приложения
WORKDIR /app/mobile-app
RUN npm run build:android

WORKDIR /app

# Этап 3: Production среда
FROM node:25-alpine AS runner
WORKDIR /app

# Создание пользователя
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Установка системных зависимостей для аудио обработки
RUN apk add --no-cache \
    ffmpeg \
    libvips \
    dumb-init

# Копирование зависимостей
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/mobile-app/node_modules ./mobile-app/node_modules

# Копирование сборки
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/mobile-app/android/app/build/outputs/apk/ ./mobile-app/android/app/build/outputs/apk/

# Копирование конфигурации
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs server.ts ./
COPY --chown=nextjs:nodejs next.config.ts ./

# Создание директорий для загрузок и кэша
RUN mkdir -p /app/uploads /app/cache /app/logs

# Установка прав
RUN chown -R nextjs:nodejs /app

# Переключение на пользователя
USER nextjs

# Экспорт портов
EXPOSE 3000
EXPOSE 3001 # Socket.IO

# Environment variables
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV "production"
ENV UPLOAD_DIR "/app/uploads"
ENV CACHE_DIR "/app/cache"
ENV LOG_DIR "/app/logs"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Запуск приложения
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.ts"]

# Этап 4: Development среда (опционально)
FROM node:25-alpine AS dev
WORKDIR /app

# Установка всех зависимостей
COPY package.json package-lock.json ./
COPY mobile-app/package.json mobile-app/package-lock.json ./mobile-app/

RUN npm ci

# Копирование исходного кода
COPY . .

# Экспорт порта
EXPOSE 3000

# Команда для разработки
CMD ["npm", "run", "dev"]