/**
 * Шаблоны секретов для NORMALDANCE проекта
 * 
 * Этот файл содержит шаблоны конфигураций секретов для разных окружений
 * и платформ деплоя. Используется системой управления секретами Vercel CLI.
 */

const crypto = require('crypto');

/**
 * Генерация случайного секрета
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Шаблоны секретов для окружений
 */
const secretsTemplates = {
  development: {
    name: 'Development Environment',
    description: 'Шаблон секретов для окружения разработки',
    environment: 'development',
    secrets: [
      {
        name: 'DATABASE_URL',
        description: 'URL базы данных для разработки',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'postgresql://user:password@localhost:5432/normaldance_dev',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^postgresql:\\/\\/[^:]+:[^@]+@[^:]+:\\d+\\/[\\w-]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'postgresql://user:password@localhost:5432/normaldance_dev',
          'postgresql://user:password@db.example.com:5432/normaldance_dev'
        ]
      },
      {
        name: 'NEXTAUTH_SECRET',
        description: 'Секрет для NextAuth.js (должен быть случайным и уникальным)',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: generateSecret(),
        validation: {
          minLength: 32,
          maxLength: 64,
          pattern: '^[a-zA-Z0-9\\-_]+$',
          forbiddenValues: ['', 'null', 'undefined', 'development', 'staging', 'production']
        },
        examples: [
          'your-super-secret-nextauth-key-here',
          'another-secure-secret-key-12345'
        ]
      },
      {
        name: 'SUPABASE_URL',
        description: 'URL Supabase сервиса',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'https://your-project.supabase.co',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'https://your-project.supabase.co',
          'https://xyz1234567890abcdef.supabase.co'
        ]
      },
      {
        name: 'SUPABASE_ANON_KEY',
        description: 'Anon ключ для Supabase (публичный ключ)',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        ]
      },
      {
        name: 'NEXTAUTH_URL',
        description: 'URL для NextAuth callback (обычно URL вашего приложения)',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'http://localhost:3000',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https?:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'http://localhost:3000',
          'https://normaldance-dev.vercel.app',
          'https://normaldance-dev.render.com'
        ]
      },
      {
        name: 'NODE_ENV',
        description: 'Окружение выполнения Node.js',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'development',
        validation: {
          pattern: '^(development|staging|production)$',
          forbiddenValues: ['']
        },
        examples: ['development', 'staging', 'production']
      }
    ]
  },

  staging: {
    name: 'Staging Environment',
    description: 'Шаблон секретов для стейджингового окружения',
    environment: 'staging',
    secrets: [
      {
        name: 'DATABASE_URL',
        description: 'URL базы данных для staging',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'postgresql://user:password@staging-db.example.com:5432/normaldance_staging',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^postgresql:\\/\\/[^:]+:[^@]+@[^:]+:\\d+\\/[\\w-]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'postgresql://user:password@staging-db.example.com:5432/normaldance_staging',
          'postgresql://user:password@staging-db.cluster-xyz123.eu-west-1.rds.amazonaws.com:5432/normaldance_staging'
        ]
      },
      {
        name: 'NEXTAUTH_SECRET',
        description: 'Секрет для NextAuth.js (должен быть случайным и уникальным)',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: generateSecret(),
        validation: {
          minLength: 32,
          maxLength: 64,
          pattern: '^[a-zA-Z0-9\\-_]+$',
          forbiddenValues: ['', 'null', 'undefined', 'development', 'staging', 'production']
        },
        examples: [
          'staging-super-secret-nextauth-key-here',
          'staging-secure-secret-key-67890'
        ]
      },
      {
        name: 'SUPABASE_URL',
        description: 'URL Supabase сервиса для staging',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'https://staging-project.supabase.co',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'https://staging-project.supabase.co',
          'https://staging-xyz1234567890abcdef.supabase.co'
        ]
      },
      {
        name: 'SUPABASE_ANON_KEY',
        description: 'Anon ключ для Supabase (публичный ключ) для staging',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InN0YW5nbGUuY29tIiwic3ViIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        ]
      },
      {
        name: 'NEXTAUTH_URL',
        description: 'URL для NextAuth callback в staging',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'https://normaldance-staging.vercel.app',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https?:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'https://normaldance-staging.vercel.app',
          'https://normaldance-staging.render.com'
        ]
      },
      {
        name: 'NODE_ENV',
        description: 'Окружение выполнения Node.js',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'staging',
        validation: {
          pattern: '^(development|staging|production)$',
          forbiddenValues: ['']
        },
        examples: ['development', 'staging', 'production']
      }
    ]
  },

  production: {
    name: 'Production Environment',
    description: 'Шаблон секретов для продакшн окружения',
    environment: 'production',
    secrets: [
      {
        name: 'DATABASE_URL',
        description: 'URL базы данных для production',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'postgresql://user:password@prod-db.example.com:5432/normaldance_prod',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^postgresql:\\/\\/[^:]+:[^@]+@[^:]+:\\d+\\/[\\w-]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'postgresql://user:password@prod-db.example.com:5432/normaldance_prod',
          'postgresql://user:password://prod-db.cluster-xyz123.eu-west-1.rds.amazonaws.com:5432/normaldance_prod'
        ]
      },
      {
        name: 'NEXTAUTH_SECRET',
        description: 'Секрет для NextAuth.js (должен быть случайным и уникальным)',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: generateSecret(),
        validation: {
          minLength: 32,
          maxLength: 64,
          pattern: '^[a-zA-Z0-9\\-_]+$',
          forbiddenValues: ['', 'null', 'undefined', 'development', 'staging', 'production']
        },
        examples: [
          'production-super-secret-nextauth-key-here',
          'production-secure-secret-key-12345'
        ]
      },
      {
        name: 'SUPABASE_URL',
        description: 'URL Supabase сервиса для production',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'https://prod-project.supabase.co',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'https://prod-project.supabase.co',
          'https://prod-xyz1234567890abcdef.supabase.co'
        ]
      },
      {
        name: 'SUPABASE_ANON_KEY',
        description: 'Anon ключ для Supabase (публичный ключ) для production',
        required: true,
        sensitive: true,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InByb2plY3RzLmNvbSIsInN1YiI6InRlc3RAZXhhbXBsZS5jb20iLCJleHAiOjE5ODM4MTI5OTZ9.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
        ]
      },
      {
        name: 'NEXTAUTH_URL',
        description: 'URL для NextAuth callback в production',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'https://normaldance.vercel.app',
        validation: {
          minLength: 10,
          maxLength: 2048,
          pattern: '^https?:\\/\\/[^\\s]+$',
          forbiddenValues: ['', 'null', 'undefined']
        },
        examples: [
          'https://normaldance.vercel.app',
          'https://normaldance.render.com'
        ]
      },
      {
        name: 'NODE_ENV',
        description: 'Окружение выполнения Node.js',
        required: false,
        sensitive: false,
        platforms: ['render', 'vercel', 'railway'],
        defaultValue: 'production',
        validation: {
          pattern: '^(development|staging|production)$',
          forbiddenValues: ['']
        },
        examples: ['development', 'staging', 'production']
      }
    ]
  }
};

