import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Using the dictionary.txt from MakeMeAHanzi which contains etymological hints
const url = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const outputFile = path.join(__dirname, 'src', 'lib', 'etymology_data.json');

console.log('Downloading MakeMeAHanzi dictionary...');

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            console.log('Processing data...');
            const lines = data.split('\n');
            const etymMap = {};

            lines.forEach(line => {
                if (!line.trim()) return;
                try {
                    const parsed = JSON.parse(line);
                    // The 'character' field holds the hanzi, 'etymology' holds the breakdown object
                    if (parsed.character && parsed.etymology) {
                        const char = parsed.character;
                        const etym = parsed.etymology;

                        // We extract the type (Ideographic, Pictographic, Phonophonetic, etc) and the hint
                        if (etym.hint) {
                            etymMap[char] = {
                                type: etym.type,
                                hint: etym.hint
                            };
                        }
                    }
                } catch (e) {
                    // ignore malformed lines
                }
            });

            fs.writeFileSync(outputFile, JSON.stringify(etymMap), 'utf8');
            console.log(`Successfully processed Etymology data. Saved ${Object.keys(etymMap).length} characters to ${outputFile}`);
        } catch (e) {
            console.error('Error parsing dictionary:', e.message);
        }
    });

}).on('error', (err) => {
    console.error('Download error:', err.message);
});
