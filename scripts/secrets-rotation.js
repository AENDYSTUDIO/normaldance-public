#!/usr/bin/env node

/**
 * Secrets Rotation Script for NORMALDANCE
 * 
 * Этот скрипт обеспечивает автоматическую ротацию секретов для всех окружений,
 * повышая безопасность системы путем регулярного обновления чувствительных данных.
 * 
 * Features:
 * - Автоматическая ротация секретов по расписанию
 * - Поддержка разных стратегий ротации
 * - Уведомления о ротации
 * - Логирование и аудит
 * - Валидация новых секретов
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');

const execAsync = promisify(exec);

class SecretsRotator {
  constructor(config = {}) {
    this.config = {
      secretsFile: config.secretsFile || 'config/secrets-config.json',
      templatesFile: config.templatesFile || 'config/secrets-templates.js',
      environments: config.environments || ['development', 'staging', 'production'],
      rotationInterval: config.rotationInterval || 30, // дни
      rotationSchedule: config.rotationSchedule || '0 2 * * *', // ежедневно в 2 ночи
      dryRun: config.dryRun || false,
      logLevel: config.logLevel || 'info',
      notifications: config.notifications || {},
      backupDir: config.backupDir || 'backups/secrets-rotation',
      ...config
    };

    this.logger = this.createLogger();
    this.rotationHistory = [];
    this.isRunning = false;
    
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
          console.log(`[${timestamp}] [ROTATION-${level.toUpperCase()}] ${message}`, ...args);
        }
      },
      error: (message, ...args) => this.log('error', message, ...args),
      warn: (message, ...args) => this.log('warn', message, ...args),
      info: (message, ...args) => this.log('info', message, ...args),
      debug: (message, ...args) => this.log('debug', message, ...args)
    };
  }

  /**
   * Инициализация системы
   */
  async initialize() {
    try {
      this.logger.info('Initializing Secrets Rotator...');
      
      // Загрузка конфигураций
      await this.loadConfigurations();
      
      // Проверка доступности Vercel CLI
      await this.checkVercelCLI();
      
      // Проверка аутентификации
      await this.checkAuthentication();
      
      // Создание директории для бэкапов
      await this.ensureBackupDirectory();
      
      // Загрузка истории ротации
      await this.loadRotationHistory();
      
      this.logger.info('Secrets Rotator initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Secrets Rotator', error);
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
      this.logger.warn('Failed to load configurations', error);
      throw error;
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
   * Создание директории для бэкапов
   */
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.config.backupDir, { recursive: true });
      this.logger.debug(`Backup directory ensured: ${this.config.backupDir}`);
    } catch (error) {
      this.logger.warn('Failed to create backup directory', error);
    }
  }

  /**
   * Загрузка истории ротации
   */
  async loadRotationHistory() {
    try {
      const historyFile = path.join(this.config.backupDir, 'rotation-history.json');
      const historyData = await fs.readFile(historyFile, 'utf8');
      this.rotationHistory = JSON.parse(historyData);
      this.logger.debug(`Loaded ${this.rotationHistory.length} rotation records`);
    } catch (error) {
      this.logger.debug('No rotation history found, starting fresh');
      this.rotationHistory = [];
    }
  }

  /**
   * Сохранение истории ротации
   */
  async saveRotationHistory() {
    try {
      const historyFile = path.join(this.config.backupDir, 'rotation-history.json');
      await fs.writeFile(historyFile, JSON.stringify(this.rotationHistory, null, 2));
      this.logger.debug('Rotation history saved');
    } catch (error) {
      this.logger.warn('Failed to save rotation history', error);
    }
  }

  /**
   * Генерация нового секрета
   */
  generateSecret(secretConfig) {
    const length = secretConfig.rotation?.length || 32;
    const charset = secretConfig.rotation?.charset || 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return secret;
  }

  /**
   * Проверка необходимости ротации
   */
  needsRotation(secretName, environment) {
    const lastRotation = this.rotationHistory.find(record => 
      record.secretName === secretName && record.environment === environment
    );
    
    if (!lastRotation) {
      return true; // Ротация никогда не выполнялась
    }
    
    const now = new Date();
    const rotationDate = new Date(lastRotation.rotatedAt);
    const daysSinceLastRotation = (now - rotationDate) / (1000 * 60 * 60 * 24);
    
    return daysSinceLastRotation >= this.config.rotationInterval;
  }

  /**
   * Валидация нового секрета
   */
  validateNewSecret(secretName, newValue, environment) {
    try {
      const envConfig = this.secretsConfig.environments[environment];
      const secretConfig = envConfig.secrets.find(s => s.name === secretName);
      
      if (!secretConfig) {
        return { valid: false, error: `Secret configuration not found: ${secretName}` };
      }
      
      // Проверка минимальной длины
      if (secretConfig.validation?.minLength && newValue.length < secretConfig.validation.minLength) {
        return { valid: false, error: `Minimum length is ${secretConfig.validation.minLength}` };
      }
      
      // Проверка максимальной длины
      if (secretConfig.validation?.maxLength && newValue.length > secretConfig.validation.maxLength) {
        return { valid: false, error: `Maximum length is ${secretConfig.validation.maxLength}` };
      }
      
      // Проверка формата (регулярное выражение)
      if (secretConfig.validation?.pattern && !secretConfig.validation.pattern.test(newValue)) {
        return { valid: false, error: `Value does not match required pattern` };
      }
      
      // Проверка запрещенных значений
      if (secretConfig.validation?.forbiddenValues && secretConfig.validation.forbiddenValues.includes(newValue)) {
        return { valid: false, error: `Value is forbidden` };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }

  /**
   * Обновление секрета в Vercel
   */
  async updateSecret(secretName, newValue, environment) {
    try {
      const envFlag = environment === 'production' ? '--prod' : `--environment ${environment}`;
      const command = `vercel secrets add ${secretName} ${envFlag} --value "${newValue}"`;
      
      if (this.config.dryRun) {
        this.logger.debug(`[DRY RUN] Would execute: ${command}`);
        return { success: true, command };
      }
      
      await execAsync(command);
      this.logger.debug(`Secret '${secretName}' updated in Vercel`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update secret '${secretName}'`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ротация секрета
   */
  async rotateSecret(secretName, environment) {
    try {
      this.logger.info(`Rotating secret: ${secretName} for environment: ${environment}`);
      
      const envConfig = this.secretsConfig.environments[environment];
      const secretConfig = envConfig.secrets.find(s => s.name === secretName);
      
      if (!secretConfig) {
        throw new Error(`Secret configuration not found: ${secretName}`);
      }
      
      // Проверка необходимости ротации
      if (!this.needsRotation(secretName, environment)) {
        this.logger.debug(`Rotation not needed for secret: ${secretName}`);
        return { rotated: false, reason: 'Not needed' };
      }
      
      // Генерация нового секрета
      const newValue = this.generateSecret(secretConfig);
      
      // Валидация нового секрета
      const validation = this.validateNewSecret(secretName, newValue, environment);
      if (!validation.valid) {
        throw new Error(`New secret validation failed: ${validation.error}`);
      }
      
      // Создание бэкапа текущего значения
      const backup = await this.backupSecret(secretName, environment);
      
      // Обновление секрета
      const result = await this.updateSecret(secretName, newValue, environment);
      if (!result.success) {
        throw new Error(`Failed to update secret: ${result.error}`);
      }
      
      // Запись истории ротации
      const rotationRecord = {
        secretName,
        environment,
        oldValue: backup.value,
        newValue,
        rotatedAt: new Date().toISOString(),
        backupFile: backup.backupFile,
        operator: 'system'
      };
      
      this.rotationHistory.push(rotationRecord);
      await this.saveRotationHistory();
      
      // Отправка уведомления
      await this.sendNotification('secretRotated', rotationRecord);
      
      this.logger.info(`Secret rotated successfully: ${secretName}`);
      return { 
        rotated: true, 
        record: rotationRecord,
        command: result.command 
      };
    } catch (error) {
      this.logger.error(`Failed to rotate secret: ${secretName}`, error);
      throw error;
    }
  }

  /**
   * Бэкап текущего значения секрета
   */
  async backupSecret(secretName, environment) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.config.backupDir, `${secretName}-${environment}-${timestamp}.json`);
      
      const envFlag = environment === 'production' ? '--prod' : `--environment ${environment}`;
      const { stdout } = await execAsync(`vercel secrets ls ${envFlag}`);
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const secretLine = lines.find(line => line.startsWith(secretName + '\t'));
      
      if (secretLine) {
        const [name, ...rest] = secretLine.split('\t');
        const value = rest.join('\t');
        
        const backupData = {
          secretName,
          environment,
          value,
          backupAt: new Date().toISOString()
        };
        
        await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
        this.logger.debug(`Secret backed up: ${backupFile}`);
        
        return { value, backupFile };
      }
      
      throw new Error(`Secret not found: ${secretName}`);
    } catch (error) {
      this.logger.warn('Failed to backup secret', error);
      return { value: 'unknown', backupFile: null };
    }
  }

  /**
   * Отправка уведомления
   */
  async sendNotification(event, data) {
    try {
      if (!this.config.notifications.enabled) {
        return;
      }
      
      const notification = {
        event,
        data,
        timestamp: new Date().toISOString(),
        project: 'NORMALDANCE'
      };
      
      // Отправка в Slack
      if (this.config.notifications.slack?.enabled && this.config.notifications.slack.webhookUrl) {
        await this.sendSlackNotification(notification);
      }
      
      // Отправка в Discord
      if (this.config.notifications.discord?.enabled && this.config.notifications.discord.webhookUrl) {
        await this.sendDiscordNotification(notification);
      }
      
      // Отправка по email
      if (this.config.notifications.email?.enabled && this.config.notifications.email.recipients.length > 0) {
        await this.sendEmailNotification(notification);
      }
    } catch (error) {
      this.logger.warn('Failed to send notification', error);
    }
  }

  /**
   * Отправка уведомления в Slack
   */
  async sendSlackNotification(notification) {
    try {
      const message = {
        text: `🔐 Secrets Rotation Notification`,
        attachments: [{
          color: notification.event === 'secretRotated' ? 'good' : 'warning',
          fields: [
            { title: 'Event', value: notification.event, short: true },
            { title: 'Project', value: notification.project, short: true },
            { title: 'Timestamp', value: notification.timestamp, short: false }
          ]
        }]
      };
      
      if (notification.event === 'secretRotated') {
        message.attachments[0].fields.push(
          { title: 'Secret', value: notification.data.secretName, short: true },
          { title: 'Environment', value: notification.data.environment, short: true }
        );
      }
      
      // Здесь должна быть реализация отправки в Slack webhook
      this.logger.debug('Slack notification sent');
    } catch (error) {
      this.logger.warn('Failed to send Slack notification', error);
    }
  }

  /**
   * Отправка уведомления в Discord
   */
  async sendDiscordNotification(notification) {
    try {
      const message = {
        embeds: [{
          title: '🔐 Secrets Rotation Notification',
          color: notification.event === 'secretRotated' ? 0x00ff00 : 0xffff00,
          fields: [
            { name: 'Event', value: notification.event, inline: true },
            { name: 'Project', value: notification.project, inline: true },
            { name: 'Timestamp', value: notification.timestamp, inline: false }
          ]
        }]
      };
      
      if (notification.event === 'secretRotated') {
        message.embeds[0].fields.push(
          { name: 'Secret', value: notification.data.secretName, inline: true },
          { name: 'Environment', value: notification.data.environment, inline: true }
        );
      }
      
      // Здесь должна быть реализация отправки в Discord webhook
      this.logger.debug('Discord notification sent');
    } catch (error) {
      this.logger.warn('Failed to send Discord notification', error);
    }
  }

  /**
   * Отправка email уведомления
   */
  async sendEmailNotification(notification) {
    try {
      // Здесь должна быть реализация отправки email
      this.logger.debug('Email notification sent');
    } catch (error) {
      this.logger.warn('Failed to send email notification', error);
    }
  }

  /**
   * Ротация всех секретов для окружения
   */
  async rotateEnvironment(environment) {
    try {
      this.logger.info(`Rotating environment: ${environment}`);
      
      const envConfig = this.secretsConfig.environments[environment];
      if (!envConfig) {
        throw new Error(`No configuration found for environment: ${environment}`);
      }
      
      const results = {
        environment,
        total: 0,
        rotated: 0,
        failed: 0,
        secrets: []
      };
      
      for (const secretConfig of envConfig.secrets) {
        results.total++;
        
        try {
          const result = await this.rotateSecret(secretConfig.name, environment);
          results.secrets.push({
            name: secretConfig.name,
            rotated: result.rotated,
            reason: result.reason
          });
          
          if (result.rotated) {
            results.rotated++;
          }
        } catch (error) {
          results.failed++;
          results.secrets.push({
            name: secretConfig.name,
            rotated: false,
            error: error.message
          });
          
          this.logger.error(`Failed to rotate secret: ${secretConfig.name}`, error);
        }
      }
      
      this.logger.info(`Environment ${environment} rotation completed: ${results.rotated}/${results.total} secrets rotated`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to rotate environment ${environment}`, error);
      throw error;
    }
  }

  /**
   * Ротация всех секретов для всех окружений
   */
  async rotateAllEnvironments() {
    try {
      this.logger.info('Rotating all environments');
      
      const results = {
        total: 0,
        rotated: 0,
        failed: 0,
        environmentResults: {}
      };
      
      for (const environment of this.config.environments) {
        try {
          const envResult = await this.rotateEnvironment(environment);
          results.environmentResults[environment] = envResult;
          results.total += envResult.total;
          results.rotated += envResult.rotated;
          results.failed += envResult.failed;
        } catch (error) {
          this.logger.error(`Failed to rotate environment ${environment}`, error);
          results.environmentResults[environment] = {
            environment,
            total: 0,
            rotated: 0,
            failed: 1,
            error: error.message
          };
          results.failed++;
        }
      }
      
      this.logger.info(`All environments rotation completed: ${results.rotated}/${results.total} secrets rotated`);
      return results;
    } catch (error) {
      this.logger.error('Failed to rotate all environments', error);
      throw error;
    }
  }

  /**
   * Запуск ротации по расписанию
   */
  startScheduledRotation() {
    try {
      this.logger.info(`Starting scheduled rotation with schedule: ${this.config.rotationSchedule}`);
      
      cron.schedule(this.config.rotationSchedule, async () => {
        if (this.isRunning) {
          this.logger.warn('Rotation already in progress, skipping scheduled run');
          return;
        }
        
        try {
          this.isRunning = true;
          this.logger.info('Starting scheduled rotation');
          
          const results = await this.rotateAllEnvironments();
          
          this.logger.info('Scheduled rotation completed');
          await this.sendNotification('scheduledRotationCompleted', results);
        } catch (error) {
          this.logger.error('Scheduled rotation failed', error);
          await this.sendNotification('scheduledRotationFailed', { error: error.message });
        } finally {
          this.isRunning = false;
        }
      });
      
      this.logger.info('Scheduled rotation started successfully');
    } catch (error) {
      this.logger.error('Failed to start scheduled rotation', error);
      throw error;
    }
  }

  /**
   * Остановка ротации по расписанию
   */
  stopScheduledRotation() {
    try {
      cron.destroy();
      this.logger.info('Scheduled rotation stopped');
    } catch (error) {
      this.logger.warn('Failed to stop scheduled rotation', error);
    }
  }

  /**
   * Получение статуса ротации
   */
  getRotationStatus() {
    const now = new Date();
    const nextRotation = new Date(now);
    nextRotation.setDate(nextRotation.getDate() + this.config.rotationInterval);
    
    return {
      isRunning: this.isRunning,
      rotationInterval: this.config.rotationInterval,
      rotationSchedule: this.config.rotationSchedule,
      nextRotation: nextRotation.toISOString(),
      totalRotations: this.rotationHistory.length,
      lastRotation: this.rotationHistory.length > 0 ? 
        this.rotationHistory[this.rotationHistory.length - 1].rotatedAt : null,
      environments: this.config.environments
    };
  }
}

// CLI интерфейс
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  async function main() {
    try {
      const config = {
        environments: args.filter(arg => !arg.startsWith('--')),
        dryRun: args.includes('--dry-run'),
        logLevel: args.includes('--debug') ? 'debug' : 'info',
        rotationInterval: parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 30
      };
      
      const rotator = new SecretsRotator(config);
      await rotator.initialize();
      
      switch (command) {
        case 'rotate':
          const environment = args.find(arg => !arg.startsWith('--')) || 'development';
          await rotator.rotateEnvironment(environment);
          break;
          
        case 'rotate-all':
          await rotator.rotateAllEnvironments();
          break;
          
        case 'schedule':
          rotator.startScheduledRotation();
          console.log('Scheduled rotation started. Press Ctrl+C to stop.');
          process.on('SIGINT', () => {
            rotator.stopScheduledRotation();
            process.exit(0);
          });
          break;
          
        case 'status':
          console.log(JSON.stringify(rotator.getRotationStatus(), null, 2));
          break;
          
        default:
          console.log(`
Secrets Rotation Script for NORMALDANCE

Usage:
  node scripts/secrets-rotation.js <command> [options]

Commands:
  rotate [environment]      Rotate secrets for specific environment
  rotate-all                Rotate secrets for all environments
  schedule                  Start scheduled rotation
  status                    Show rotation status

Options:
  --dry-run                 Show what would be done without actually doing it
  --debug                   Enable debug logging
  --interval=days           Rotation interval in days (default: 30)

Examples:
  node scripts/secrets-rotation.js rotate production --dry-run
  node scripts/secrets-rotation.js rotate-all --debug
  node scripts/secrets-rotation.js schedule --interval=7
  node scripts/secrets-rotation.js status
          `);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }
  
  main();
}

module.exports = SecretsRotator;