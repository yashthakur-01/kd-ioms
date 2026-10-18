import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCheck = process.argv.includes('--check');

const backendEnumsDir = path.resolve(__dirname, '../../backend/src/enums');
const frontendEnumsDir = path.resolve(__dirname, '../src/lib/enums');

if (!fs.existsSync(frontendEnumsDir)) {
  fs.mkdirSync(frontendEnumsDir, { recursive: true });
}

if (!fs.existsSync(backendEnumsDir)) {
  console.error(`Backend enums directory not found: ${backendEnumsDir}`);
  process.exit(1);
}

const enumFiles = fs.readdirSync(backendEnumsDir).filter(file => file.endsWith('.enum.ts'));

let hasDrift = false;

for (const file of enumFiles) {
  const sourcePath = path.join(backendEnumsDir, file);
  const targetPath = path.join(frontendEnumsDir, file);

  const sourceContent = fs.readFileSync(sourcePath, 'utf8');

  if (fs.existsSync(targetPath)) {
    const targetContent = fs.readFileSync(targetPath, 'utf8');
    if (sourceContent !== targetContent) {
      if (isCheck) {
        console.error(`Drift detected in enum file: ${file}`);
        hasDrift = true;
      } else {
        fs.writeFileSync(targetPath, sourceContent, 'utf8');
        console.log(`Updated enum file: ${file}`);
      }
    }
  } else {
    if (isCheck) {
      console.error(`Missing enum file in frontend: ${file}`);
      hasDrift = true;
    } else {
      fs.writeFileSync(targetPath, sourceContent, 'utf8');
      console.log(`Created enum file: ${file}`);
    }
  }
}

if (isCheck && hasDrift) {
  console.error('Enum drift check failed! Run "npm run sync-enums" to synchronize enums.');
  process.exit(1);
}

if (!isCheck) {
  console.log(`Successfully synchronized ${enumFiles.length} enum files to frontend.`);
}
