// controller

/*************************************************************************************************/
/*** Public ZigBee Utility APIs                                                                ***/
/*************************************************************************************************/
Controller.prototype.sendAfDataWithLocalEp = function (localEp, dstEp, cId, rawData, opt, callback) {
    var afParams;

    if (typeof opt === 'function') {
        callback = opt;
        opt = undefined;
    }

    opt = opt || {};

    if (!localEp) {
        callback(new Error('Local endpoint should be given.'));
    } else {
        afParams = this._generateAfParams(localEp, dstEp, cId, rawData, opt);

        this.afRequest('dataRequest', afParams, function (err, result) {
            if (err)
                callback(err);
            else if (result.status !== 0)   // unsuccessful
                callback(new Error('AfDataRequest failed. '));
            else
                callback(err, result);
        });
    }

    return this;
};

Controller.prototype.sendAfData = function (dstEp, cId, rawData, opt, callback) {
    var profId = dstEp.getProfId(),
        delegateEp = this.findDelegator(profId);

    if (!delegateEp)
        callback(new Error('Profile: ' + profId + ' is not supported at this moment.'));
    else
        this.sendAfDataWithLocalEp(delegateEp, dstEp, cId, rawData, opt, callback);

    return this;
};

Controller.prototype.broadcastAfDataWithLocalEp = function (localEp, addrMode, dstAddr, clusterId, rawData, opt, callback) {
    // (localEp, addrMode, dstAddr, clusterId, rawData, opt)
    var afParams = this._generateBroadcastAfParams(localEp, addrMode, dstAddr, clusterId, rawData, opt);

    this.afRequest('dataRequestExt', afParams, function (err, result) {
        if (err)
            callback(err);
        else if (result.status !== 0)   // not success
            callback(new Error('AfDataRequestExt failed. '));
        else
            callback(null, result);     // Broadcast (or Groupcast) has no AREQ confirm back, just resolve this transaction.
    });
};

Controller.prototype.groupcastAfData = function (localEp, groupId, clusterId, rawData, opt, callback) {
    // [TODO] Do we need local EP? or profile
    // ADDR_GROUP = 0x01
    return this.broadcastAfDataWithLocalEp(localEp, ZDEF.AF.ADDRESS_MODE.ADDR_GROUP, groupId, clusterId, rawData, opt, callback);
};

Controller.prototype.broadcastAfData = function (localEp, clusterId, rawData, opt, callback) {
    // [TODO] Do we need local EP? or profile
    // ADDR_BROADCAST = 0xFF
    return this.broadcastAfDataWithLocalEp(localEp, ZDEF.AF.ADDRESS_MODE.ADDR_BROADCAST, 0xFFFF, clusterId, rawData, opt, callback);
};

Controller.prototype.sendZclData = function (dstEp, cId, rawData, opt, callback) {};
Controller.prototype.groupcastZclData = function (dstEp, cId, cmdId, zclObj, callback) {};
Controller.prototype.broadcastZclData = function (dstEp, cId, cmdId, zclObj, callback) {};

/*************************************************************************************************/
/*** Protected Methods                                                                         ***/
/*************************************************************************************************/


Controller.prototype._registerAreqTimeout = function (evtKey) {
    var self = this,
        timeout;

    timeout = setTimeout(function () {
        self._invokeAreqCallback(evtKey, new Error('timeout'), null);
    }, AREQ_TIMEOUT * 1000);

    this._areqTimeouts[evtKey] = this._areqTimeouts[evtKey] || [];
    this._areqTimeouts[evtKey].push(timeout);
};

Controller.prototype._clearAreqTimeout = function (evtKey) {
    var timeouts = this._areqTimeouts[evtKey],
        timeout;

    if (!timeouts || (timeouts.length === 0))
        return;

    timeout = timeouts.shift();

    if (timeout)
        clearTimeout(timeout);

    if (timeouts.length === 0) {
        this._areqTimeouts[evtKey] = null;
        delete this._areqTimeouts[evtKey];
    }
};

