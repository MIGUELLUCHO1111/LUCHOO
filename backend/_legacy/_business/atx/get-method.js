import Utils from '../../utils/utils.js';
import Config from '../../../config/config.js';
import Business from '../business.js';

export default async function getMethod({ subsystem, className, method }) {
  const utils = new Utils();
  const config = new Config();
  const business = new Business();
  const ERROR_CODES = config.ERROR_CODES;
  let folderPaths = business.getFolderPaths();
  let mappedFiles = business.getMappedFilenames();

  if (folderPaths.length === 0 || Object.keys(mappedFiles).length === 0) {
    business.init();
    folderPaths = business.getFolderPaths();
    mappedFiles = business.getMappedFilenames();
  }

  let path = null;

  if (folderPaths.includes(className)) {
    const fileName = mappedFiles[className]?.[method];
    if (!fileName) {
      utils.handleError({
        message: `Método '${method}' no encontrado en clase '${className}'`,
        statusCode: ERROR_CODES.NOT_FOUND,
      });
    }
    path = `#${className}/${fileName}`;
  } else if (subsystem === 'ftx') {
    path = `#${subsystem}/${className}.js`;
  } else if (subsystem === 'eventos') {
    path = `../ftx/${className}.js`;
  } else {
    path = `#${className}/${className}.js`;
  }

  console.log(
    `Importing method from path: ${path} ---- ${subsystem} / ${className} / ${method}`,
  );

  const c = await import(path);
  let i = new c.default();
  if (i && typeof i[method] !== 'function') {
    utils.handleError({
      message: `Método '${method}' no encontrado en clase '${className}'`,
      statusCode: ERROR_CODES.NOT_FOUND,
    });
  }
  return i;
}
