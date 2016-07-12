/* jshint node: true */
'use strict';

var _ = require('busyman'),
    Device = require('./model/device'),
    Endpoint = require('./model/device'),
    Coordpoint = require('./model/device');

var loader = {};

/*************************************************************************************************/
/*** Reload Methods                                                                            ***/
/*************************************************************************************************/
loader.reloadSingleDev = function (shepherd, devRec, callback) {
    var dev = shepherd.findDevById(devRec.id),
        recoveredDev;

    callback = callback || function (err) { console.log(err); };

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
        var recoveredEp = new Endpoint(recoveredDev, { profId:epRec.profId,
                                                       epId:epRec.epId,
                                                       devId:epRec.devId,
                                                       inClusterList:epRec.inClusterList,
                                                       outClusterList:epRec.outClusterList });
        recoveredEp.clusters = epRec.clusters;
        recoveredDev.endpoints[epId] = recoveredEp;
    });

    recoveredDev.recoverFromRecord(devRec);
    shepherd.registerDev(recoveredDev, callback);    // return (err, id)
};

loader.reloadCoordDev = function (shepherd, devRec, callback) {
    var coord = shepherd.controller._coord;

    callback = callback || function (err) { console.log(err); };

    _.forEach(devRec.endpoints, function (epRec, epId) {
        if (epId < 7) {    // delegator
            var delEp = coord.getEndpoint(epId);

            delEp.update({ profId:epRec.profId,
                           epId:epRec.epId,
                           devId:epRec.devId,
                           inClusterList:epRec.inClusterList,
                           outClusterList:epRec.outClusterList });

            shepherd.controller.reRegisterEp(delEp, function (err) {
                if (!err) {

                }
            });
        } else {           // local app
            var recoveredEp = new Coordpoint(coord, { profId:epRec.profId,
                                                     epId:epRec.epId,
                                                     devId:epRec.devId,
                                                     inClusterList:epRec.inClusterList,
                                                     outClusterList:epRec.outClusterList });
            recoveredEp.clusters = epRec.clusters;
            coord.endpoints[epId] = recoveredEp;

            shepherd.controller.registerEp(recoveredEp, function (err) {
                if (!err) {

                }
            });
        }
    });

    coord.recoverFromRecord(devRec);
    shepherd.registerDev(coord, callback); // return (err, id)
};

loader.reloadDevs = function (shepherd, callback) {
    var total = 0,
        recoveredIds = [];

    callback = callback || function (err) { console.log(err); };

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
                        loader.reloadCoordDev(shepherd, devRec, function (err, id) {
                            if (err)
                                recoveredIds.push(null);
                            else
                                recoveredIds.push(id);

                            total -= 1;
                        });
                    } else {
                        loader.reloadSingleDev(shepherd, devRec, function (err, id) {
                            if (err)
                                recoveredIds.push(null);
                            else
                                recoveredIds.push(id);

                            total -= 1;
                        });
                    }

                    if (total === 0)    // all done
                        callback(null, recoveredIds);
                });
            }
        }
    });
};

loader.reload = function (shepherd, callback) {
    var loadedDevIds;

    loader.reloadDevs(shepherd, function (err, devIds) {
        loadedDevIds = devIds;

        if (err) {
            loader.unloadDevs(shepherd, loadedDevIds, function () {
                callback(err);
            });
        } else {
            loader.sync(shepherd, function () {
                callback(null);    // whether sync or not, return success
            });
        }
    });
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
                if (!shepherd.findDevById(d.id))
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