Controller.prototype._registerAreqCallback = function (evtKey, cb) {
    // for those requests requiring AREQ coming back, should regitser its callback to controller

    this._areqCallbacks[evtKey] = this._areqCallbacks[evtKey] || [];
    this._areqCallbacks[evtKey].push(cb);
    this._registerAreqTimeout(evtKey);
};

Controller.prototype._invokeAreqCallback = function (evtKey, err, rsp) {
    var cbs = this._areqCallbacks[evtKey],
        cb;

    this._clearAreqTimeout(evtKey);

    if (!cbs || (cbs.length === 0))
        return;

    cb = cbs.shift();

    if (cbs.length === 0) {
        this._areqCallbacks[evtKey] = null;
        delete this._areqCallbacks[evtKey];
    }

    if (cb)
        cb(err, rsp);
};


/*************************************************************************************************/
/*** Mandatory Public APIs                                                                     ***/
/*************************************************************************************************/
Controller.prototype.coordInfoReq = function (callback) {};
Controller.prototype.devInfoReq = function (callback) {};
Controller.prototype.epInfoReq = function (callback) {};
Controller.prototype.clusterInfoReq = function (callback) {};
Controller.prototype.attrInfoReq = function (callback) {};

Controller.prototype.setNwkInfo = function (key, val) {
    var set = true;

    if (this._net.hasOwnProperty[key])
        this._net.hasOwnProperty[key] = val;
    else
        set = false;

    return set;
};

Controller.prototype.getNwkInfo = function (callback) {
    return _.cloneDeep(this._net);
};

// Controller.prototype.setPermitJoinTime = function (argInst, callback) {};
// Controller.prototype.getPermitJoinTime = function (callback) {};
// Controller.prototype.joinTimeCountdown = function (callback) {};

/*************************************************************************************************/
/*** Network Management Public APIs                                                            ***/
/*************************************************************************************************/
Controller.prototype.sleep = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};

Controller.prototype.wakeup = function (callback) {
     // <No_rsp_cmd>, <specific_conf>
};



Controller.prototype.queryDevFullInfo = function (ieeeAddr, nwkAddr, callback) {
    var self = this,
        devFullInfo,
        epRspCount = 0,
        epRspCountUp,
        epQueries = [],
        epQueriesChecker,
        notActiveEpEvent = 'ZDO:stateChangeInd:' + nwkAddr + ':NOT_ACTIVE',
        fakeSimpDescEventHead = 'ZDO:simpleDescRsp:' + nwkAddr + ':';

    epRspCountUp = function () {
        epRspCount += 1;
    };

    epQueriesChecker = setInterval(function () {
        if (epRspCount < devInfo.epList.length)
            return;

        epQueries.forEach(function (qry, idx) {
            var epId = devInfo.epList[idx];
            if (Q.isPromise(qry) && qry.isPending())               // use profileid= 0xFFFF to notify that this ep is not active!
                self.emit(fakeSimpDescEventHead + epId, { endpoint: epId, profileid: 0xFFFF }); // emit a fake and empty endpoint
        });

        clearInterval(epQueriesChecker);
        epQueriesChecker = null;
    }, 1000);

    self.on(notActiveEpEvent, epRspCountUp);

    return this.queryDevInfo(ieeeAddr, nwkAddr).then(function (devInfo) {
        devFullInfo = devInfo;

        devInfo.epList.forEach(function (epId) {
            var epQuery = self.queryEpInfo(nwkAddr, epId).then(function (epInfo) {
                epRspCount += 1;
                return epInfo;
            });
            epQueries.push(self.queryEpInfo(nwkAddr, epId));
        });

        return Q.all(epQueries);
    }).then(function (epInfos) {
        epRspCount = 0;
        self.removeListener(notActiveEpEvent, epRspCountUp);
        devFullInfo.endpoints = epInfos;

        return devFullInfo;
    });
};

