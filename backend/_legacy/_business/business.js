import fs from 'fs';
import path from 'path';

export default class Business {
  constructor() {
    if (!Business.instance) {
      this.rootPath = './src/_business';
      this.mapFiles = {};
      this.folderPaths = [];
      Business.instance = this;
    }
    return Business.instance;
  }

  init() {
    const excludeFolders = ['ftx'];
    const files = fs.readdirSync(this.rootPath);
    this.folderPaths = files.filter((file) => {
      if (excludeFolders.includes(file)) return false;
      const filePath = path.join(this.rootPath, file);
      return fs.statSync(filePath).isDirectory();
    });

    this.folderPaths.forEach((folderPath) => {
      this.mapFolderSync(path.join(this.rootPath, folderPath));
    });
  }

  mapFolderSync(directoryPath) {
    try {
      const files = fs.readdirSync(directoryPath);
      files.forEach((file) => {
        if (file === 'atx.js') return;
        const filePath = path.join(directoryPath, file);
        let stat;
        try {
          stat = fs.statSync(filePath);
        } catch (sErr) {
          // no es accesible o no existe
          console.error(`Error al acceder ${filePath}:`, sErr);
          return;
        }
        if (!stat.isFile()) return;

        let data;
        try {
          data = fs.readFileSync(filePath);
        } catch (readErr) {
          console.error(`Error al leer el archivo ${filePath}:`, readErr);
          return;
        }

        const name = this.getFileExportedFunctionSync(`./${file}`, data);
        const className = path.basename(directoryPath);
        if (!this.mapFiles[className]) this.mapFiles[className] = {};

        if (name) {
          this.mapFiles[className][name] = file;
        }
      });
    } catch (err) {
      console.error('Error al leer el directorio:', directoryPath, err);
    }
  }

  getFileExportedFunctionSync(path, data) {
    // Analiza el contenido del archivo (data) y devuelve el nombre (string)
    // de la función exportada por defecto si se puede determinar sin importar
    // el módulo. Si no se encuentra un nombre (por ejemplo export default function() {}),
    // devuelve null. También hace console.log del nombre encontrado o de la ausencia.
    try {
      const src = data && data.toString ? data.toString('utf8') : '';
      if (!src) {
        console.log(`No se proporcionó contenido para ${path}`);
        return null;
      }

      // 1) export default function NAME(
      const reExportFunc =
        /export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/m;

      // 2) export default NAME;  -> covers cases like: function NAME(){}\nexport default NAME; or const NAME = () => {}\nexport default NAME;
      const reExportIdent = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;/m;

      // 3) export default NAME\n (no semicolon)
      const reExportIdentNoSemi = /export\s+default\s+([A-Za-z_$][\w$]*)\s*\n/m;

      const regExps = [reExportFunc, reExportIdent, reExportIdentNoSemi];

      for (const re of regExps) {
        const m = src.match(re);
        if (m && m[1]) return m[1];
      }

      // No se pudo determinar un nombre (por ejemplo export default function() {} o export default () => {})
      console.log(`No exported default function name found in ${path}`);
      return null;
    } catch (err) {
      console.error(`Error al analizar el contenido de ${path}:`, err);
      return null;
    }
  }

  getFileName(className, functionName) {
    return this.mapFiles[className]?.[functionName] || null;
  }

  getMappedFilenames() {
    return this.mapFiles;
  }

  getFolderPaths() {
    return this.folderPaths;
  }

  getFileName(className, functionName) {
    return this.mapFiles[className]?.[functionName] || null;
  }
}
