const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../public/data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Download helper
const downloadJSON = (url, dest) => {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${url}...`);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(dest, data);
                console.log(`Saved to ${dest}`);
                resolve();
            });
        }).on('error', reject);
    });
};

const run = async () => {
    try {
        // 1. Radicals (Unihan mapping)
        // We can use the cjk-unihan dataset converted to JSON, or a simpler radical list.
        // There is a good one on GitHub: yishn/hanzi-dictionary or skishore/makemeahanzi
        const RADICALS_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
        const radicalsPath = path.join(DATA_DIR, 'radicals.json');

        console.log('Fetching MakeMeAHanzi Dictionary for Radicals...');
        await new Promise((resolve, reject) => {
            https.get(RADICALS_URL, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const lines = data.split('\n');
                    const radicalsMap = {};
                    lines.forEach(line => {
                        if (!line) return;
                        try {
                            const entry = JSON.parse(line);
                            if (entry.character && entry.radical) {
                                radicalsMap[entry.character] = entry.radical;
                            }
                        } catch (e) { }
                    });
                    fs.writeFileSync(radicalsPath, JSON.stringify(radicalsMap));
                    console.log(`Saved ${Object.keys(radicalsMap).length} radicals to ${radicalsPath}`);
                    resolve();
                });
            }).on('error', reject);
        });

        // 2. Mnemonics (Heisig 'Remembering the Hanzi')
        // Using an open source flashcard or kanji mapping that includes Chinese Heisig keywords
        // Note: Full free Heisig datasets are rare due to copyright, but open mnemonic dictionaries exist.
        // We will mock a skeleton here or find a permissible list (e.g. from an open Anki deck representation)
        // For demonstration, we will download a known permissible character mapping repo if available, 
        // or just seed it with common ones and instructions on how the user can provide their own `mnemonics.json`.
        const mnemonicsPath = path.join(DATA_DIR, 'mnemonics.json');
        const exampleMnemonics = {
            "明": "Sun + Moon = Bright",
            "好": "Woman + Child = Good",
            "休": "Person + Tree = Rest",
            "看": "Hand over Eye = Look"
        };
        fs.writeFileSync(mnemonicsPath, JSON.stringify(exampleMnemonics, null, 2));
        console.log(`Saved skeleton mnemonics to ${mnemonicsPath}`);

        // 3. Synonyms
        // We could extract synonyms from an open wordnet, but they are often gigantic.
        // We'll create a structured skeleton that can be populated later or look for a small open source thesaurus.
        const synonymsPath = path.join(DATA_DIR, 'synonyms.json');
        const exampleSynonyms = {
            "高兴": ["开心", "快乐", "愉快"],
            "漂亮": ["美丽", "好看"],
            "另外": ["此外", "并且", "还有"]
        };
        fs.writeFileSync(synonymsPath, JSON.stringify(exampleSynonyms, null, 2));
        console.log(`Saved skeleton synonyms to ${synonymsPath}`);

        console.log('\n✅ Script Complete. The datasets are ready in public/data/');

    } catch (err) {
        console.error('Error fetching datasets:', err);
    }
};

run();
