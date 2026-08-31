import { checkEmailInUse, checkUsernameInUse } from '../dbms/db-validations.js';
import Config from '../../config/config.js';
import z from 'zod';

export default class Validator {
  constructor(dbmsInstance = null) {
    // Permite inyectar/actualizar DBMS en el singleton si aún no existe o si está vacío
    if (Validator.instance && dbmsInstance && !Validator.instance.dbms) {
      Validator.instance.dbms = dbmsInstance;
      return Validator.instance;
    }

    this.dbms = dbmsInstance;
    this.config = new Config();

    const customTypes =
      this.config && typeof this.config.getCustomTypes === 'function'
        ? this.config.getCustomTypes()
        : {};

    if (!Validator.instance) {
      this.types = {
        array: z.array(z.any()),
        int: z.number().int(),
        float: z
          .number()
          .refine((v) => !Number.isInteger(v), { message: 'Debe ser float' }),
        string: z.string(),
        boolean: z.boolean(),
        date: z.date(),
        object: z.object({}).passthrough(),
        strings_array: z.array(z.string()),
        object_of_strings: z.record(z.string()),
        object_of_strings_array: z.record(z.array(z.string())),
        array_of_objects: z.array(z.object({}).passthrough()),
        object_of_arrays: z.record(z.array(z.any())),
        ...customTypes,
      };

      this.validationValues =
        this.config && typeof this.config.getValidationValues === 'function'
          ? this.config.getValidationValues()
          : {
              user: {
                username: { min: 3, max: 32 },
                email: { max: 254 },
                password: { min: 8, max: 128 },
              },
            };

      Validator.instance = this;
    }
    return Validator.instance;
  }

  async validateUsername(value) {
    const { min, max } = this.validationValues.user.username;

    // Validación con Zod
    const usernameSchema = z
      .string()
      .min(min, `El nombre de usuario debe tener al menos ${min} caracteres.`)
      .max(
        max,
        `El nombre de usuario no puede tener más de ${max} caracteres.`,
      );

    try {
      usernameSchema.parse(value);
    } catch (err) {
      return err.errors[0].message; // Retorna primer error de Zod
    }

    const usernameInUse = await checkUsernameInUse(value, this.dbms);
    return usernameInUse || '';
  }

  async validateUsernameLogin(value) {
    const { min, max } = this.validationValues.user.username;

    // Validación con Zod
    const usernameSchema = z
      .string()
      .min(min, `El nombre de usuario debe tener al menos ${min} caracteres.`)
      .max(max, `El nombre de usuario no puede tener más de ${max} caracteres.`)
      .regex(/^[A-Za-z0-9.,$*]+$/, 'Solo letras, números y . , $ *');

    try {
      usernameSchema.parse(value);
    } catch (err) {
      return err.errors[0].message; // Retorna primer error de Zod
    }
    return '';
  }

