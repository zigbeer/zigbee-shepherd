var bridge = {

};

var zdoReqRspMap = {
    nwkAddrReq:         { ind: 'nwkAddrRsp',        apiType: 'concat',  suffix: [ 'ieeeaddr', 'startindex' ]          },
    ieeeAddrReq:        { ind: 'ieeeAddrRsp',       apiType: 'concat',  suffix: [ 'shortaddr', 'startindex' ]         },
    nodeDescReq:        { ind: 'nodeDescRsp',       apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    powerDescReq:       { ind: 'powerDescRsp',      apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    simpleDescReq:      { ind: 'simpleDescRsp',     apiType: 'generic', suffix: [ 'nwkaddrofinterest', 'endpoint' ]   },
    activeEpReq:        { ind: 'activeEpRsp',       apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    matchDescReq:       { ind: 'matchDescRsp',      apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    complexDescReq:     { ind: 'complexDescRsp',    apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    userDescReq:        { ind: 'userDescRsp',       apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    userDescSet:        { ind: 'userDescConf',      apiType: 'generic', suffix: [ 'nwkaddrofinterest' ]               },
    serverDiscReq:      { ind: 'serverDiscRsp',     apiType: 'special', suffix: []                                    },  // ???? tags
    endDeviceBindReq:   { ind: 'endDeviceBindRsp',  apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    bindReq:            { ind: 'bindRsp',           apiType: 'special', suffix: []                                    },  // ???? tags
    unbindReq:          { ind: 'unbindRsp',         apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    nwkDiscoveryReq:    { ind: 'nwkDiscoveryCnf',   apiType: 'generic', suffix: []                                    },
    joinReq:            { ind: 'joinCnf',           apiType: 'generic', suffix: []                                    },
    mgmtNwkDiscReq:     { ind: 'mgmtNwkDiscRsp',    apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtLqiReq:         { ind: 'mgmtLqiRsp',        apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtRtgReq:         { ind: 'mgmtRtgRsp',        apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtBindReq:        { ind: 'mgmtBindRsp',       apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtLeaveReq:       { ind: 'mgmtLeaveRsp',      apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    mgmtDirectJoinReq:  { ind: 'mgmtDirectJoinRsp', apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    mgmtPermitJoinReq:  { ind: 'mgmtPermitJoinRsp', apiType: 'special', suffix: [ 'dstaddr' ]                         }
};

var indEventSuffix = {
    SYS: null,
    MAC: null,
    AF: {
        dataConfirm: [ 'endpoint', 'transid' ],
        reflectError: [ 'endpoint', 'transid' ],
        incomingMsg: [],    // { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
        incomingMsgExt: [], // { groupid, clusterid, srcaddrmode, srcaddr, srcendpoint, srcpanid, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    },
    ZDO: {},
    SAPI: {},
    UTIL: {},
    DBG: {},
    APP: {}
};



var zdoIndSuffix = {
    nwkAddrRsp: [ 'ieeeaddr', 'startindex' ],
    ieeeAddrRsp: [ 'nwkaddr', 'startindex' ],
    nodeDescRsp: [ 'nwkaddr' ],
    powerDescRsp: [ 'nwkaddr' ],
    simpleDescRsp: [ 'nwkaddr', 'endpoint' ],
    activeEpRsp: [ 'nwkaddr' ],
    matchDescRsp: [ 'nwkaddr' ],
    complexDescRsp: [ 'nwkaddr' ],
    userDescRsp: [ 'nwkaddr' ],
    userDescConf: [ 'nwkaddr' ],
    serverDiscRsp: [ 'srcaddr' ],
    endDeviceBindRsp: [ 'srcaddr' ],
    bindRsp: [ 'srcaddr' ],
    unbindRsp: [ 'srcaddr' ],
    nwkDiscoveryCnf: [],
    joinCnf: [],
    mgmtNwkDiscRsp: [ 'srcaddr', 'startindex' ],
    mgmtLqiRsp: [ 'srcaddr', 'startindex' ],
    mgmtRtgRsp: [ 'srcaddr', 'startindex' ],
    mgmtBindRsp: [ 'srcaddr', 'startindex' ],
    mgmtLeaveRsp: [ 'srcaddr' ],
    mgmtDirectJoinRsp: [ 'srcaddr' ],
    mgmtPermitJoinRsp: [ 'srcaddr' ],
    stateChangeInd: [ 'nwkaddr' ],  // very special
    endDeviceAnnceInd: [],
    matchDescRspSent: [],
    statusErrorRsp: [],
    srcRtgInd: [],
    beacon_notify_ind: [],
    leaveInd: [],
    msgCbIncoming: [],
    tcDeviceInd: [],
    permitJoinInd: []
};

var noRspAPIs = [
    'autoFindDestination', 'startupFromApp', 'msgCbRemove', 'msgCbRegister', 'mgmtNwkUpdateReq', 'getLinkKey', 'removeLinkKey', 'setLinkKey',
    'endDeviceAnnce'
];

var specialAPIs = [
    'mgmtPermitJoinReq', 'bindReq', 'serverDiscReq'
];

var genericAPIs = [
    'mgmtDirectJoinReq', 'mgmtLeaveReq', 'mgmtLqiRsp', 'joinReq', 'nwkDiscoveryReq', 'unbindReq', 'endDeviceBindReq', 'userDescSet',
    'userDescReq', 'complexDescReq', 'matchDescReq', 'activeEpReq', 'simpleDescReq', 'powerDescReq', 'nodeDescReq'
];

var multiRspsAPIs = [
    'mgmtBindReq', 'mgmtRtgReq', 'mgmtNwkDiscReq', 'ieeeAddrReq', 'nwkAddrReq'
];

bridge.generateZdoEventOfRequest = function (reqName, data) {
    var meta = zdoReqRspMap[reqName],
        rspName,
        evtName,
        tags;

    if (meta) {
        rspName = meta.ind;
        if (rspName && rspName !== '') {
            evtName = 'AREQ:ZDO:' + rspName;

            if (meta.tags.length !== 0) {
                meta.tags.forEach(function (key) {
                    evtName = evtName + ':' + data[key].toString();
                });
            }
        }
    }

    return evtName;
};

bridge.generateZdoEventOfRequest = function (indName, data) {
    var evtName = 'AREQ:ZDO:' + indName,
        tags = zdoIndEventTag[indName];

    if (tags && tag.length !== 0) {
        tags.forEach(function (key) {
            evtName = evtName + ':' + data[key].toString();
        });
    }

    return evtName;
};

bridge.generateEvent = function (msg) {
    var event;


    return event;
};

bridge.generateAfEvent = function (msg) {
    var event;

    if (msg.subsys !== 'AF')
        return;

    return event;
};

bridge.generateZdoEvent = function (msg) {
    var event;

    if (msg.subsys !== 'ZDO')
        return;


    return event;
};


    // {
    // subsys: 'ZDO',
    // ind: 'endDeviceAnnceInd',
    // data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', capabilities: 142 }
    // }


module.exports = helper;



// ZDO:NODE_DESC_RSP:nwkaddr
// ZDO:POWER_DESC_RSP:nwkaddr
// ZDO:SIMPLE_DESC_RSP:nwkaddr:endpoint
// ZDO:ACTIVE_EP_RSP:nwkaddr
// ZDO:MATCH_DESC_RSP:nwkaddr
// ZDO:COMPLEX_DESC_RSP:nwkaddr
// ZDO:USER_DESC_RSP:nwkaddr
// ZDO:USER_DESC_CONF:nwkaddr
// ZDO:SERVER_DISC_RSP:srcaddr
// ZDO:END_DEVICE_BIND_RSP:srcaddr
// ZDO:BIND_RSP:srcaddr
// ZDO:UNBIND_RSP:srcaddr

// ZDO:MGMT_LEAVE_RSP:srcaddr
// ZDO:MGMT_DIRECT_JOIN_RSP:srcaddr
// ZDO:MGMT_PERMIT_JOIN_RSP:srcaddr
// ZDO:NWK_DISCOVERY_CNF
// ZDO:JOIN_CNF

// ZDO:STATE_CHANGE_IND
// ZDO:STATE_CHANGE_IND:nwkaddr:NOT_ACTIVE
// ZDO:STATE_CHANGE_IND:nwkaddr:INVALID_EP
// !msgobj.msg['nwkaddr'] Coord itself



// ZDO:NWK_ADDR_RSP:ieeeaddr:startindex
// ZDO:IEEE_ADDR_RSP:nwkaddr:startindex
// ZDO:MGMT_NWK_DISC_RSP:srcaddr:startindex
// ZDO:MGMT_LQI_RSP:srcaddr:startindex
// ZDO:MGMT_RTG_RSP:srcaddr:startindex
// ZDO:MGMT_BIND_RSP:srcaddr:startindex

// ZDO:STATE_CHANGE_IND
// ZDO:STATE_CHANGE_IND:nwkaddr:NOT_ACTIVE
// ZDO:STATE_CHANGE_IND:nwkaddr:INVALID_EP
// !msgobj.msg['nwkaddr'] Coord itself

// ZDO:END_DEVICE_ANNCE_IND
// ZDO:MATCH_DESC_RSP_SENT
// ZDO:STATUS_ERROR_RSP
// ZDO:SRC_RTG_IND
// ZDO:BEACON_NOTIFY_IND
// ZDO:LEAVE_IND
// ZDO:MSG_CB_INCOMING
// ZDO:TC_DEVICE_IND


    // SYS: no further bridge
    // MAC: no further bridge
    // AF: 
    //  - dataConfirm, { status, endpoint, transid }
    //  - reflectError, { status, endpoint, transid, dstaddrmode, dstaddr }
    //  - incomingMsg, { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    //  - incomingMsgExt, { groupid, clusterid, srcaddrmode, srcaddr, srcendpoint, srcpanid, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    // ZDO: zdo helper
    // SAPI:
    //  - startConfirm, { status }
    //  - bindConfirm, { commandid, status }
    //  - allowBindConfirm, { source }
    //  - sendDataConfirm, { handle, status }
    //  - receiveDataIndication, { source, command, len, data }
    //  - findDeviceConfirm, { searchtype, searchkey, result }
    // UTIL:
    //  - syncReq, {}
    //  - zclKeyEstablishInd, { taskid, event, status, waittime, suite }
    // DBG: no further bridge
    // APP:
    //  - zllTlInd, { nwkaddr, endpoint, profileid, deviceid, version }


/*************************************************************************************************/
/*** Forward the event to nwkmgr for zpis who need to handle AREQ                              ***/
/*** This is done by "listen old event, and then emit a new one"                               ***/
/*************************************************************************************************/

// AF:INCOMING_MSG:srcaddr:clusterid:dstendpoint
// AF:DATA_CONFIRM:endpoint:transid
// SAPI:FIND_DEV_CNF:result  (if has result)
// ZDO:NODE_DESC_RSP:nwkaddr
// ZDO:POWER_DESC_RSP:nwkaddr
// ZDO:SIMPLE_DESC_RSP:nwkaddr:endpoint
// ZDO:ACTIVE_EP_RSP:nwkaddr
// ZDO:MATCH_DESC_RSP:nwkaddr
// ZDO:COMPLEX_DESC_RSP:nwkaddr
// ZDO:USER_DESC_RSP:nwkaddr
// ZDO:USER_DESC_CONF:nwkaddr
// ZDO:SERVER_DISC_RSP:srcaddr
// ZDO:END_DEVICE_BIND_RSP:srcaddr
// ZDO:BIND_RSP:srcaddr
// ZDO:UNBIND_RSP:srcaddr
// ZDO:MGMT_LEAVE_RSP:srcaddr
// ZDO:MGMT_DIRECT_JOIN_RSP:srcaddr
// ZDO:MGMT_PERMIT_JOIN_RSP:srcaddr
// ZDO:NWK_DISCOVERY_CNF
// ZDO:JOIN_CNF

// ZDO:STATE_CHANGE_IND
// ZDO:STATE_CHANGE_IND:nwkaddr:NOT_ACTIVE
// ZDO:STATE_CHANGE_IND:nwkaddr:INVALID_EP
// !msgobj.msg['nwkaddr'] Coord itself

// ZDO:END_DEVICE_ANNCE_IND
// ZDO:MATCH_DESC_RSP_SENT
// ZDO:STATUS_ERROR_RSP
// ZDO:SRC_RTG_IND
// ZDO:BEACON_NOTIFY_IND
// ZDO:LEAVE_IND
// ZDO:MSG_CB_INCOMING
// ZDO:TC_DEVICE_IND

// ZDO:NWK_ADDR_RSP:ieeeaddr:startindex
// ZDO:IEEE_ADDR_RSP:nwkaddr:startindex
// ZDO:MGMT_NWK_DISC_RSP:srcaddr:startindex
// ZDO:MGMT_LQI_RSP:srcaddr:startindex
// ZDO:MGMT_RTG_RSP:srcaddr:startindex
// ZDO:MGMT_BIND_RSP:srcaddr:startindex

msghub.on('AREQ:AF_INCOMING_MSG', function (msgobj) {
    msghub.emit('AF:INCOMING_MSG:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + zutil.convToHexString(msgobj.msg.clusterid, 'uint16') + ':' + zutil.convToHexString(msgobj.msg.dstendpoint, 'uint8'), msgobj.msg);
    // Emit to devmgr, and devmgr will emit another event named by the ieeeAddr
    msghub.emit('AF:INCOMING_MSG', msgobj);
    //console.log(msgobj);
});

msghub.on('AREQ:AF_DATA_CONFIRM', function (msgobj) {
    msghub.emit('AF:DATA_CONFIRM:' + zutil.convToHexString(msgobj.msg.endpoint, 'uint8') + ':' + zutil.convToHexString(msgobj.msg.transid, 'uint8'), msgobj.msg);
    msghub.emit('AF:DATA_CONFIRM:' + zutil.convToHexString(msgobj.msg.endpoint, 'uint8'), msgobj.msg);
   // console.log(msgobj);
});

msghub.on('AREQ:SAPI_FIND_DEV_CNF', function (msgobj) {
    if (Object.prototype.hasOwnProperty.call(msgobj.msg, 'result')) {
        msghub.emit('SAPI:FIND_DEV_CNF:' + zutil.convToHexString(msgobj.msg.result, 'uint32'), msgobj.msg);
    }
});

msghub.on('AREQ:ZDO_NODE_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:NODE_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_POWER_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:POWER_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_SIMPLE_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:SIMPLE_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':' + msgobj.msg.endpoint, msgobj.msg);
});

msghub.on('AREQ:ZDO_ACTIVE_EP_RSP', function (msgobj) {
    msghub.emit('ZDO:ACTIVE_EP_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MATCH_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:MATCH_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_COMPLEX_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:COMPLEX_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_USER_DESC_RSP', function (msgobj) {
    msghub.emit('ZDO:USER_DESC_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_USER_DESC_CONF', function (msgobj) {
    msghub.emit('ZDO:USER_DESC_CONF:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_SERVER_DISC_RSP', function (msgobj) {
    msghub.emit('ZDO:SERVER_DISC_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_END_DEVICE_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:END_DEVICE_BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_UNBIND_RSP', function (msgobj) {
    msghub.emit('ZDO:UNBIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_LEAVE_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_LEAVE_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_DIRECT_JOIN_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_DIRECT_JOIN_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_PERMIT_JOIN_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_PERMIT_JOIN_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16'), msgobj.msg);
});

msghub.on('AREQ:ZDO_NWK_DISCOVERY_CNF', function (msgobj) {
    msghub.emit('ZDO:NWK_DISCOVERY_CNF', msgobj.msg);
});

msghub.on('AREQ:ZDO_JOIN_CNF', function (msgobj) {
    msghub.emit('ZDO:JOIN_CNF', msgobj.msg);
});



// emit to Zdo Listener
msghub.on('AREQ:ZDO_STATE_CHANGE_IND', function (msgobj) {
    if (msgobj.msg.state.key === 'NOT_ACTIVE') {
       msghub.emit('ZDO:STATE_CHANGE_IND' + ':' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':NOT_ACTIVE', msgobj.msg);
    } else if (msgobj.msg.state.key === 'INVALID_EP') {
        msghub.emit('ZDO:STATE_CHANGE_IND' + ':' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':INVALID_EP', msgobj.msg);
    } else {
        msghub.emit('ZDO:STATE_CHANGE_IND', msgobj.msg);
        if (!msgobj.msg['nwkaddr']) {   // Coord itself
            console.log('Coord is now in state: ' + msgobj.msg.state.key);
        }
    }
});

msghub.on('AREQ:ZDO_END_DEVICE_ANNCE_IND', function (msgobj) {
    msghub.emit('ZDO:END_DEVICE_ANNCE_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_MATCH_DESC_RSP_SENT', function (msgobj) {
    msghub.emit('ZDO:MATCH_DESC_RSP_SENT', msgobj.msg);
});

msghub.on('AREQ:ZDO_STATUS_ERROR_RSP', function (msgobj) {
    msghub.emit('ZDO:STATUS_ERROR_RSP', msgobj.msg);
});

msghub.on('AREQ:ZDO_SRC_RTG_IND', function (msgobj) {
    msghub.emit('ZDO:SRC_RTG_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_BEACON_NOTIFY_IND', function (msgobj) {
    msghub.emit('ZDO:BEACON_NOTIFY_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_LEAVE_IND', function (msgobj) {
    msghub.emit('ZDO:LEAVE_IND', msgobj.msg);
});

msghub.on('AREQ:ZDO_MSG_CB_INCOMING', function (msgobj) {
    msghub.emit('ZDO:MSG_CB_INCOMING', msgobj.msg);
});

msghub.on('AREQ:ZDO_TC_DEVICE_IND', function (msgobj) {
    msghub.emit('ZDO:TC_DEVICE_IND', msgobj.msg);
});



/*************************************************************************************************/
/*** Forward the event to nwkmgr for zpis who need to handle startindex                        ***/
/*************************************************************************************************/
msghub.on('AREQ:ZDO_NWK_ADDR_RSP', function (msgobj) {
    msghub.emit('ZDO:NWK_ADDR_RSP:' + zutil.convToHexString(msgobj.msg.ieeeaddr, 'uint32') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_IEEE_ADDR_RSP', function (msgobj) {
    msghub.emit('ZDO:IEEE_ADDR_RSP:' + zutil.convToHexString(msgobj.msg.nwkaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_NWK_DISC_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_NWK_DISC_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_LQI_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_LQI_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_RTG_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_RTG_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

msghub.on('AREQ:ZDO_MGMT_BIND_RSP', function (msgobj) {
    msghub.emit('ZDO:MGMT_BIND_RSP:' + zutil.convToHexString(msgobj.msg.srcaddr, 'uint16') + ':' + msgobj.msg.startindex, msgobj.msg);
});

// event bridge
znp.on('AREQ', function (msg) {
    var zdoEvent;   // 'ZDO:XXXX:RSP', 'ZDO:XXXX:RSP'
    // subsys: 'ZDO',
    // ind: 'endDeviceAnnceInd',
    // data: { srcaddr: 63536, nwkaddr: 63536, ieeeaddr: '0x00124b0001ce3631', capabilities: 142 } 

// SYS
// AREQ, msg.id = resetInd, msg.data = { reason, transportrev, productid, majorrel, minorrel, hwrev }
// AREQ, msg.id = osalTimerExpired, msg.data = { id }
// AREQ, msg.id = jammerInd, msg.data = { jammerind }

// MAC
// AREQ, msg.id = syncLossInd, msg.data = { status, panid, logicalchannel, channelpage, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = associateInd, msg.data = { deviceextendedaddress, capabilities, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = associateCnf, msg.data = { status, deviceshortaddress, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = beaconNotifyInd, msg.data = { bsn, timestamp, coordinatoraddressmode, coordinatorextendedaddress, panid, superframespec, logicalchannel, gtspermit, linkquality, securityfailure, keysource, securitylevel, keyidmode, keyindex, pendingaddrspec, addresslist, sdulength, nsdu }
// AREQ, msg.id = dataCnf, msg.data = { status, handle, timestamp, timestamp2 }
// AREQ, msg.id = dataInd, msg.data = { srcaddrmode, srcaddr, dstaddrmode, dstaddr, timestamp, timestamp2, srcpanid, dstpanid, linkquality, correlation, rssi, dsn, keysource, securitylevel, keyidmode, keyindex, length, data }
// AREQ, msg.id = disassociateInd, msg.data = { extendedaddress, disassociatereason, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = disassociateCnf, msg.data = { status, deviceaddrmode, deviceaddr, devicepanid }
// AREQ, msg.id = orphanInd, msg.data = { extendedaddr, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = pollCnf, msg.data = { status }
// AREQ, msg.id = scanCnf, msg.data = { status, ed, scantype, channelpage, unscannedchannellist, resultlistcount, resultlistmaxlength, resultlist }
// AREQ, msg.id = commStatusInd, msg.data = { status, srcaddrmode, srcaddr, dstaddrmode, dstaddr, devicepanid, reason, keysource, securitylevel, keyidmode, keyindex }
// AREQ, msg.id = startCnf, msg.data = { status }
// AREQ, msg.id = rxEnableCnf, msg.data = { status }
// AREQ, msg.id = purgeCnf, msg.data = { status, handle }

// AF
// AREQ, msg.id = dataConfirm, msg.data = { status, endpoint, transid }
// AREQ, msg.id = reflectError, msg.data = { status, endpoint, transid, dstaddrmode, dstaddr }
// AREQ, msg.id = incomingMsg, msg.data = { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
// AREQ, msg.id = incomingMsgExt, msg.data = { groupid, clusterid, srcaddrmode, srcaddr, srcendpoint, srcpanid, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }

// ZDO
// AREQ, msg.id = nwkAddrRsp, msg.data = { status, ieeeaddr, nwkaddr, startindex, numassocdev, assocdevlist }
// AREQ, msg.id = ieeeAddrRsp, msg.data = { status, ieeeaddr, nwkaddr, startindex, numassocdev, assocdevlist }
// AREQ, msg.id = nodeDescRsp, msg.data = { srcaddr, status, nwkaddr, logicaltype_cmplxdescavai_userdescavai, apsflags_freqband, maccapflags, manufacturercode, maxbuffersize, maxintransfersize, servermask, maxouttransfersize, descriptorcap }
// AREQ, msg.id = powerDescRsp, msg.data = { srcaddr, status, nwkaddr, currentpowermode_avaipowersrc, currentpowersrc_currentpowersrclevel }
// AREQ, msg.id = simpleDescRsp, msg.data = { srcaddr, status, nwkaddr, len, endpoint, profileid, deviceid, deviceversion, numinclusters, inclusterlist, numoutclusters, outclusterlist }
// AREQ, msg.id = activeEpRsp, msg.data = { srcaddr, status, nwkaddr, activeepcount, activeeplist }
// AREQ, msg.id = matchDescRsp, msg.data = { srcaddr, status, nwkaddr, matchlength, matchlist }
// AREQ, msg.id = complexDescRsp, msg.data = { srcaddr, status, nwkaddr, complexlength, complexdesclist }
// AREQ, msg.id = userDescRsp, msg.data = { srcaddr, status, nwkaddr, userlength, userdescriptor }
// AREQ, msg.id = userDescConf, msg.data = { srcaddr, status, nwkaddr }
// AREQ, msg.id = serverDiscRsp, msg.data = { srcaddr, status, servermask }
// AREQ, msg.id = endDeviceBindRsp, msg.data = { srcaddr, status }
// AREQ, msg.id = bindRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = unbindRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = mgmtNwkDiscRsp , msg.data = { srcaddr, status, networkcount, startindex, networklistcount, networklist }
// AREQ, msg.id = mgmtLqiRsp , msg.data = { srcaddr, status, neighbortableentries, startindex, neighborlqilistcount, neighborlqilist }
// AREQ, msg.id = mgmtRtgRsp , msg.data = { srcaddr, status, routingtableentries, startindex, routingtablelistcount, routingtablelist }
// AREQ, msg.id = mgmtBindRsp , msg.data = { srcaddr, status, bindingtableentries, startindex, bindingtablelistcount, bindingtablelist }
// AREQ, msg.id = mgmtLeaveRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = mgmtDirectJoinRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = mgmtPermitJoinRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = stateChangeInd , msg.data = { state }
// AREQ, msg.id = endDeviceAnnceInd , msg.data = { srcaddr, nwkaddr, ieeeaddr, capabilities }
// AREQ, msg.id = matchDescRspSent , msg.data = { nwkaddr, numinclusters, inclusterlist, numoutclusters, outclusterlist }
// AREQ, msg.id = statusErrorRsp , msg.data = { srcaddr, status }
// AREQ, msg.id = srcRtgInd , msg.data = { dstaddr, relaycount, relaylist }
// AREQ, msg.id = beacon_notify_ind , msg.data = { beaconcount, beaconlist }
// AREQ, msg.id = joinCnf , msg.data = { status, deviceaddress, parentaddress }
// AREQ, msg.id = nwkDiscoveryCnf , msg.data = { status }
// AREQ, msg.id = leaveInd , msg.data = { srcaddr, extaddr, request, removechildren, rejoin }
// AREQ, msg.id = msgCbIncoming , msg.data = { srcaddr, wasbroadcast, clusterid, securityuse, seqnum, macdstaddr, msgdata }
// AREQ, msg.id = tcDeviceInd , msg.data = { nwkaddr, extaddr, parentaddr }
// AREQ, msg.id = permitJoinInd , msg.data = { duration }

// SAPI
// AREQ, msg.id = startConfirm, msg.data = { status }
// AREQ, msg.id = bindConfirm, msg.data = { commandid, status }
// AREQ, msg.id = allowBindConfirm, msg.data = { source }
// AREQ, msg.id = sendDataConfirm, msg.data = { handle, status }
// AREQ, msg.id = receiveDataIndication, msg.data = { source, command, len, data }
// AREQ, msg.id = findDeviceConfirm, msg.data = { searchtype, searchkey, result }

// UTIL
// AREQ, msg.id = syncReq, msg.data = { }
// AREQ, msg.id = zclKeyEstablishInd, msg.data = { taskid, event, status, waittime, suite }

// DBG - none

// APP
// AREQ, msg.id = zllTlInd, msg.data = { nwkaddr, endpoint, profileid, deviceid, version }



});