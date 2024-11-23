const {Map} = require('core-js/internals/map-helpers');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

function readLang(loc, file, map, keys) {
    const entries = new Map();
    map.set(loc, entries);
    readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    }).on('line', line => {
        let comment = line.indexOf("#");
        const separator = line.indexOf("=");
        if (separator !== -1) {
            if (comment === -1) {
                comment = line.length;
            }
            if (comment > separator) {
                const key = line.substring(0, separator);
                keys.add(key);
                entries.set(key, line.substring(separator + 1, comment));
            }
        }
    }).on('close', () => console.log(`loaded ${file}`));
}

function readJson(loc, file, map, keys) {
    fs.readFile(file, (err, buf) => {
        if (err) throw err;
        const entries = new Map(Object.entries(JSON.parse(buf.toString())));
        map.set(loc, entries);
        entries.keys().forEach(key => keys.add(key));
        console.log(`loaded ${file}`);
    });
}

function loadLang(index, keys) {
    const lang = new Map();
    const root = index['root'];
    const versions = index['versions'];
    for (const version in versions) {
        const folder = root + versions[version];
        const data = new Map();
        lang.set(version, data);
        fs.readdir(folder, (err, files) => {
            if (err) throw err;
            files.forEach(name => {
                const file = path.join(folder, name);
                fs.stat(file, (error, stat) => {
                    if (error) throw error;
                    if (stat.isFile()) {
                        if (name.endsWith(".json")) {
                            readJson(name, file, data, keys);
                        } else if (name.endsWith(".lang")) {
                            readLang(name, file, data, keys);
                        }
                    }
                });
            });
        });
    }
    return lang;
}

module.exports = {
    loadLang
};