/**
 * Конфигурация платформ деплоя
 */
const platformConfigs = {
  render: {
    name: 'Render',
    description: 'Конфигурация для платформы Render',
    requiredSecrets: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    optionalSecrets: ['NEXTAUTH_URL', 'NODE_ENV'],
    environmentVariables: {
      DATABASE_URL: 'Render Database URL',
      NEXTAUTH_SECRET: 'NextAuth Secret',
      SUPABASE_URL: 'Supabase Service URL',
      SUPABASE_ANON_KEY: 'Supabase Anon Key',
      NEXTAUTH_URL: 'NextAuth Callback URL',
      NODE_ENV: 'Node Environment'
    }
  },
  vercel: {
    name: 'Vercel',
    description: 'Конфигурация для платформы Vercel',
    requiredSecrets: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    optionalSecrets: ['NEXTAUTH_URL', 'NODE_ENV'],
    environmentVariables: {
      DATABASE_URL: 'Vercel Database URL',
      NEXTAUTH_SECRET: 'NextAuth Secret',
      SUPABASE_URL: 'Supabase Service URL',
      SUPABASE_ANON_KEY: 'Supabase Anon Key',
      NEXTAUTH_URL: 'NextAuth Callback URL',
      NODE_ENV: 'Node Environment'
    }
  },
  railway: {
    name: 'Railway',
    description: 'Конфигурация для платформы Railway',
    requiredSecrets: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    optionalSecrets: ['NEXTAUTH_URL', 'NODE_ENV'],
    environmentVariables: {
      DATABASE_URL: 'Railway Database URL',
      NEXTAUTH_SECRET: 'NextAuth Secret',
      SUPABASE_URL: 'Supabase Service URL',
      SUPABASE_ANON_KEY: 'Supabase Anon Key',
      NEXTAUTH_URL: 'NextAuth Callback URL',
      NODE_ENV: 'Node Environment'
    }
  }
};

