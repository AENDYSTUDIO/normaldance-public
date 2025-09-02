# GitHub Setup Guide для NormalDance

## Обзор

Этот документ содержит инструкции по полной настройке GitHub репозитория для проекта NormalDance v1.0.1.

## Настроенные компоненты

### 1. GitHub Actions Workflows

#### Основной CI/CD Pipeline (`.github/workflows/main.yml`)
- **Тестирование**: ESLint, Jest с покрытием кода
- **Сборка**: Next.js build с артефактами
- **Безопасность**: npm audit, CodeQL анализ
- **Деплой**: Автоматический деплой на staging/production
- **Уведомления**: Slack интеграция

#### Релизы (`.github/workflows/release.yml`)
- Автоматическое создание релизов при создании тегов
- Генерация changelog
- Создание архивов релизов

#### Docker (`.github/workflows/docker.yml`)
- Сборка и публикация Docker образов
- Поддержка multi-platform (amd64, arm64)
- Публикация в GitHub Container Registry

#### Мониторинг зависимостей (`.github/workflows/dependency-review.yml`)
- Проверка зависимостей в PR
- Еженедельное сканирование безопасности
- Автоматическое создание issues при уязвимостях

### 2. Шаблоны Issues и PR

#### Bug Report (`.github/ISSUE_TEMPLATE/bug_report.yml`)
- Структурированная форма для сообщений об ошибках
- Обязательные поля: описание, шаги воспроизведения, ожидаемое поведение
- Автоматические метки

#### Feature Request (`.github/ISSUE_TEMPLATE/feature_request.yml`)
- Форма для предложения новых функций
- Поля: проблема, решение, альтернативы, приоритет

#### Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)
- Чек-лист для PR
- Типы изменений
- Связь с issues

### 3. Автоматизация

#### CODEOWNERS (`.github/CODEOWNERS`)
- Автоматическое назначение ревьюеров
- Разделение ответственности по компонентам

#### Dependabot (`.github/dependabot.yml`)
- Еженедельные обновления npm зависимостей
- Обновления GitHub Actions
- Обновления Docker образов

#### Repository Settings (`.github/settings.yml`)
- Настройки репозитория как код
- Защита веток main/develop
- Метки для issues
- Правила для PR

## Необходимые Secrets

Для работы CI/CD необходимо настроить следующие secrets в GitHub:

### Обязательные
```
RENDER_API_TOKEN=your_render_api_token
RENDER_SERVICE_ID_STAGING=your_staging_service_id
RENDER_SERVICE_ID_PRODUCTION=your_production_service_id
SLACK_WEBHOOK=your_slack_webhook_url
```

### Дополнительные (для расширенной функциональности)
```
CODECOV_TOKEN=your_codecov_token
SENTRY_DSN=your_sentry_dsn
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
```

## Настройка Secrets

1. Перейдите в Settings → Secrets and variables → Actions
2. Добавьте каждый secret:
   - Name: имя переменной
   - Value: значение

## Environments

Настройте environments для контроля деплоев:

### Staging Environment
- Name: `staging`
- URL: `https://normaldance-staging.onrender.com`
- Protection rules: None (автоматический деплой)

### Production Environment
- Name: `production`
- URL: `https://normaldance.com`
- Protection rules: 
  - Required reviewers: @AENDY
  - Wait timer: 5 minutes

## Branch Protection Rules

### Main Branch
- Require pull request reviews (1 approver)
- Require status checks: test, build, security
- Require code owner reviews
- Dismiss stale reviews
- No force pushes or deletions

### Develop Branch
- Require pull request reviews (1 approver)
- Require status checks: test, build
- No force pushes or deletions

## Использование

### Создание релиза
```bash
git tag v1.0.2
git push origin v1.0.2
```

### Деплой на staging
```bash
git push origin develop
```

### Деплой на production
```bash
git push origin main
```

### Создание feature branch
```bash
git checkout -b feature/new-feature
git push origin feature/new-feature
# Создать PR через GitHub UI
```

## Мониторинг

### GitHub Actions
- Все workflows видны в разделе Actions
- Статус деплоев отображается в PR и commits
- Уведомления в Slack канал #deployments

### Dependabot
- Автоматические PR для обновления зависимостей
- Еженедельные проверки безопасности
- Уведомления о уязвимостях

### CodeQL
- Автоматический анализ безопасности кода
- Результаты в разделе Security → Code scanning

## Troubleshooting

### Ошибки деплоя
1. Проверьте статус в Actions
2. Убедитесь, что все secrets настроены
3. Проверьте логи Render
4. Проверьте health check endpoints

### Проблемы с тестами
1. Запустите тесты локально: `npm test`
2. Проверьте покрытие: `npm run test:coverage`
3. Исправьте failing тесты

### Проблемы с зависимостями
1. Проверьте Dependabot PR
2. Запустите `npm audit` локально
3. Обновите уязвимые пакеты

## Дальнейшие улучшения

- [ ] Интеграция с Codecov для детального анализа покрытия
- [ ] Настройка Sentry для мониторинга ошибок
- [ ] Добавление performance тестов
- [ ] Интеграция с Lighthouse CI
- [ ] Настройка автоматического changelog
- [ ] Добавление E2E тестов с Playwright