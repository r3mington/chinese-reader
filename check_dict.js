
import https from 'https';

const url = 'https://raw.githubusercontent.com/krmanik/cedict-json/master/all_cedict.json';

console.log('Fetching dictionary...');

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            console.log('Dictionary downloaded. Parsing...');
            const dict = JSON.parse(data);

            // Search for "走"
            const entries = [];
            // dict is an array of objects based on the file content usually, or object.
            // dictionary.js says: "Data format expected: Object where keys are traditional/simplified or simplified." or Array.
            // Let's inspect structure.

            // If it's an array
            if (Array.isArray(dict)) {
                dict.forEach(entry => {
                    if (entry.simplified === '走' || entry.traditional === '走') {
                        entries.push(entry);
                    }
                });
            } else {
                // assume object map
                // The code in dictionary.js handles both.
                // Let's check keys if it's an object
                Object.values(dict).forEach(entry => {
                    if (entry.simplified === '走' || entry.traditional === '走') {
                        entries.push(entry);
                    }
                });
            }

            console.log('Entries for 走:', JSON.stringify(entries, null, 2));

        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching dictionary:', err.message);
});
