import express from 'express';
const router = express.Router();
import Person from '../service/person_service.js';
const personService = new Person();
import Validator from '../utils/validator.js';
const validator = new Validator();
import Config from '../config/config.js';
const config = new Config();
const getMessage = config.getMessage.bind(config);
const { STATUS_CODES } = config;

// Crear persona
router.post('/', async (req, res) => {
  try {
    const personSchema = {
      ci: { type: 'string', options: { required: true } },
      name: { type: 'string', options: { required: true } },
      email: { type: 'email', options: { required: true } },
      lastname: { type: 'string', options: { required: false } },
      phone: { type: 'string', options: { required: false } },
    };

    const validation = validator.validateObject(req.body, personSchema);
    if (!validation.isValid) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: getMessage(config.LANGUAGE, 'validation_error'),
        errors: validation.errors,
      });
    }

    const personData = await personService.createPerson(req.body);
    res.status(STATUS_CODES.OK).json({
      message: 'Person created successfully',
      person: personData,
    });
  } catch (error) {
    res.status(STATUS_CODES.BAD_REQUEST).json({
      message: error.message || 'Error creating person',
      error,
    });
  }
});

export default router;
