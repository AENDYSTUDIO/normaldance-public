#!/usr/bin/env node

/**
 * Vercel Secrets Integration for NORMALDANCE
 * 
 * Этот модуль интегрирует Vercel Secrets CLI с существующей CI/CD инфраструктурой NORMALDANCE,
 * обеспечивая безопасное управление секретами для всех платформ деплоя.
 * 
 * Features:
 * - Интеграция с Vercel Secrets CLI
 * - Поддержка множества платформ (Render, Vercel, Railway, GitLab CI)
 * - Автоматическое обновление секретов при деплое
 * - Валидация и синхронизация секретов между окружениями
 * - Интеграция с существующей системой дедупликации и webhook handler
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);

class SecretsIntegration {
  constructor(config = {}) {
    this.config = {
      vercelOrgId: config.vercelOrgId || process.env.VERCEL_ORG_ID,
      vercelProjectId: config.vercelProjectId || process.env.VERCEL_PROJECT_ID,
      environments: config.environments || ['development', 'staging', 'production'],
      secretsFile: config.secretsFile || 'config/secrets-config.json',
      templatesFile: config.templatesFile || 'config/secrets-templates.js',
      logLevel: config.logLevel || 'info',
      autoSync: config.autoSync !== false,
      validateBeforeDeploy: config.validateBeforeDeploy !== false,
      ...config
    };

    this.logger = this.createLogger();
    this.secretsCache = new Map();
    this.validationResults = new Map();
    
    // Загрузка конфигураций
    this.secretsConfig = null;
    this.secretsTemplates = null;
  }

  /**
   * Создание логгера
   */
  createLogger() {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return {
      log: (level, message, ...args) => {
        if (levels[level] <= levels[this.config.logLevel]) {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] [SECRETS-${level.toUpperCase()}] ${message}`, ...args);
        }
      },
      error: (message, ...args) => this.log('error', message, ...args),
      warn: (message, ...args) => this.log('warn', message, ...args),
      info: (message, ...args) => this.log('info', message, ...args),
      debug: (message, ...args) => this.log('debug', message, ...args)
    };
  }

  /**
   * Инициализация системы интеграции
   */
  async initialize() {
    try {
      this.logger.info('Initializing Vercel Secrets Integration...');
      
      // Загрузка конфигураций
      await this.loadConfigurations();
      
      // Проверка доступности Vercel CLI
      await this.checkVercelCLI();
      
      // Проверка аутентификации
      await this.checkAuthentication();
      
      this.logger.info('Vercel Secrets Integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Secrets Integration', error);
      throw error;
    }
  }

  /**
   * Загрузка конфигураций
   */
  async loadConfigurations() {
    try {
      // Загрузка конфигурации секретов
      const secretsConfigPath = path.resolve(this.config.secretsFile);
      const secretsConfigData = await fs.readFile(secretsConfigPath, 'utf8');
      this.secretsConfig = JSON.parse(secretsConfigData);
      
      // Загрузка шаблонов секретов
      const templatesPath = path.resolve(this.config.templatesFile);
      const templatesModule = require(templatesPath);
      this.secretsTemplates = templatesModule.secretsTemplates || {};
      
      this.logger.debug('Configurations loaded successfully');
    } catch (error) {
      this.logger.warn('Failed to load configurations, using defaults', error.message);
      this.secretsConfig = this.getDefaultSecretsConfig();
      this.secretsTemplates = this.getDefaultSecretsTemplates();
    }
  }

  /**
   * Проверка доступности Vercel CLI
   */
  async checkVercelCLI() {
    try {
      const { stdout } = await execAsync('vercel --version');
      this.logger.info(`Vercel CLI version: ${stdout.trim()}`);
    } catch (error) {
      throw new Error('Vercel CLI is not installed or not available in PATH');
    }
  }

  /**
   * Проверка аутентификации
   */
  async checkAuthentication() {
    try {
      const { stdout } = await execAsync('vercel whoami');
      this.logger.info(`Authenticated as: ${stdout.trim()}`);
    } catch (error) {
      throw new Error('Vercel CLI is not authenticated. Please run "vercel login"');
    }
  }

  /**
   * Синхронизация секретов для окружения
   */
  async syncSecrets(environment) {
    try {
      this.logger.info(`Syncing secrets for environment: ${environment}`);
      
      // Получение шаблона для окружения
      const template = this.secretsTemplates[environment];
      if (!template) {
        throw new Error(`No template found for environment: ${environment}`);
      }
      
      // Валидация секретов
      const validation = await this.validateSecrets(environment, template);
      if (!validation.valid) {
        throw new Error(`Secrets validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Синхронизация секретов с Vercel
      await this.syncWithVercel(environment, template);
      
      // Кэширование результатов
      this.secretsCache.set(environment, {
        timestamp: Date.now(),
        secrets: template.secrets,
        status: 'synced'
      });
      
      this.logger.info(`Secrets synced successfully for environment: ${environment}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync secrets for environment: ${environment}`, error);
      throw error;
    }
  }

  /**
   * Валидация секретов для окружения
   */
  async validateSecrets(environment, template) {
    try {
      const errors = [];
      const secrets = template.secrets || [];
      
      for (const secret of secrets) {
        // Проверка наличия секрета в окружении
        const value = process.env[secret.name];
        if (!value) {
          errors.push(`Secret '${secret.name}' not found in environment variables`);
          continue;
        }
        
        // Проверка валидации по шаблону
        if (secret.validation) {
          const validation = this.validateSecretValue(secret.name, value, secret.validation);
          if (!validation.valid) {
            errors.push(`Secret '${secret.name}' validation failed: ${validation.error}`);
          }
        }
      }
      
      this.validationResults.set(environment, {
        valid: errors.length === 0,
        errors,
        timestamp: Date.now()
      });
      
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.logger.error('Secrets validation failed', error);
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Валидация значения секрета
   */
  validateSecretValue(name, value, validation) {
    try {
      // Проверка минимальной длины
      if (validation.minLength && value.length < validation.minLength) {
        return {
          valid: false,
          error: `Minimum length is ${validation.minLength}`
        };
      }
      
      // Проверка максимальной длины
      if (validation.maxLength && value.length > validation.maxLength) {
        return {
          valid: false,
          error: `Maximum length is ${validation.maxLength}`
        };
      }
      
      // Проверка формата (регулярное выражение)
      if (validation.pattern && !validation.pattern.test(value)) {
        return {
          valid: false,
          error: `Value does not match required pattern`
        };
      }
      
      // Проверка запрещенных значений
      if (validation.forbiddenValues && validation.forbiddenValues.includes(value)) {
        return {
          valid: false,
          error: `Value is forbidden`
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Синхронизация секретов с Vercel
   */
  async syncWithVercel(environment, template) {
    try {
      this.logger.info(`Syncing with Vercel for environment: ${environment}`);
      
      // Установка окружения для Vercel CLI
      const envFlag = environment === 'production' ? '--prod' : `--environment ${environment}`;
      
      // Синхронизация каждого секрета
      for (const secret of template.secrets) {
        try {
          const value = process.env[secret.name];
          if (!value) {
            this.logger.warn(`Secret '${secret.name}' not found, skipping`);
            continue;
          }
          
          // Добавление секрета в Vercel
          await execAsync(`vercel secrets add ${secret.name} ${envFlag} --value "${value}"`);
          this.logger.debug(`Secret '${secret.name}' synced to Vercel`);
        } catch (error) {
          this.logger.error(`Failed to sync secret '${secret.name}'`, error);
          // Продолжаем с другими секретами
        }
      }
      
      this.logger.info(`Successfully synced ${template.secrets.length} secrets to Vercel`);
    } catch (error) {
      this.logger.error('Failed to sync with Vercel', error);
      throw error;
    }
  }

  /**
   * Получение секретов из Vercel
   */
  async getVercelSecrets(environment) {
    try {
      const envFlag = environment === 'production' ? '--prod' : `--environment ${environment}`;
      const { stdout } = await execAsync(`vercel secrets ls ${envFlag}`);
      
      const secrets = {};
      const lines = stdout.split('\n').filter(line => line.trim());
      
      // Пропускаем заголовок
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const [name, ...rest] = line.split('\t');
        if (name) {
          secrets[name] = rest.join('\t');
        }
      }
      
      return secrets;
    } catch (error) {
      this.logger.error('Failed to get Vercel secrets', error);
      return {};
    }
  }

  /**
   * Подготовка секретов для деплоя на конкретной платформе
   */
  async prepareDeploymentSecrets(platform, environment) {
    try {
      this.logger.info(`Preparing secrets for ${platform} deployment in ${environment}`);
      
      // Получение секретов из Vercel
      const vercelSecrets = await this.getVercelSecrets(environment);
      
      // Получение шаблона для окружения
      const template = this.secretsTemplates[environment];
      if (!template) {
        throw new Error(`No template found for environment: ${environment}`);
      }
      
      // Фильтрация секретов для платформы
      const platformSecrets = this.filterSecretsForPlatform(template.secrets, platform);
      
      // Формирование переменных окружения для деплоя
      const deploymentSecrets = {};
      
      for (const secret of platformSecrets) {
        if (vercelSecrets[secret.name]) {
          deploymentSecrets[secret.name] = vercelSecrets[secret.name];
        } else if (process.env[secret.name]) {
          deploymentSecrets[secret.name] = process.env[secret.name];
        } else {
          this.logger.warn(`Secret '${secret.name}' not found for ${platform} deployment`);
        }
      }
      
      // Добавление платформо-специфичных секретов
      const platformSpecificSecrets = this.getPlatformSpecificSecrets(platform, environment);
      Object.assign(deploymentSecrets, platformSpecificSecrets);
      
      this.logger.info(`Prepared ${Object.keys(deploymentSecrets).length} secrets for ${platform}`);
      return deploymentSecrets;
    } catch (error) {
      this.logger.error(`Failed to prepare secrets for ${platform}`, error);
      throw error;
    }
  }

  /**
   * Фильтрация секретов для платформы
   */
  filterSecretsForPlatform(secrets, platform) {
    return secrets.filter(secret => {
      // Если платформа не указана, секрет доступен для всех
      if (!secret.platforms) return true;
      
      // Проверка наличия платформы в списке
      return secret.platforms.includes(platform);
    });
  }

  /**
   * Получение платформо-специфичных секретов
   */
  getPlatformSpecificSecrets(platform, environment) {
    const platformSecrets = {
      render: {
        RENDER_SERVICE_ID: process.env.RENDER_SERVICE_ID,
        RENDER_API_TOKEN: process.env.RENDER_API_TOKEN
      },
      vercel: {
        VERCEL_ORG_ID: this.config.vercelOrgId,
        VERCEL_PROJECT_ID: this.config.vercelProjectId
      },
      railway: {
        RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
        RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN
      }
    };
    
    return platformSecrets[platform] || {};
  }

  /**
   * Получение конфигурации по умолчанию
   */
  getDefaultSecretsConfig() {
    return {
      environments: ['development', 'staging', 'production'],
      syncOnDeploy: true,
      validateBeforeDeploy: true,
      autoRotate: false,
      rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 дней
      auditLog: true
    };
  }

  /**
   * Получение шаблонов секретов по умолчанию
   */
  getDefaultSecretsTemplates() {
    return {
      development: {
        secrets: [
          {
            name: 'DATABASE_URL',
            description: 'URL базы данных для разработки',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 10,
              pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+$/
            }
          },
          {
            name: 'NEXTAUTH_SECRET',
            description: 'Секрет для NextAuth.js',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 32,
              maxLength: 64,
              pattern: /^[a-zA-Z0-9\-_]+$/
            }
          },
          {
            name: 'SUPABASE_URL',
            description: 'URL Supabase сервиса',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          },
          {
            name: 'SUPABASE_ANON_KEY',
            description: 'Anon ключ для Supabase',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          }
        ]
      },
      staging: {
        secrets: [
          {
            name: 'DATABASE_URL',
            description: 'URL базы данных для staging',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 10,
              pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+$/
            }
          },
          {
            name: 'NEXTAUTH_SECRET',
            description: 'Секрет для NextAuth.js',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 32,
              maxLength: 64,
              pattern: /^[a-zA-Z0-9\-_]+$/
            }
          },
          {
            name: 'SUPABASE_URL',
            description: 'URL Supabase сервиса',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          },
          {
            name: 'SUPABASE_ANON_KEY',
            description: 'Anon ключ для Supabase',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          }
        ]
      },
      production: {
        secrets: [
          {
            name: 'DATABASE_URL',
            description: 'URL базы данных для production',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 10,
              pattern: /^postgresql:\/\/[^:]+:[^@]+@[^:]+:\d+\/[^?]+$/
            }
          },
          {
            name: 'NEXTAUTH_SECRET',
            description: 'Секрет для NextAuth.js',
            required: true,
            platforms: ['render', 'vercel', 'railway'],
            validation: {
              minLength: 32,
              maxLength: 64,
              pattern: /^[a-zA-Z0-9\-_]+$/
            }
          },
          {
            name: 'SUPABASE_URL',
            description: 'URL Supabase сервиса',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          },
          {
            name: 'SUPABASE_ANON_KEY',
            description: 'Anon ключ для Supabase',
            required: true,
            platforms: ['render', 'vercel', 'railway']
          }
        ]
      }
    };
  }

  /**
   * Синхронизация секретов для всех окружений
   */
  async syncAllEnvironments() {
    try {
      this.logger.info('Syncing secrets for all environments');
      
      const results = {};
      for (const environment of this.config.environments) {
        try {
          results[environment] = await this.syncSecrets(environment);
        } catch (error) {
          this.logger.error(`Failed to sync environment ${environment}`, error);
          results[environment] = { error: error.message };
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to sync all environments', error);
      throw error;
    }
  }

  /**
   * Подготовка секретов для деплоя на всех платформах
   */
  async prepareAllDeployments(environment) {
    try {
      this.logger.info(`Preparing secrets for all platforms in ${environment}`);
      
      const platforms = ['render', 'vercel', 'railway'];
      const results = {};
      
      for (const platform of platforms) {
        try {
          results[platform] = await this.prepareDeploymentSecrets(platform, environment);
        } catch (error) {
          this.logger.error(`Failed to prepare secrets for ${platform}`, error);
          results[platform] = { error: error.message };
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to prepare all deployments', error);
      throw error;
    }
  }

  /**
   * Получение статуса системы
   */
  getStatus() {
    return {
      initialized: this.secretsConfig !== null,
      environments: this.config.environments,
      cacheSize: this.secretsCache.size,
      validationResults: Object.fromEntries(this.validationResults),
      config: this.config
    };
  }
}

// Экспорт класса и утилит
module.exports = SecretsIntegration;

// CLI интерфейс
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  async function main() {
    try {
      const integration = new SecretsIntegration();
      await integration.initialize();
      
      switch (command) {
        case 'sync':
          const environment = args[1] || 'development';
          await integration.syncSecrets(environment);
          break;
          
        case 'sync-all':
          await integration.syncAllEnvironments();
          break;
          
        case 'prepare':
          const platform = args[1];
          const env = args[2] || 'development';
          await integration.prepareDeploymentSecrets(platform, env);
          break;
          
        case 'prepare-all':
          const deployEnv = args[1] || 'development';
          await integration.prepareAllDeployments(deployEnv);
          break;
          
        case 'status':
          console.log(JSON.stringify(integration.getStatus(), null, 2));
          break;
          
        default:
          console.log(`
Vercel Secrets Integration CLI for NORMALDANCE

Usage:
  node scripts/secrets-integration.js <command> [options]

Commands:
  sync [environment]          Sync secrets for specific environment
  sync-all                    Sync secrets for all environments
  prepare <platform> [env]    Prepare secrets for platform deployment
  prepare-all [environment]   Prepare secrets for all platforms
  status                      Show system status

Examples:
  node scripts/secrets-integration.js sync production
  node scripts/secrets-integration.js prepare render staging
  node scripts/secrets-integration.js sync-all
          `);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
  
  main();
}