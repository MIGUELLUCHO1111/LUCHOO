import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

export default class Method_registry {
  static instance;

  constructor() {
    if (Method_registry.instance) return Method_registry.instance;
    const filename = path.dirname(fileURLToPath(import.meta.url));
    this.rootPath = path.resolve(filename, '../bo');
    this.mapFiles = {};
    Method_registry.instance = this;
  }

  async initialize() {
    const subSystemsPath = path.join(this.rootPath, 'sub_system');
    let subSystemFiles = [];

    try {
      subSystemFiles = fs.readdirSync(subSystemsPath);
    } catch (err) {
      console.error(`Error leyendo la carpeta de subsistemas en ${subSystemsPath}`, err);
      return;
    }

    for (const file of subSystemFiles) {
      if (!file.endsWith('.js')) continue;

      const subSystemName = path.basename(file, '.js');
      this.mapFiles[subSystemName] = {};

      try {
        const module = await import(`file://${path.join(subSystemsPath, file)}`);

        const SubSystemClass = module[subSystemName];
        if (!SubSystemClass) continue;

        const subSystemInstance = new SubSystemClass();

        for (const [classNameKey, ClassRef] of Object.entries(subSystemInstance)) {
          this.mapFiles[subSystemName][classNameKey] = {};

          if (typeof ClassRef === 'function') {
            const classInstance = new ClassRef();

            for (const methodName of Object.keys(classInstance)) {
              this.mapFiles[subSystemName][classNameKey][methodName] = true;
            }
          }
        }
      } catch (err) {
        console.error(`Error procesando el mapa para el subsistema ${file}:`, err);
      }
    }
  }

  async init() {
    await this.initialize();
  }

  findKeyIgnoreCase(target, requestedKey) {
    if (!target || typeof requestedKey !== 'string') return undefined;
    return Object.keys(target).find(
      (key) => key.toLowerCase() === requestedKey.toLowerCase()
    );
  }

  hasMethod(subSystem, className, functionName) {
    const subsystemKey = this.findKeyIgnoreCase(this.mapFiles, subSystem);
    const classMap = subsystemKey ? this.mapFiles[subsystemKey] : undefined;

    const classKey = this.findKeyIgnoreCase(classMap, className);
    const methodMap = classKey ? classMap[classKey] : undefined;

    const methodKey = this.findKeyIgnoreCase(methodMap, functionName);
    return !!methodKey;
  }

  getMap() {
    return this.mapFiles;
  }
}