Nwkmgr.prototype.displayNwkInfo = function () {
    var nwkInfo = this.getNwkInfo();    // { state, channel, panId, extPanId, ieeeAddr, nwkAddr }

    console.log(' ');
    console.log('>> Network Information:');
    console.log(' : State: ' + nwkInfo.state);
    console.log(' : Channel: ' + nwkInfo.channel);
    console.log(' : PanID: ' + nwkInfo.panId);
    console.log(' : Network Addr: ' + nwkInfo.nwkAddr);
    console.log(' : IEEE Addr: ' + nwkInfo.ieeeAddr);
    console.log(' : Extended PanID: ' + nwkInfo.extPanId);
    console.log(' ');

    return nwkInfo;
};





Controller.prototype.getKey = function (args, callback) {

};

Controller.prototype.getKey = function (args, callback) {

};

Controller.prototype.queryDev = function (addrObj, callback) {
    // [TODO] not remote, not query

    // var deferred = Q.defer(),
    //     devInfo,
    //     i;

    // var getDevInfo = function (ieeeAddr) {
    //     zdb.getInfo('device', ieeeAddr, function (err, foundDev) {
    //         if (err) {
    //             deferred.reject(err);
    //         }
    //         devInfo = foundDev;

    //         if (foundDev) {
    //             zdb.getInfo('endpoint', ieeeAddr, function (err, foundEps) {
    //                 if (err) {
    //                     deferred.reject(err);
    //                 }                    
    //                 devInfo.epInfoList = foundEps;
    //                 // TODO : get cluster List
    //                 for (i = 0; i < devInfo.numEndpoints; i += 1) {
    //                     zdb.getInfo('cluster', ieeeAddr, foundEps[i].endpointId, 'in', function (err, foundClsts) {
    //                         devInfo.epInfoList[i].ipClusterInfoList = foundClsts;
    //                     }
    //                     zdb.getInfo('cluster', ieeeAddr, foundEps[i].endpointId, 'out', function (err, foundClsts) {
    //                         devInfo.epInfoList[i].outClusterInfoList = foundClsts;
    //                     }
    //                 }
    //                 deferred.resolve(devInfo);
    //             });                
    //         }
    //     });    
    // };

    // if (addrObj.ieeeAddr) {
    //     getDevInfo(addrObj.ieeeAddr);
    // } else if (addrObj.nwkAddr) {
    //     zdb.find({ nwkAddr: devDbId,  owner: null }, null, null, null, function (err, foundDev) {
    //         getDevInfo(foundDev.ieeeAddr);
    //     });
    // }
    // return deferred.promise.nodeify(callback);
};



Controller.prototype.devListMaintain = function (args, callback) {
    // var deferred = Q.defer(),
    //     nwkSelf = this,
    //     ieeeAddr = addrObj.ieeeAddr,
    //     nwkAddr,
    //     epInfoList = [],
    //     i,
    //     type,
    //     devInfoRet,
    //     devMatched = false;
     
    // zdb.getInfo('device', ieeeAddr).then(function (foundDev) {
    //     if (foundDev) {
    //         nwkAddr = foundDev.nwkAddr;
    //         msghub.callSysmgr('retrieveDevInfo', { ieeeaddr: ieeeAddr, nwkaddr: nwkAddr }).then(function (deviceInfo) {
    //             epInfoList  = deviceInfo.epInfoList;
    //             devInfoRet = _und.omit(deviceInfo, 'epInfoList');
    //             delete deviceInfo.epInfoList;
    //             devMatched = _und.isEqual(devInfoRet, foundDev);

    //             // TODO : deep comparison for endpoints
    //             if (!devMatched) {
    //                 type = 'DEV_UPDATE';
    //                 zdb.modSert('device', deviceInfo.ieeeAddr, deviceInfo).then(function (result) {
    //                     for (i = 0; i < deviceInfo.numEndpoints; i += 1) {
    //                         zdb.modSert('endpoint', deviceInfo.ieeeAddr, epInfoList[i]).then(function (result) {
    //                             if (i === deviceInfo.numEndpoints -1) {
    //                                 deferred.resolve(deviceInfo);
    //                                 msghub.emit('ZB_NWK_ZIGBEE_DEVICE_IND', { indType: type, info: deviceInfo });
    //                             }
    //                         }, function (err) {
    //                             deferred.reject(err);
    //                         });
    //                     }
    //                 }, function (err) {
    //                     deferred.reject(err);
    //                 });
    //             } else {
    //                 callback(null, "No need to update.");
    //             }
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     }
    // }, function (err) {
    //     deferred.reject(err);
    // });

    // return deferred.promise.nodeify(callback);
};

