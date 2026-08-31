import express from 'express';
const router = express.Router();
import ProfileService from '../service/profile_service.js';
const profileService = new ProfileService();
import Validator from '../utils/validator.js';
const validator = new Validator();
import Config from '../config/config.js';
const config = new Config();
const getMessage = config.getMessage.bind(config);
const { STATUS_CODES } = config;

// Asignar perfil a usuario
router.post('/assign', async (req, res) => {
    try {
        const assignSchema = {
            user_id: { type: 'number', options: { required: true } },
            profile_id: { type: 'number', options: { required: true } },
        };

        const validation = validator.validateObject(req.body, assignSchema);
        if (!validation.isValid) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                message: getMessage(config.LANGUAGE, 'validation_error'),
                errors: validation.errors,
            });
        }

        const assignedData = await profileService.assignProfileToUser(req.body);
        res.status(STATUS_CODES.OK).json({
            message: 'Profile assigned successfully',
            data: assignedData,
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            message: error.message || 'Error assigning profile',
            error,
        });
    }
});

// Crear perfil
router.post('/', async (req, res) => {
    try {
        const createSchema = {
            profile_name: { type: 'string', options: { required: true } },
        };

        const validation = validator.validateObject(req.body, createSchema);
        if (!validation.isValid) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                message: getMessage(config.LANGUAGE, 'validation_error'),
                errors: validation.errors,
            });
        }

        const insertedProfile = await profileService.createProfile(req.body);
        res.status(STATUS_CODES.OK).json({
            message: 'Profile created successfully',
            data: insertedProfile,
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            message: error.message || 'Error creating profile',
            error,
        });
    }
});

// Obtener ID de perfil por nombre
router.get('/profile-id/:name', async (req, res) => {
    try {
        const profile_name = req.params.name;
        const profileData = await profileService.getProfileByName(profile_name);

        if (!profileData) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                message: 'Profile not found'
            });
        }

        res.status(STATUS_CODES.OK).json({
            profile: profileData,
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            message: error.message || 'Error getting profile',
            error,
        });
    }
});

export default router;
