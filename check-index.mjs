const ts = require('typescript');
const path = require('path');
const fs = require('fs');

const configPath = path.join('src', 'main', 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, 'src/main');
const program = ts.createProgram(['src/main/index.ts'], parsed.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

const srcErrors = diagnostics.filter(d => d.file && d.file.fileName.includes('src/main/index.ts'));
if (srcErrors.length === 0) {
  console.log('OK: index.ts has no type errors');
} else {
  console.log('ERROR: index.ts has ' + srcErrors.length + ' errors:');
  srcErrors.forEach(d => {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const line = d.file.getLineAndCharacterOfPosition(d.start).line + 1;
    console.log('  Line ' + line + ': ' + msg);
  });
}
