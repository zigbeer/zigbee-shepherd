var helper = {};

var zdoReqRspMap = {
    nwkAddrReq:         { ind: 'nwkAddrRsp',        apiType: 'concat',  tags: [ 'ieeeaddr', 'startindex' ]          },
    ieeeAddrReq:        { ind: 'ieeeAddrRsp',       apiType: 'concat',  tags: [ 'shortaddr', 'startindex' ]         },
    nodeDescReq:        { ind: 'nodeDescRsp',       apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    powerDescReq:       { ind: 'powerDescRsp',      apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    simpleDescReq:      { ind: 'simpleDescRsp',     apiType: 'generic', tags: [ 'nwkaddrofinterest', 'endpoint' ]   },
    activeEpReq:        { ind: 'activeEpRsp',       apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    matchDescReq:       { ind: 'matchDescRsp',      apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    complexDescReq:     { ind: 'complexDescRsp',    apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    userDescReq:        { ind: 'userDescRsp',       apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    userDescSet:        { ind: 'userDescConf',      apiType: 'generic', tags: [ 'nwkaddrofinterest' ]               },
    serverDiscReq:      { ind: 'serverDiscRsp',     apiType: 'special', tags: []                                    },  // ???? tags
    endDeviceBindReq:   { ind: 'endDeviceBindRsp',  apiType: 'generic', tags: [ 'dstaddr' ]                         },
    bindReq:            { ind: 'bindRsp',           apiType: 'special', tags: []                                    },  // ???? tags
    unbindReq:          { ind: 'unbindRsp',         apiType: 'generic', tags: [ 'dstaddr' ]                         },
    nwkDiscoveryReq:    { ind: 'nwkDiscoveryCnf',   apiType: 'generic', tags: []                                    },
    joinReq:            { ind: 'joinCnf',           apiType: 'generic', tags: []                                    },
    mgmtNwkDiscReq:     { ind: 'mgmtNwkDiscRsp',    apiType: 'concat',  tags: [ 'dstaddr', 'startindex' ]           },
    mgmtLqiReq:         { ind: 'mgmtLqiRsp',        apiType: 'concat',  tags: [ 'dstaddr', 'startindex' ]           },
    mgmtRtgReq:         { ind: 'mgmtRtgRsp',        apiType: 'concat',  tags: [ 'dstaddr', 'startindex' ]           },
    mgmtBindReq:        { ind: 'mgmtBindRsp',       apiType: 'concat',  tags: [ 'dstaddr', 'startindex' ]           },
    mgmtLeaveReq:       { ind: 'mgmtLeaveRsp',      apiType: 'generic', tags: [ 'dstaddr' ]                         },
    mgmtDirectJoinReq:  { ind: 'mgmtDirectJoinRsp', apiType: 'generic', tags: [ 'dstaddr' ]                         },
    mgmtPermitJoinReq:  { ind: 'mgmtPermitJoinRsp', apiType: 'special', tags: [ 'dstaddr' ]                         }
};

var zdoIndEventTag = {
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

helper.generateZdoEventOfRequest = function (reqName, data) {
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

helper.generateZdoEventOfRequest = function (indName, data) {
    var evtName = 'AREQ:ZDO:' + indName,
        tags = zdoIndEventTag[indName];

    if (tags && tag.length !== 0) {
        tags.forEach(function (key) {
            evtName = evtName + ':' + data[key].toString();
        });
    }

    return evtName;
};

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
