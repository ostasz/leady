const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, '../src/lib/fonts/Roboto-Regular.ttf');
const outputPath = path.join(__dirname, '../src/lib/fonts/roboto-regular.ts');

try {
    const fontBuffer = fs.readFileSync(fontPath);
    const fontBase64 = fontBuffer.toString('base64');

    const content = `export const robotoRegular = '${fontBase64}';`;

    fs.writeFileSync(outputPath, content);
    console.log('Font converted successfully!');
} catch (error) {
    console.error('Error converting font:', error);
    process.exit(1);
}