  async validateEmail(email) {
    const { max } = this.validationValues.user.email;

    const emailSchema = z
      .string()
      .max(max, `El email no puede tener más de ${max} caracteres`)
      .refine(
        (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        'El email no es válido',
      );

    try {
      emailSchema.parse(email);
    } catch (err) {
      return err.errors[0].message;
    }

    const emailInUse = await checkEmailInUse(email, this.dbms);
    return emailInUse || '';
  }

  validatePassword(text) {
    const { min, max } = this.validationValues.user.password;

    const passwordSchema = z
      .string()
      .min(min, `La contraseña debe tener al menos ${min} caracteres`)
      .max(max, `La contraseña no puede tener más de ${max} caracteres`)
      .refine(
        (val) => /[A-Z]/.test(val),
        'La contraseña debe contener al menos una letra mayúscula',
      )
      .refine(
        (val) => /[a-z]/.test(val),
        'La contraseña debe contener al menos una letra minúscula',
      )
      .refine(
        (val) => /[0-9]/.test(val),
        'La contraseña debe contener al menos un número',
      )
      .refine(
        (val) =>
          /[-:+_º·$/[\]}{|~€|@#~€¬`«»%()?¿¡;.'"!@#\$//%\^,&\*]/.test(val),
        'La contraseña debe contener al menos un símbolo',
      );

    try {
      passwordSchema.parse(text);
      return '';
    } catch (err) {
      return err.errors[0].message;
    }
  }

  validateConfirmPassword(pass, confirmPass) {
    const confirmSchema = z
      .string()
      .refine((val) => val === pass, 'Las contraseñas no coinciden');

    try {
      confirmSchema.parse(confirmPass);
      return '';
    } catch (err) {
      return err.errors[0].message;
    }
  }

  getValidationValues(entity, field) {
    return this.validationValues[entity][field];
  }

  validateName(value, entity) {
    const { min, max } = this.getValidationValues(entity, 'name');

    const nameSchema = z
      .string()
      .min(min, `El nombre de ${entity} debe tener al menos ${min} caracteres.`)
      .max(
        max,
        `El nombre de ${entity} no puede tener más de ${max} caracteres.`,
      );

    try {
      nameSchema.parse(value);
      return '';
    } catch (err) {
      return err.errors[0].message;
    }
  }

  validateDescription(value, entity) {
    const { max } = this.getValidationValues(entity, 'description');

    const descSchema = z
      .string()
      .max(
        max,
        `La descripción de ${entity} no puede tener más de ${max} caracteres.`,
      )
      .optional(); // en caso de que el valor sea undefined o vacío

    try {
      descSchema.parse(value || ''); // si es undefined, parsea ''
      return '';
    } catch (err) {
      return err.errors[0].message;
    }
  }

  validateStructuredData(data, structure) {
    const errors = [];

    const buildSchema = (struct) => {
      if (typeof struct === 'string') {
        // Convención de tipos opcionales: 'string|null', 'int|null', etc.
        const isNullable = struct.endsWith('|null');
        const baseType = isNullable ? struct.slice(0, -'|null'.length) : struct;

        let schema;
        switch (baseType) {
          case 'string':
            schema = z.string();
            break;
          case 'number':
          case 'int':
            schema = z.number();
            break;
          case 'boolean':
            schema = z.boolean();
            break;
          case 'array':
            schema = z.array(z.any());
            break;
          case 'object':
            schema = z.object({});
            break;
          case 'date':
            schema = z.date();
            break;
          default:
            schema = z.custom((val) => this.validateField(val, baseType) === true);
        }

        return isNullable ? schema.nullable().optional() : schema;
      } else if (struct.root) {
        return buildSchema(struct.root);
      } else if (typeof struct === 'object') {
        const shape = {};
        for (const key in struct) {
          shape[key] = buildSchema(struct[key]);
        }
        return z.object(shape);
      }

      return z.any();
    };

    const schema = buildSchema(structure);

    try {
      schema.parse(data);
    } catch (err) {
      if (err.errors) {
        err.errors.forEach((e) => errors.push(e.message));
      } else {
        errors.push(err?.message || 'Error desconocido en estructura de datos');
      }
    }

    return errors;
  }

  validateField(value, type) {
    const schema = this.types[type];
    if (!schema) return false;

    try {
      schema.parse(value);
      return true;
    } catch (err) {
      return false;
    }
  }

  // validator.js
  validateDate(value) {
    // aceptar tanto Date como string ISO
    try {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return 'Fecha inválida';
        return value;
      }

      // acepta strings; Zod transforma a Date
      const dateSchema = z.string().transform((val) => new Date(val));
      const parsed = dateSchema.parse(value);

      if (isNaN(parsed.getTime())) {
        return 'Fecha inválida';
      }

      return parsed; // <-- devuelve Date en caso OK
    } catch (err) {
      // En algunos casos err.errors puede no existir; protegerse
      return err?.errors?.[0]?.message ?? 'Fecha inválida';
    }
  }

  // validateFloat: acepta enteros o decimales, acepta strings numéricos,
  // usa validationValues[entity][field] si se le pasan entity+field para min/max.
  validateFloat(value, entity = null, field = null) {
    // Normalizar entrada: aceptar '0', '12.5', 0, 12.5, etc.
    if (value === undefined || value === null || value === '') {
      return 'Valor numérico requerido';
    }

    const num = Number(value);
    if (!isFinite(num)) {
      return 'No es un número válido';
    }

    // Si hay configuración para entity+field (min/max), aplicarla
    if (entity && field) {
      const cfg = this.validationValues?.[entity]?.[field];
      if (cfg) {
        const { min, max } = cfg;
        if (typeof min !== 'undefined' && num < min) {
          return `${field} debe ser >= ${min}`;
        }
        if (typeof max !== 'undefined' && num > max) {
          return `${field} debe ser <= ${max}`;
        }
        return ''; // pasó las reglas específicas
      }
      // Si pediste reglas y no existen, devolver error claro
      if (this.validationValues?.[entity]) {
        return `No hay reglas de validación para ${entity}.${field}`;
      }
    }

    // Fallback: zod parse para mensajes consistentes (opcional)
    try {
      const schema = z.number();
      schema.parse(num);
      return '';
    } catch (err) {
      return err?.errors?.[0]?.message ?? 'Valor numérico inválido';
    }
  }

  // validateInteger: asegura que sea entero (uso para capacidad)
  validateInteger(value, entity = null, field = null) {
    if (value === undefined || value === null || value === '') {
      return 'Valor entero requerido';
    }

    const num = Number(value);
    if (!Number.isInteger(num)) {
      return 'Debe ser un entero';
    }

    if (entity && field) {
      const cfg = this.validationValues?.[entity]?.[field];
      if (cfg) {
        const { min, max } = cfg;
        if (typeof min !== 'undefined' && num < min) {
          return `${field} debe ser >= ${min}`;
        }
        if (typeof max !== 'undefined' && num > max) {
          return `${field} debe ser <= ${max}`;
        }
      } else if (this.validationValues?.[entity]) {
        return `No hay reglas de validación para ${entity}.${field}`;
      }
    }

    return '';
  }
}