Controller.prototype.removeDevice = function (args, callback) {
    // 'dstaddr', 'deviceaddress', 'removechildren_rejoin'
    // var deferred = Q.defer(),
    //     rmvDevMsg = {},
    //     dstaddr = argInst.dstaddr || 0,         // if short addr not given, assign to coord.
    //     deviceaddress = argInst.deviceaddress,
    //     removechildren_rejoin = 0;
    // // find the device from database to retrieve its short addr.
    // // FIXME : when nwkaddr changed by directly switch off power onbaord and then turn it on again. problems occur. can't remove that device.
    // zdb.getInfo('device', deviceaddress).then(function (foundDev) {
    //     if (foundDev) {
    //         dstaddr = foundDev.nwkAddr;
    //     }
    //     zdo.mgmtLeaveReq({ dstaddr: dstaddr, deviceaddress: deviceaddress, removechildren_rejoin: removechildren_rejoin }).then(function (msg) {
    //         rmvDevMsg.seqNum = 'TODO';
    //         rmvDevMsg.srcaddress = zutil.convToHexString(msg.srcaddr, 'uint16'); //responder's address
    //         rmvDevMsg.status = msg.status.key;
    //         deferred.resolve(rmvDevMsg);
    //     }, function (err) {
    //         deferred.reject(err);
    //     });
    // }, function (err) {
    //     deferred.reject(err);
    // });
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.setBindingEntry = function (remoteEp, localEp, cId, callback) {
    // SourceAddress{object} (U, E), ClusterID{uint16}, DestAddress{object} (U, E), BindingMode{uint8} (0: bind, 1: unbind)
    // 'dstaddr', 'srcaddr', 'srcendpoint', 'clusterid', 'dstaddrmode', 'addr_short_long'
    // var deferred = Q.defer(),
    //     bindMsg = {},
    //     dstaddr = argInst.dstaddr,
    //     srcaddr = argInst.srcaddr,
    //     srcendpoint = argInst.srcendpoint,
    //     clusterid = argInst.clusterid,
    //     dstaddrmode = argInst.dstaddrmode,
    //     addr_short_long = argInst.addr_short_long,
    //     dstendpoint = argInst.dstendpoint,
    //     bindingmode = argInst.bindingmode;

    // checkDstAddrMode(dstaddrmode, addr_short_long).then(function (addrInfo) {

    //     if (bindingmode === 0 ) {
    //         zdo.bindReq({ dstaddr: dstaddr, srcaddr: srcaddr, srcendpoint: srcendpoint, clusterid: clusterid, dstaddrmode: addrInfo.dstAddrMode, addr_short_long: addrInfo.dstAddr, dstendpoint: dstendpoint })
    //         .then(function (msg) {
    //             bindMsg.srcaddress = msg.srcaddr;
    //             bindMsg.status = msg.status,
    //             deferred.resolve(bindMsg);
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     } else if (bindingmode === 1 ) {
    //         // 'dstaddr', 'srcaddr', 'srcendpoint', 'clusterid', 'dstaddrmode', 'addr_short_long'
    //         zdo.unbindReq({ dstaddr: dstaddr, srcaddr: srcaddr, srcendpoint: srcendpoint, clusterid: clusterid, dstaddrmode: addrInfo.dstAddrMode, addr_short_long: addrInfo.dstAddr, dstendpoint: dstendpoint })
    //         .then(function (msg) {
    //             bindMsg.srcaddress = msg.srcaddr;
    //             bindMsg.status = msg.status,
    //             deferred.resolve(bindMsg);
    //         }, function (err) {
    //             deferred.reject(err);
    //         });
    //     }else {
    //         deferred.reject(new Error('Not a valid bindingMode.'));
    //     }

    // }); 
    // return deferred.promise.nodeify(callback);
};

Controller.prototype.setDevPermitJoin = function (args, callback) {

};
// mtoRouteStart() // TODO
// mtoRouteStop()  // TODO

Controller.prototype.changeKey = function (shortAddr, ieeeAddr, linkKey, callback) {
    return this.request('ZDO', 'setLinkKey', { shortaddr: shortAddr, ieeeaddr: ieeeAddr, linkkey: linkKey }, callback);
};

Controller.prototype.getKey = function (ieeeAddr, callback) {
    return this.request('ZDO', 'getLinkKey', { ieeeaddr: ieeeAddr }, callback);
};


Controller.prototype.checkOnline = function (ieeeAddr, callback) {
    var self = this,
        devInfo = {
            status: 'offline',  // { type, ieeeAddr, nwkAddr, manufId, epList }
            nwkAddr: dev.nwkAddr,   // [TOOD] where is dev
        };

    // FIXME: At this time, 5000 ms timeout is a magic number. Do we need to use retry?
    this.queryNwkAddr(ieeeAddr).then(function (nwkAddr) {
        return self.request('ZDO', 'nodeDescReq', {
            dstaddr: nwkAddr,
            nwkaddrofinterest: nwkAddr
        }).timeout(5000);
    }).then(function (nodeRsp) {
        devInfo.status = 'online';
        devInfo.nwkAddr = nodeRsp.srcaddr;
        dev.update(devInfo);

        self.emit('ZDO:END_DEVICE_ANNCE_IND', {
            srcaddr: devInfo.nwkAddr,
            nwkaddr: devInfo.nwkAddr,
            ieeeaddr: devInfo.ieeeAddr,
            capabilities: 14            // 'DEVICETYPE_FFD | POWER_AC | RCVR_ON_IDLE', value: 14
        });
    });
};

Controller.prototype.bindRemoteToLocalEndpoint = function (remoteEp, localEp, cId, callback) {
    var coord = this.getCoord(),
        bindValObj = {
            dstaddr: 0,
            srcaddr: coord.getIeeeAddr(),
            srcendpoint: localEp.getEpId(),
            clusterid: cId,
            dstaddrmode: ZDEF.AF.ADDRESS_MODE.ADDR_64BIT,   // 3
            addr_short_long: remoteEp.getIeeeAddr(),
            dstendpoint: remoteEp.getEpId(),            // no use when binding upon nwkAddr
            bindingmode: 0      // 0: bind, 1: unbind
        };


    doBinding = function () {
        msghub.callNwkmgr('setBindingEntry', bindArg).then(function (bindMsg) {
            deferred.resolve(bindMsg);
        }, function (err) {
            deferred.reject(err);
        });
    };

    if (!localEp.isLocal()) {
        // reject
    }

    if (remoteEp.getProfId() !== localEp.getProfId()) {
        // reject
    }

    if (!localEp.hasOutCluster(cId)) {  // opClusterList
        // not found, re-register the localEp to coord

        if (localEp.isDelegator()) {    // if localEp is a delegator, re-register it to zbCoord
            localEp.info.opClusterList.push(cId);
            localEp.info.numOpClusters += 1;
            coordSelf.reRegisterEndpoint(localEp).then(function (result) {
                doBinding();
            }).fail(function (err) {
                deferred.reject(err);
            }).done();
        } else {
            // reject, application should prepare that cluster for binding, developer is responsible for this
        }

    }

    var coordSelf = this,
        deferred = Q.defer(),
        doBinding,
        cIdIndexFound,



    // Check if zbEp and localEp have the same profile
    if (zbEp.info.profileId !== localEp.info.profileId) {
        deferred.reject(new Error('Cannot bind endpoints with different profile.'));
    } else {
        // Check if localEp has the target cluster
        cIdIndexFound = zutil.zbFindIndex(localEp.info.opClusterList, null, cId);
        if (cIdIndexFound === -1) { // not found, re-register the localEp to zbCoord
            if (localEp.isDelegator) {  // if localEp is a delegator, re-register it to zbCoord
                localEp.info.opClusterList.push(cId);
                localEp.info.numOpClusters += 1;
                coordSelf.reRegisterEndpoint(localEp).then(function (result) {
                    doBinding();
                }).fail(function (err) {
                    deferred.reject(err);
                }).done();   
            } else {    // if localEp is an application endpoint, reject to tell user to prepare right cluster for binding
                deferred.reject(new Error('No such cluster to bind to.'));
            }
        } else {
            doBinding();
        }
    }
    return deferred.promise.nodeify(callback);
};

/*************************************************************************************************/
/*** Private Functions                                                                         ***/
/*************************************************************************************************/
Controller.prototype._generateAfParams = function (localEp, dstEp, cId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.ACK_REQUEST | ZDEF.AF.OPTIONS.DISCV_ROUTE;    // ACK_REQUEST (0x10), DISCV_ROUTE (0x20)
    opt = opt || {};

    return {
        dstaddr: dstEp.getNwkAddr(),
        destendpoint: dstEp.getEpId(),
        srcendpoint: localEp.getEpId(),
        clusterid: cId,
        transid: this.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};

Controller.prototype._generateBroadcastAfParams = function (localEp, addrMode, dstAddr, clusterId, rawData, opt) {
    var afOptions = ZDEF.AF.OPTIONS.DISCV_ROUTE;
    opt = opt || {};

    // [TODO] check dstAddr -> destAddr -> should be long addr '0x123456'

    return  {
        dstaddrmode: addrMode,
        dstaddr: destAddr,
        destendpoint: 0xFF,
        dstpanid: 0,
        srcendpoint: localEp.getEpId(),
        clusterid: clusterId,
        transid: this.nextTransId(),
        options: opt.options || afOptions,
        radius: opt.radius || ZDEF.AF_DEFAULT_RADIUS,
        len: rawData.length,
        data: rawData
    };
};


// .frame(frameCntl, manufCode, seqNum, cmd, zclPayload)
Controller.prototype.zclRead = function (dstEp, cId, attrIds, callback) {
    // build a ZCL raw buffer
    var dev = dstEp.getDev();

    if (!dev)
        return callback(new Error('device not found.'));

    var manufId = dev.getManufId();
    var seqNum = this.nextSeqNum();
    var zclPayload = attrIds.map(function (aId) {
        return { attrId: aId };
    });

    var zclBuf = zclFoundation.frame({ manufSpec: 0, direction: 0, disDefaultRsp: 0 }, manufId, seqNum, 'read', zclPayload);
};

Controller.prototype.zclWrite = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteUndiv = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteNoRsp = function (dstEp, cId, recs) {};
Controller.prototype.zclConfigReport = function (dstEp, cId, recs) {};
Controller.prototype.zclReadReportConfig = function (dstEp, cId, recs) {};
Controller.prototype.zclReadStruct = function (dstEp, cId, recs) {};
Controller.prototype.zclReport = function (dstEp, cId, recs) {};
Controller.prototype.zclWriteStrcut = function (dstEp, cId, recs) {};
Controller.prototype.zclDiscover = function (dstEp, cId, startIndex, maxNum) {};
Controller.prototype.zclCmd = function (dstEp, cId, startIndex, maxNum) {};


/*************************************************************************************************/
/*** Coordinator and Delegators Initialization [TODO] make private                             ***/
/*************************************************************************************************/


Controller.prototype._recoverFromDataBase = function () {
    // should load at shepherd level
};

Controller.prototype._checkOnlineOfAll = function () {
    // should check online at shepherd level
    // if (!appload) then check
};



