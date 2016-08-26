/* jshint node: true */
'use strict';

var _ = require('busyman');

var zutils = {};

zutils.toHexString = function (val, type) {
    var string,
        niplen = parseInt(type.slice(4)) / 4;

    string = val.toString(16);

    while (string.length !== niplen) {
        string = '0' + string;
    }

    return '0x' + string;
};

zutils.dotPath = function (path) {
    if (typeof path !== 'string')
        throw new TypeError('Input path should be a string.');

    path = path.replace(/\//g, '.');           // tranform slash notation into dot notation

    if (path[0] === '.')                       // if the first char of topic is '.', take it off
        path = path.slice(1);

    if (path[path.length-1] === '.')           // if the last char of topic is '.', take it off
        path = path.slice(0, path.length - 1);

    return path;
};

zutils.buildPathValuePairs = function (rootPath, obj) {
    var result = {};
    rootPath = zutils.dotPath(rootPath);

    if (obj && typeof obj === 'object') {
        if (rootPath !== undefined && rootPath !== '' && rootPath !== '.' && rootPath !== '/')
            rootPath = rootPath + '.';

        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var n = obj[key];

                if (n && typeof n === 'object')
                    result = Object.assign(result, zutils.buildPathValuePairs(rootPath + key, n));
                else
                    result[rootPath + key] = n;
            }
        }
    } else {
        result[rootPath] = obj;
    }

    return result;
};

zutils.objectDiff = function (oldObj, newObj) {
    var pvp = zutils.buildPathValuePairs('/', newObj),
        diff = {};

    _.forEach(pvp, function (val, path) {
        if (!_.has(oldObj, path) || _.get(oldObj, path) !== val)
            _.set(diff, path, val);
    });

    return diff;
};

module.exports = zutils;