/**
 * Утилиты для работы с шаблонами
 */
const templateUtils = {
  /**
   * Получение шаблона для окружения
   */
  getTemplate(environment) {
    return secretsTemplates[environment] || null;
  },

  /**
   * Получение всех шаблонов
   */
  getAllTemplates() {
    return secretsTemplates;
  },

  /**
   * Получение конфигурации платформы
   */
  getPlatformConfig(platform) {
    return platformConfigs[platform] || null;
  },

  /**
   * Получение всех конфигураций платформ
   */
  getAllPlatformConfigs() {
    return platformConfigs;
  },

  /**
   * Валидация шаблона
   */
  validateTemplate(template) {
    const errors = [];
    
    if (!template || !template.name) {
      errors.push('Template name is required');
    }
    
    if (!template.secrets || !Array.isArray(template.secrets)) {
      errors.push('Template secrets must be an array');
    }
    
    if (template.secrets) {
      template.secrets.forEach((secret, index) => {
        if (!secret.name) {
          errors.push(`Secret at index ${index} must have a name`);
        }
        
        if (secret.required && !secret.defaultValue) {
          errors.push(`Required secret '${secret.name}' must have a default value`);
        }
        
        if (secret.validation && secret.validation.pattern) {
          try {
            new RegExp(secret.validation.pattern);
          } catch (e) {
            errors.push(`Invalid regex pattern for secret '${secret.name}': ${e.message}`);
          }
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Генерация отчета по шаблонам
   */
  generateReport() {
    const report = {
      templates: {},
      platforms: {},
      summary: {
        totalTemplates: Object.keys(secretsTemplates).length,
        totalPlatforms: Object.keys(platformConfigs).length,
        totalSecrets: 0,
        requiredSecrets: 0,
        optionalSecrets: 0
      }
    };

    // Анализ шаблонов
    Object.entries(secretsTemplates).forEach(([env, template]) => {
      report.templates[env] = {
        name: template.name,
        description: template.description,
        secretsCount: template.secrets.length,
        requiredSecrets: template.secrets.filter(s => s.required).length,
        optionalSecrets: template.secrets.filter(s => !s.required).length
      };
      
      report.summary.totalSecrets += template.secrets.length;
      report.summary.requiredSecrets += template.secrets.filter(s => s.required).length;
      report.summary.optionalSecrets += template.secrets.filter(s => !s.required).length;
    });

    // Анализ платформ
    Object.entries(platformConfigs).forEach(([platform, config]) => {
      report.platforms[platform] = {
        name: config.name,
        description: config.description,
        requiredSecrets: config.requiredSecrets.length,
        optionalSecrets: config.optionalSecrets.length
      };
    });

    return report;
  }
};

// Экспорт всех компонентов
module.exports = {
  secretsTemplates,
  platformConfigs,
  templateUtils,
  generateSecret
};

// Экспорт по умолчанию для обратной совместимости
module.exports.secretsTemplates = secretsTemplates;