import Utils from '../utils/utils.js';
import Config from '../../config/config.js';
import MethodRegistry from './method_registry.js';

export default async function resolveExecutable({ subsystem, className, method }) {
    const utils = new Utils();
    const config = new Config();
    const registry = new MethodRegistry();
    const ERROR_CODES = config.ERROR_CODES;

    if (Object.keys(registry.getMap() || {}).length === 0) {
        await registry.init();
    }

    if (!registry.hasMethod(subsystem, className, method)) {
        return utils.handleError({
            message: `Ruta inválida: Método '${method}' no existe en '${subsystem}' -> '${className}'`,
            statusCode: ERROR_CODES.NOT_FOUND,
        });
    }

    try {
        const modulePath = `./sub_system/${subsystem}.js`;

        const module = await import(modulePath);

        const capitalizedSubsystem = subsystem.charAt(0).toUpperCase() + subsystem.slice(1);
        const SubSystemClass = module[capitalizedSubsystem] || module.default || Object.values(module)[0];

        if (!SubSystemClass) {
            throw new Error(`Módulo '${subsystem}' cargado, pero no exporta una clase válida.`);
        }

        const subSystemInstance = new SubSystemClass();

        const classPropKey = Object.keys(subSystemInstance).find(
            key => key.toLowerCase() === className.toLowerCase()
        );
        const InnerClassRef = subSystemInstance[classPropKey];

        if (!InnerClassRef) {
            return utils.handleError({
                message: `La clase '${className}' no está registrada en el constructor de '${subsystem}'`,
                statusCode: ERROR_CODES.NOT_FOUND,
            });
        }

        const classInstance = new InnerClassRef();
        return classInstance;

    } catch (error) {
        console.error("Error crítico en resolveExecutable:", error);
        return utils.handleError({
            message: `Error interno al cargar la ruta de ejecución: ${error.message}`,
            statusCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
        });
    }
}