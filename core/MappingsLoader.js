const {Map} = require('core-js/internals/map-helpers');
const readline = require('readline');
const fs = require('fs');

const REGEX = /[\/$]/g;

function readSearge(file, keys, onLoaded) {
    const entries = new Map();
    let column;
    readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    }).on('line', line => {
        const result = line.split(',');
        if (!column) {
            column = {};
            for (const i in result) {
                column[result[i]] = i;
            }
            return;
        }
        if (result.length > 4) {
            result[3] = result.slice(3).join(',');
        }
        const raw = result[column['searge']];
        if (raw) {
            entries.set(raw, {
                name: result[column['name']] ?? '',
                side: result[column['side']] ?? 2,
                desc: result[column['desc']] ?? ''
            });
            keys.add(raw);
        }
    }).on('close', () => {
        onLoaded();
        console.log(`loaded ${file}`);
    });
    return entries;
}

function readParams(file, keys) {
    const entries = new Map();
    let column;
    readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    }).on('line', line => {
        const result = line.split(',', 3);
        if (!column) {
            column = {};
            for (const i in result) {
                column[result[i]] = i;
            }
            return;
        }
        const raw = result[column['param']];
        if (raw) {
            entries.set(raw, {
                name: result[column['name']] ?? '',
                side: result[column['side']] ?? 2
            });
            keys.add(raw);
        }
    }).on('close', () => console.log(`loaded ${file}`));
    return entries;
}

function readMappings(
    file,
    methodMeta,
    fieldMeta,
    onLoaded
) {
    readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
    }).on('line', line => {
        let data, temp, name, info;
        switch (line.substring(0, 2)) {
            case 'FD':
                data = line.split(' ', 3)[2];
                temp = data.lastIndexOf('/');
                name = data.substring(temp + 1);
                temp = data.substring(0, temp).replaceAll(REGEX, '.');//class
                info = fieldMeta.get(name);
                if (info) {
                    info.push(temp);
                } else {
                    fieldMeta.set(name, [temp]);
                }
                return;
            case 'MD':
                data = line.split(' ', 5);
                info = data[3];
                temp = info.lastIndexOf('/');
                name = info.substring(temp + 1) + data[4];//signature
                temp = info.substring(0, temp).replaceAll(REGEX, '.');//class
                info = methodMeta.get(name);
                if (info) {
                    info.push(temp);
                } else {
                    methodMeta.set(name, [temp]);
                }
                return;
        }
    }).on('close', () => {
        onLoaded();
        console.log(`loaded ${file}`);
    });
}

function loadMappings(index, srgs, methods, fields) {
    const mappings = new Map();
    const root = index['root'];
    const versions = index['versions'];
    for (const version of index['mappings']) {
        const folder = root + versions[version];
        const obfuscatedMethod = new Map();
        const obfuscatedField = new Map();
        const methodMeta = new Map();
        const fieldMeta = new Map();
        let unfinished = 3;
        const onLoaded = () => {
            if (!--unfinished) {
                for (const [name, classes] of methodMeta) {
                    const index = name.indexOf('(');
                    const srg = name.substring(0, index);
                    const raw = methodInfo.get(srg);
                    if (raw) {
                        raw['classes'] = classes.sort();
                        const proto = raw.name + name.substring(index);
                        const srgs = obfuscatedMethod.get(proto);
                        if (srgs) {
                            srgs.push(srg);
                        } else {
                            obfuscatedMethod.set(proto, [srg]);
                        }
                        methods.add(proto);
                    }
                }
                for (const [name, classes] of fieldMeta) {
                    const raw = fieldInfo.get(name);
                    if (raw) {
                        raw['classes'] = classes.sort();
                        const srgs = obfuscatedField.get(raw.name);
                        if (srgs) {
                            srgs.push(name);
                        } else {
                            obfuscatedField.set(raw.name, [name]);
                        }
                        fields.add(raw.name);
                    }
                }
            }
        };
        readMappings(folder + '/joined.srg', methodMeta, fieldMeta, onLoaded);
        const methodInfo = readSearge(folder + '/methods.csv', srgs, onLoaded);
        const fieldInfo = readSearge(folder + '/fields.csv', srgs, onLoaded);
        mappings.set(version, {
            methodInfo,
            fieldInfo,
            paramInfo: readParams(folder + '/params.csv', srgs),
            obfuscatedMethod,
            obfuscatedField
        });
    }
    return mappings;
}

module.exports = {
    loadMappings
};