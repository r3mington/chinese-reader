import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const frequencyTxtPath = path.join(__dirname, 'zh_50k.txt');
const cedictPath = path.join(__dirname, 'all_cedict.json');
const outputPath = path.join(__dirname, '../../public/frequency.json');

console.log('Loading dictionary...');
const cedictData = JSON.parse(fs.readFileSync(cedictPath, 'utf-8'));

// Build a Set of valid dictionary words to filter out junk/english/names
const validDictWords = new Set();
for (const entry of Object.values(cedictData)) {
    if (entry.simplified) {
        validDictWords.add(entry.simplified);
    }
}

console.log('Reading frequency corpus...');
const lines = fs.readFileSync(frequencyTxtPath, 'utf-8').split('\n');

const frequencyMap = {};
let rank = 1;

console.log('Parsing frequencies...');

for (const line of lines) {
    if (!line.trim()) continue;

    // Line format: "word 3400491"
    const [word, countStr] = line.split(' ');

    // Skip if it's not a real chinese word (e.g. "you", "i", "the")
    // or if it's a single character since frequency list is heavily skewed by single chars
    // Wait, the user might want single character frequencies too. We will keep single characters,
    // but we MUST ensure it's in our dictionary to filter out english words.

    // Basic filter: must be in CEDICT, must not contain english letters
    if (!word || /[a-zA-Z]/.test(word) || !validDictWords.has(word)) {
        continue;
    }

    // Only store up to the top 10,000 words to keep file size ultra small
    if (rank > 10000) break;

    // We store the RANK (1st, 2nd, 3rd most common), not the raw occurrence count.
    frequencyMap[word] = rank;
    rank++;
}

console.log(`Matched ${Object.keys(frequencyMap).length} valid words.`);

fs.writeFileSync(outputPath, JSON.stringify(frequencyMap));
console.log(`✅ Saved frequency map to ${outputPath}`);

const stats = fs.statSync(outputPath);
console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
