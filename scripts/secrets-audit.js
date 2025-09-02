
#!/usr/bin/env node

/**
 * Secrets Audit Script for NORMALDANCE
 * 
 * Этот скрипт обеспечивает аудит доступа и изменений секретов,
 * отслеживая все операции с секретами и выявляя потенциальные угрозы безопасности.
 * 
 * Features:
 * - Мониторинг всех операций с секретами
 * - Обнаружение подозрительной активности
 * - Генерация отчетов об использовании
 * - Уведомления о подозрительных событиях
 * - Интеграция с системами безопасности
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const execAsync = promisify(exec);

class SecretsAuditor {
  constructor(config = {}) {
    this.config = {
      secretsFile: config.secretsFile || 'config/secrets-config.json',
      environments: config.environments || ['development', 'staging', 'production'],
      auditLogFile: config.auditLogFile || 'logs/secrets-audit.log',
      reportDir: config.reportDir || 'reports/secrets-audit',
      retentionDays: config.retentionDays || 90,
      alertThresholds: config.alertThresholds || {
        failedAttempts: 5,
        unusualAccess: 10,
        rapidChanges: 3,
        unauthorizedAccess: 1
      },
      notifications: config.notifications || {},
      dryRun: config.dryRun || false,
      logLevel: config.logLevel || 'info',
      ...config
    };

    this.logger = this.createLogger();
    this.auditLog = [];
    this.alerts = [];
    
    // Загрузка конфигураций
    this.secretsConfig = null;
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
          const logEntry = `[${timestamp}] [AUDIT-${level.toUpperCase()}] ${message}`;
          console.log(logEntry, ...args);
          
          // Запись в файл лога
          this.writeAuditLog(logEntry);
        }
      },
      error: (message, ...args) => this.log('error', message, ...args),
      warn: (message, ...args) => this.log('warn', message, ...args),
      info: (message, ...args) => this.log('info', message, ...args),
      debug: (message, ...args) => this.log('debug', message, ...args)
    };
  }

  /**
   * Запись в лог аудита
   */
  async writeAuditLog(message) {
    try {
      await fs.appendFile(this.config.auditLogFile, message + '\n');
    } catch (error) {
      this.logger.warn('Failed to write audit log', error);
    }
  }

  /**
   * Инициализация системы
   */
  async initialize() {
    try {
      this.logger.info('Initializing Secrets Auditor...');
      
      // Загрузка конфигураций
      await this.loadConfigurations();
      
      // Проверка доступности Vercel CLI
      await this.checkVercelCLI();
      
      // Проверка аутентификации
      await this.checkAuthentication();
      
      // Создание директорий
      await this.ensureDirectories();
      
      // Загрузка существующего лога аудита
      await this.loadAuditLog();
      
      this.logger.info('Secrets Auditor initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Secrets Auditor', error);
      throw error;
    }
  }

  /**
   * Загрузка конфигураций
   */
  async loadConfigurations() {
    try {
      const secretsConfigPath = path.resolve(this.config.secretsFile);
      const secretsConfigData = await fs.readFile(secretsConfigPath, 'utf8');
      this.secretsConfig = JSON.parse(secretsConfigData);
      
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
   * Создание необходимых директорий
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(path.dirname(this.config.auditLogFile), { recursive: true });
      await fs.mkdir(this.config.reportDir, { recursive: true });
      this.logger.debug('Directories ensured');
    } catch (error) {
      this.logger.warn('Failed to create directories', error);
    }
  }

  /**
   * Загрузка существующего лога аудита
   */
  async loadAuditLog() {
    try {
      const logData = await fs.readFile(this.config.auditLogFile, 'utf8');
      const lines = logData.split('\n').filter(line => line.trim());
      
      this.auditLog = lines.map(line => {
        try {
          const match = line.match(/\[([^\]]+)\] \[AUDIT-([^\]]+)\] (.+)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2],
              message: match[3]
            };
          }
          return null;
        } catch (error) {
          return null;
        }
      }).filter(entry => entry !== null);
      
      this.logger.debug(`Loaded ${this.auditLog.length} audit log entries`);
    } catch (error) {
      this.logger.debug('No existing audit log found, starting fresh');
      this.auditLog = [];
    }
  }

  /**
   * Запись события аудита
   */
  async logAuditEvent(event) {
    try {
      const auditEvent = {
        timestamp: new Date().toISOString(),
        ...event
      };
      
      this.auditLog.push(auditEvent);
      
      // Запись в файл
      const logEntry = `[${auditEvent.timestamp}] [AUDIT-${auditEvent.level.toUpperCase()}] ${auditEvent.message}`;
      await this.writeAuditLog(logEntry);
      
      // Проверка на подозрительные события
      await this.checkForSuspiciousActivity(auditEvent);
      
      return auditEvent;
    } catch (error) {
      this.logger.warn('Failed to log audit event', error);
      return null;
    }
  }

  /**
   * Проверка на подозрительную активность
   */
  async checkForSuspiciousActivity(event) {
    try {
      const suspicious = false;
      let alertType = null;
      let alertMessage = null;
      
      // Проверка на неудачные попытки доступа
      if (event.level === 'ERROR' && event.message.includes('failed')) {
        const failedAttempts = this.auditLog.filter(e => 
          e.level === 'ERROR' && e.message.includes('failed')
        ).length;
        
        if (failedAttempts >= this.config.alertThresholds.failedAttempts) {
          suspicious = true;
          alertType = 'FAILED_ATTEMPTS';
          alertMessage = `Multiple failed access attempts detected: ${failedAttempts}`;
        }
      }
      
      // Проверка на необычное время доступа
      const eventHour = new Date(event.timestamp).getHours();
      if