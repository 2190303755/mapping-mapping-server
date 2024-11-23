const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require('fs');

const {loadLang} = require('./core/LangLoader');
const {loadMappings} = require('./core/MappingsLoader');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'vue')));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

function loadIndex(path) {
    const index = JSON.parse(fs.readFileSync(path + "index.json").toString());
    index["root"] = path;
    return index;
}

const keys = new Set();
const srgs = new Set();
const methods = new Set();
const fields = new Set();
const collator = new Intl.Collator('en');
const javaIndex = loadIndex("./data/java/");
const javaLang = loadLang(javaIndex, keys);
const mappings = loadMappings(javaIndex, srgs, methods, fields);


function compareEntry(a, b) {
    return collator.compare(a[0], b[0]);
}

function handleMessage(websocket, message) {
    const query = message.query;
    if (message.id < 0) {
        const mode = message.mode;
        let values;
        switch (mode) {
            case 1:
                values = srgs;
                break;
            case 2:
                values = methods;
                break;
            case 3:
                values = fields;
                break;
            default:
                values = keys;
                break;
        }
        for (const key of values) {
            if (key.includes(query)) {
                websocket.send(JSON.stringify({id: -1, mode: mode, value: key}));
            }
        }
    } else {
        const id = message.id;
        switch (message.mode) {
            case 0:
                for (const [version, data] of javaLang) {
                    const result = [];
                    for (const [locate, entries] of data) {
                        if (entries.has(query)) {
                            result.push([locate.substring(0, locate.length - 5), entries.get(query)]);
                        }
                    }
                    if (result.length) {
                        websocket.send(JSON.stringify({
                            id: id,
                            mode: 0,
                            version: version,
                            entries: result.sort(compareEntry)
                        }));
                    }
                }
                return;
            case 1:
                let type;
                if (query.startsWith('p_')) {
                    type = 'paramInfo';
                } else if (query.startsWith('field_')) {
                    type = 'fieldInfo';
                } else if (query.startsWith('func_')) {
                    type = 'methodInfo';
                } else return;
                for (const [version, data] of mappings) {
                    const map = data[type];
                    if (map.has(query)) {
                        const info = map.get(query);
                        websocket.send(JSON.stringify({
                            id: id,
                            mode: 1,
                            name: info.name,
                            desc: info.desc,
                            side: info.side,
                            version: version
                        }));
                    }
                }
                return;
            case 2:
                for (const [version, data] of mappings) {
                    const map = data.obfuscatedMethod;
                    if (map.has(query)) {
                        for (const srg of map.get(query)) {
                            const info = data.methodInfo.get(srg);
                            websocket.send(JSON.stringify({
                                id: id,
                                mode: 2,
                                name: srg,
                                desc: info.desc,
                                side: info.side,
                                classes: info.classes,
                                version: version,
                            }));
                        }
                    }
                }
                return;
            case 3:
                for (const [version, data] of mappings) {
                    const map = data.obfuscatedField;
                    if (map.has(query)) {
                        for (const srg of map.get(query)) {
                            const info = data.fieldInfo.get(srg);
                            websocket.send(JSON.stringify({
                                id: id,
                                mode: 3,
                                name: srg,
                                desc: info.desc,
                                side: info.side,
                                classes: info.classes,
                                version: version,
                            }));
                        }
                    }
                }
                return;
        }
    }
}


module.exports = {
    app,
    handleMessage
};
