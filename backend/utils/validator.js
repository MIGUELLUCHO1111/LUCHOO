import Config from '../config/config.js';

class Validator {
  constructor() {
    this.config = new Config();
    this.validationRules = this.config.getValidationValues();
  }

  /**
   * Método de validación genérico
   * @param {*} value - Valor a validar
   * @param {string} type - Tipo de dato (string, number, email)
   * @param {string} category - Categoría (username, email, password, etc.)
   * @param {Object} options - Opciones adicionales
   * @returns {Object} - { isValid: boolean, message: string }
   */
  validate(value, type, category, options = {}) {
    try {
      // Validación de tipo básico
      if (!this.validateType(value, type)) {
        return {
          isValid: false,
          message: `El campo ${category} debe ser de tipo ${type}`,
        };
      }

      // Validación de requerido
      if (options.required && (!value || value.toString().trim() === '')) {
        return {
          isValid: false,
          message: `El campo ${category} es obligatorio`,
        };
      }

      // Si no hay valor y no es requerido, es válido
      if (!value && !options.required) {
        return { isValid: true, message: '' };
      }

      // Validaciones específicas por categoría
      const categoryValidation = this.validateCategory(
        value,
        category,
        options,
      );
      if (!categoryValidation.isValid) {
        return categoryValidation;
      }

      // Validaciones de seguridad
      const securityValidation = this.validateSecurity(value, category);
      if (!securityValidation.isValid) {
        return securityValidation;
      }

      return { isValid: true, message: '' };
    } catch (error) {
      return {
        isValid: false,
        message: `Error en validación de ${category}: ${error.message}`,
      };
    }
  }

  /**
   * Valida el tipo de dato básico
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string' || value instanceof String;
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'email':
        return this.isValidEmail(value);
      default:
        return true; // Si no se especifica tipo, no se valida
    }
  }

  /**
   * Valida según las reglas del archivo validations.json
   */
  validateCategory(value, category, options = {}) {
    const stringValue = value.toString().trim();
    const rules = this.getCategoryRules(category);

    if (!rules) {
      return { isValid: true, message: '' }; // Si no hay reglas, es válido
    }

    // Validación de longitud mínima
    if (rules.min && stringValue.length < rules.min) {
      return {
        isValid: false,
        message:
          options.minMessage ||
          `El campo ${category} debe tener al menos ${rules.min} caracteres`,
      };
    }

    // Validación de longitud máxima
    if (rules.max && stringValue.length > rules.max) {
      return {
        isValid: false,
        message:
          options.maxMessage ||
          `El campo ${category} no puede exceder ${rules.max} caracteres`,
      };
    }

    // Validaciones específicas por categoría
    switch (category) {
      case 'username':
        return this.validateUsername(stringValue, options);
      case 'email':
        return this.validateEmail(stringValue, options);
      case 'password':
        return this.validatePassword(stringValue, options);
      default:
        return { isValid: true, message: '' };
    }
  }

  /**
   * Obtiene las reglas de validación para una categoría
   */
  getCategoryRules(category) {
    // Buscar en todas las secciones del validations.json
    for (const section of Object.keys(this.validationRules)) {
      if (this.validationRules[section][category]) {
        return this.validationRules[section][category];
      }
    }
    return null;
  }

  /**
   * Validación específica para username
   */
  validateUsername(username, options = {}) {
    const usernameRegex = /^[a-zA-Z0-9._]+$/;

    if (!usernameRegex.test(username)) {
      return {
        isValid: false,
        message:
          options.patternMessage ||
          'El usuario solo puede contener letras, números, puntos y guiones bajos',
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validación específica para email
   */
  validateEmail(email, options = {}) {
    if (!this.isValidEmail(email)) {
      return {
        isValid: false,
        message:
          options.emailMessage ||
          'El formato del correo electrónico no es válido',
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validación específica para password
   */
  validatePassword(password, options = {}) {
    // Mínimo 8 caracteres (sobrescribe el validations.json si es menor)
    if (password.length < 8) {
      return {
        isValid: false,
        message:
          options.passwordMinMessage ||
          'La contraseña debe tener al menos 8 caracteres',
      };
    }

    // Validación de caracteres especiales para seguridad
    if (options.requireSpecialChars !== false) {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        return {
          isValid: false,
          message:
            options.passwordStrengthMessage ||
            'La contraseña debe contener mayúsculas, minúsculas y números',
        };
      }
    }

    return { isValid: true, message: '' };
  }

  /**
   * Validaciones de seguridad
   */
  validateSecurity(value, category) {
    const stringValue = value.toString();

    // Prevención de XSS
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<[^>]*>/g,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(stringValue)) {
        return {
          isValid: false,
          message: `El campo ${category} contiene caracteres no permitidos por seguridad`,
        };
      }
    }

    // Prevención básica de SQL Injection
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|\*|;|'|")/g,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(stringValue)) {
        return {
          isValid: false,
          message: `El campo ${category} contiene caracteres sospechosos`,
        };
      }
    }

    return { isValid: true, message: '' };
  }

  /**
   * Valida formato de email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida un objeto completo con múltiples campos
   * @param {Object} data - Objeto con datos a validar
   * @param {Object} schema - Schema de validación
   * @returns {Object} - { isValid: boolean, errors: Object }
   */
  validateObject(data, schema) {
    const safeData = data || {};
    const errors = {};
    let isValid = true;

    for (const [field, rules] of Object.entries(schema)) {
      const value = safeData[field];
      const validation = this.validate(
        value,
        rules.type,
        field,
        rules.options || {},
      );

      if (!validation.isValid) {
        errors[field] = validation.message;
        isValid = false;
      }
    }

    return { isValid, errors };
  }
}

export default Validator;
