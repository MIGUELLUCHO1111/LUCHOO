import fs from 'fs/promises';

export default class Utils {
  constructor() {}

  toUpperCaseFirstLetter = (string) =>
    string.charAt(0).toUpperCase() + string.slice(1);

  getAllDinamicMethodNames = (thisArg) =>
    Object.keys(thisArg).filter(
      (method) => typeof thisArg[method] === 'function',
    );

  handleError({ message, statusCode, error = {} }) {
    const errPayload = {
      message,
      statusCode,
      error:
        error && typeof error === 'object'
          ? {
              message: error.message || undefined,
              code: error.code || error.errno || undefined,
              detail: error.detail || undefined,
            }
          : error,
    };
    throw new Error(JSON.stringify(errPayload));
  }
  async readCSV(filePath) {
      try {
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length === 0) return new Map();
          const headers = lines[0].split(";").map(h => h.trim());
          const idIndex = headers.indexOf("id");
          if (idIndex === -1) {
              throw new Error('Missing required column "id" in CSV headers.');
          }
          const dataById = new Map();
          for (const line of lines.slice(1)) {
              const values = line.split(";").map(v => v.trim());
              const rowObject = headers.reduce((obj, header, i) => {
                  obj[header] = values[i] ?? "";
                  return obj;
              }, {});
              const idValue = values[idIndex];
              if (!idValue) continue;
              dataById.set(idValue, rowObject);
          }
          return structuredClone(dataById);
      } catch (error) {
          console.error("Error reading file:", error.message);
          return new Map();
      }
  }
}