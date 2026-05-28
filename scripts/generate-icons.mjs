
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoSvgPath = path.join(__dirname, '../public/assets/logo.svg');
const outputDir = path.join(__dirname, '../public/assets/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const iconSizes = [
  16,
  32,
  48,
  64,
  72,
  96,
  128,
  144,
  152,
  180,
  192,
  256,
  384,
  512,
];

console.log('Generating icons...');

for (const size of iconSizes) {
  const outputPath = path.join(outputDir, `logo-${size}x${size}.png`);
  console.log(`Generating ${outputPath}...`);
  await sharp(logoSvgPath)
    .resize(size, size)
    .png()
    .toFile(outputPath);
}

console.log('Icons generated successfully!');
