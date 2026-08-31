export default class Debugger {
  constructor() {
    this.logSpacing = 2;
  }

  logColoredText(text, colorCodes = []) {
    // colorCodes example: ['red', 'bg-green', 'bold']
    const colorMap = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      italic: '\x1b[3m',
      underline: '\x1b[4m',
      // Text colors (30-37)
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      // Background colors (40-47)
      'bg-black': '\x1b[40m',
      'bg-red': '\x1b[41m',
      'bg-green': '\x1b[42m',
      'bg-yellow': '\x1b[43m',
      'bg-blue': '\x1b[44m',
      'bg-magenta': '\x1b[45m',
      'bg-cyan': '\x1b[46m',
      'bg-white': '\x1b[47m',
    };
    const codes = colorCodes.map((code) => colorMap[code] || '').join('');
    console.log(`${codes}${text}${colorMap.reset}`);
  }

  logData(data, deep = 1) {
    if (Array.isArray(data)) {
      console.log(`  ${' '.repeat(deep * this.logSpacing)}[`);
      data.forEach((item) => {
        console.log(`  ${' '.repeat((deep + 1) * this.logSpacing)}'${item}',`);
      });
      console.log(`  ${' '.repeat(deep * this.logSpacing)}]`);
    } else {
      for (const d in data) {
        if (typeof data[d] === 'object') {
          console.log(`  ${' '.repeat(deep * this.logSpacing)}${d}: {`);
          this.logData(data[d], deep + 1);
          console.log(`  ${' '.repeat(deep * this.logSpacing)}}`);
        } else {
          console.log(`  ${' '.repeat(deep * this.logSpacing)}${d}:`, data[d]);
        }
      }
    }
  }
}
