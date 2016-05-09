// [TODO] Storage class should be abstracted to a single module
var _ = require('lodash'),
    Db = require('./db');

function Storage(path, maxNum) {
    if (typeof path !== 'string')
        throw new Error('file path must be a string.');

    if ((maxNum !== undefined) && (typeof maxNum !== 'number'))
        throw new Error('maxNum should be a number if given.');

    this._count = 0;
    this._maxNum = maxNum || 65536;
    this._maxIndex = this._maxNum - 1;

    this._box = new Dict();
    this._db = new Db(path);
}

/***********************************************************************/
/*** Public Methods                                                  ***/
/***********************************************************************/
Storage.prototype.isEmpty = function () {
    return this._count === 0;
};

Storage.prototype.has = function (id) {
    return this._box.has(id);
};

Storage.prototype.get = function (id) {
    return this._box.get(id);
};

Storage.prototype.getMaxNum = function () {
    return this._maxNum;
};

Storage.prototype.getCount = function () {
    return this._count;
};

Storage.prototype.filter = function (path, value) {
    var predicator,
        tokens = [],
        finder = {},
        obj = {},
        objPath = obj;

    if (typeof path === 'function') {
        predicator = path;
        return _.filter(this._box.elements, predicator);
    } else {
        tokens = path.split('.');
        tokens.forEach(function (token) {
            obj[token] = {};
            obj = obj[token];
        });

        finder = _.set(objPath, path, value);
        return _.filter(this._box.elements, finder);
    }
};

Storage.prototype.find = function (predicate) {
    return _.find(this._box.elements, predicate);
};

Storage.prototype.exportAllIds = function () {
    return _.map(_.keys(this._box.elements), function (n) {
        return parseInt(n, 10);
    });
};

Storage.prototype.exportAllObjs = function () {
    return _.values(this._box.elements);
};

Storage.prototype.add = function (obj, callback) { 
    var id = obj.dump().id;

    if (id !== null) {
        this._set(id, obj, callback);
    } else {
        id = this._nextId();
        if (!_.isNil(id))
            this.set(id, obj, callback);
        else
            callback(new Error('No room for a new object.'));
    }
}; 

Storage.prototype.set = function (id, obj, callback) {
    if (id > this._maxIndex) {
        callback(new Error('id can not be larger than the maxNum.'));
    } else if (this._count > this._maxIndex) {
        callback(new Error('storage box is already full.'));
    } else if (this.has(id)) {
        callback(new Error('id: ' + id + ' has been used.'));
    } else {
        this._count += 1;
        this._set(id, obj, callback);
    }
}; 

Storage.prototype.remove = function (id, callback) { 
    var obj = this._box.get(id);

    if (!this._box.remove(id)) {
        this._db.removeById(id, function (err) {
            callback(null);
        });
    } else {
        this._db.removeById(id, function (err) {
            if (err) {
                this._box.set(id, obj);
                callback(err);
            } else {
                callback(null);
            }
        });
    }
};  

Storage.prototype.modify = function (id, path, snippet, callback) {
    return this._updateInfo('modify', id, path, snippet, callback);
};

Storage.prototype.replace = function (id, path, value, callback) {
    return this._updateInfo('replace', id, path, value, callback);
};

Storage.prototype.findFromDb = function (query, callback) {
    return this._db.find(query, callback);
};

Storage.prototype.maintain = function (callback) {
    var self = this,
        rmvDocs = [],
        syncDocs = [],
        execAllAsyncFuncs;

    execAllAsyncFuncs = function (funcs, callback) {
        if (funcs.length === 0) {
            callback();
        } else {
            funcs.forEach(function (func) {
                func(callback);
            });
        }
    };

    this._db.findAll(function (err, docs) {
        var rmvCount = 0,
            syncCount = 0,
            rmvErrFlag = false,
            syncErrFlag = false;

        if (err) {
            callback(err);
        } else {
            _.forEach(docs, function (doc) {
                if (!self.has(doc.id)) {
                    rmvDocs.push(function (cb) {
                        self._db.removeById(doc.id, function(err) {
                            rmvCount += 1;
                            
                            if (rmvErrFlag) return;
                            if (err) {
                                cb(err);
                                rmvErrFlag = true;
                            }
                            if (rmvCount === rmvDocs.length) cb(null);
                        });
                    });
                } else {
                    syncDocs.push(function (cb) {
                        self._db.insert(self.get(doc.id).dump(), function(err) {
                            syncCount += 1;

                            if (syncErrFlag) return;
                            if (err) {
                                cb(err);
                                syncErrFlag = true;
                            }
                            if (syncCount === syncDocs.length) cb(null);
                        });
                    });
                }
            });
        }

        execAllAsyncFuncs(rmvDocs, function (err) {
            if (err) {
                callback(err);
            } else {
                execAllAsyncFuncs(syncDocs, callback);
            }
        });
    });
};

/***********************************************************************/
/*** Protected Methods                                               ***/
/***********************************************************************/
Storage.prototype._nextId = function () {
    var newId = this._count,
        accIndex = 0;

    while (this._box.has(newId)) {
        if (accIndex === this._maxIndex) {
            newId = undefined;
            break;
        }
        newId = (newId === this._maxIndex) ? 0 : (newId + 1);
        accIndex += 1;
    }
    return newId;
};

Storage.prototype._updateInfo = function (type, id, path, value, callback) {
    var item = this.get(id);

    if (!item) {
        callback(new Error('No such item of id: ' + id + ' for property ' + type + '.'));
    } else {
        this._db[type](id, path, value, function (err, result) {
            if (err)
                callback(err);
            else
                callback(null, result);
        });
    }
};

Storage.prototype._set = function (id, obj, callback) {
    var self = this,
        storeInfo;

    this._box.set(id, obj);
    storeInfo = obj.dump();
    storeInfo.id = id;

    this._db.insert(storeInfo, function (err) {
        if (err) {
            self._box.remove(id);
            callback(err);
        } else {
            callback(null, id);
        }
    });
};

/*************************************************************************************************/
/*** Private Class: Dictionary                                                                 ***/
/*************************************************************************************************/
function Dict() {
    this.elements = {};
}

Dict.prototype.has = function (key) {
    return this.elements.hasOwnProperty(key);
};

Dict.prototype.get = function (key) {
    return this.has(key) ? this.elements[key] : undefined;
};

Dict.prototype.set = function (key, val) {
    this.elements[key] = val;
    return key;
};

Dict.prototype.remove = function (key) {
    if (this.has(key)) {
        this.elements[key] = null;
        delete this.elements[key];
        return true;
    }
    return false;
};

module.exports = Storage;
