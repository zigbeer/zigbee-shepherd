/* jshint node: true */
'use strict';

var Q = require('q'),
    Ziee = require('ziee'),
    _ = require('busyman');

var Device = require('../model/device'),
    Endpoint = require('../model/endpoint');

var loader = {};

/*************************************************************************************************/
/*** Reload Methods                                                                            ***/
/*************************************************************************************************/
loader.reloadSingleDev = function (shepherd, devRec, callback) {
    var dev = shepherd._findDevById(devRec.id),
        recoveredDev;

    if (dev) {
        if (isSameDevice(dev, devRec))      // same dev exists, do not reload
            return callback(null, null);
        else                                // give new id to devRec
            devRec.id = null;
    }

    recoveredDev = new Device({ type: devRec.type,
                                ieeeAddr: devRec.ieeeAddr,
                                nwkAddr: devRec.nwkAddr,
                                manufId: devRec.manufId,
                                epList: devRec.epList });

    _.forEach(devRec.endpoints, function (epRec, epId) {
        var ziee = new Ziee(),
            recoveredEp = new Endpoint(recoveredDev, { profId:epRec.profId,
                                                       epId:epRec.epId,
                                                       devId:epRec.devId,
                                                       inClusterList:epRec.inClusterList,
                                                       outClusterList:epRec.outClusterList });

        _.forEach(epRec.clusters, function (cInfo, cid) {
            ziee.init(cid, 'dir', cInfo.dir);
            ziee.init(cid, 'attrs', cInfo.attrs, false);
        });

        recoveredEp.clusters = ziee;
        recoveredDev.endpoints[epId] = recoveredEp;
        shepherd._attachZclMethods(recoveredEp);
    });

    recoveredDev.recoverFromRecord(devRec);
    shepherd._registerDev(recoveredDev, callback);    // return (err, id)
};

loader.reloadDevs = function (shepherd, callback) {
    var total = 0,
        recoveredIds = [];

    shepherd._devbox.findFromDb({}, function (err, devRecs) {    // find all devRecs
        if (err) {
            callback(err);
        } else {
            total = devRecs.length;

            if (total === 0) {
                callback(null, recoveredIds);
            } else {
                devRecs.forEach(function (devRec) {
                    if (devRec.nwkAddr === 0) {    // coordinator
                        total -= 1;
                        if (total === 0)    // all done
                            callback(null, recoveredIds);
                    } else {
                        loader.reloadSingleDev(shepherd, devRec, function (err, id) {
                            if (err)
                                recoveredIds.push(null);
                            else
                                recoveredIds.push(id);

                            total -= 1;
                            if (total === 0)    // all done
                                callback(null, recoveredIds);
                        });
                    }
                });
            }
        }
    });
};

loader.reload = function (shepherd, callback) {
    var deferred = Q.defer(),
        loadedDevIds;

    loader.reloadDevs(shepherd, function (err, devIds) {
        loadedDevIds = devIds;

        if (err) {
            loader.unloadDevs(shepherd, loadedDevIds, function () {
                deferred.reject(err);
            });
        } else {
            loader.sync(shepherd, function () {
                deferred.resolve();    // whether sync or not, return success
            });
        }
    });

    return deferred.promise.nodeify(callback);
};

loader.sync = function (shepherd, callback) {
    loader._syncDevs(shepherd, function (err) {
        callback(err);
    });
};

/*************************************************************************************************/
/*** Unload Methods                                                                            ***/
/*************************************************************************************************/
loader.unloadDevs = function (shepherd, devIds, callback) {
    devIds.forEach(function (id) {
        if (id !== null && id !== undefined)
            shepherd._devbox.removeElement(id);
    });

    callback(null);
};

/*************************************************************************************************/
/*** Private Methods                                                                           ***/
/*************************************************************************************************/
loader._syncDevs = function (shepherd, callback) {
    var devIdsNotInBox = [],
        ops = 0;

    shepherd._devbox.findFromDb({}, function (err, devRecs) {
        ops = devRecs.length;

        if (err) {
            callback(err);
        } else {
            devRecs.forEach(function (d) {
                if (!shepherd._findDevById(d.id))
                    devIdsNotInBox.push(d.id);
            });

            if (devIdsNotInBox.length) {
                devIdsNotInBox.forEach(function (devId) {
                    process.nextTick(function () {
                        shepherd._devbox.remove(devId, function () {
                            ops -= 1;
                            if (ops === 0)
                                callback(null);
                        });
                    });
                });
            } else {
                callback(null);
            }
        }
    });
};

function isSameDevice(dev, devRec) {
    var sameAddr = false;

    if (dev.getIeeeAddr() === devRec.ieeeAddr)
        sameAddr = true;

    return sameAddr;
}

module.exports = loader;
