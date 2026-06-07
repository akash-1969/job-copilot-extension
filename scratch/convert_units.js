const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../content/content.css');
let content = fs.readFileSync(cssPath, 'utf8');

// Replace rem values (e.g., 1.25rem or .5rem)
content = content.replace(/(\b[0-9]*\.[0-9]+|\b[0-9]+)rem\b/g, (match, valStr) => {
  const val = parseFloat(valStr);
  const pxVal = Math.round(val * 16);
  console.log(`Converted rem: ${match} -> ${pxVal}px`);
  return `${pxVal}px`;
});

// For em values, let's inspect where they are used. 
// We only want to convert em values that are used for font-size, padding, margin, etc., and not letter-spacing.
// Let's replace em values if they are NOT in a line with 'letter-spacing'
const lines = content.split('\n');
const updatedLines = lines.map(line => {
  if (line.includes('letter-spacing')) {
    return line;
  }
  return line.replace(/(\b[0-9]*\.[0-9]+|\b[0-9]+)em\b/g, (match, valStr) => {
    const val = parseFloat(valStr);
    const pxVal = Math.round(val * 16); // approximate base 16px
    console.log(`Converted em (approx base 16): ${match} -> ${pxVal}px`);
    return `${pxVal}px`;
  });
});

content = updatedLines.join('\n');

fs.writeFileSync(cssPath, content, 'utf8');
console.log('Successfully completed unit conversion in content.css');
