var zdoHelper = {};

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
    serverDiscReq:      { ind: 'serverDiscRsp',     apiType: 'special', suffix: [ 'srcaddr' ]                         },  // ???? tags
    endDeviceBindReq:   { ind: 'endDeviceBindRsp',  apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    bindReq:            { ind: 'bindRsp',           apiType: 'special', suffix: [ 'dstaddr' ]                         },  // ???? tags
    unbindReq:          { ind: 'unbindRsp',         apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    nwkDiscoveryReq:    { ind: 'nwkDiscoveryCnf',   apiType: 'generic', suffix: []                                    },
    joinReq:            { ind: 'joinCnf',           apiType: 'generic', suffix: []                                    },
    mgmtNwkDiscReq:     { ind: 'mgmtNwkDiscRsp',    apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtLqiReq:         { ind: 'mgmtLqiRsp',        apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtRtgReq:         { ind: 'mgmtRtgRsp',        apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtBindReq:        { ind: 'mgmtBindRsp',       apiType: 'concat',  suffix: [ 'dstaddr', 'startindex' ]           },
    mgmtLeaveReq:       { ind: 'mgmtLeaveRsp',      apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    mgmtDirectJoinReq:  { ind: 'mgmtDirectJoinRsp', apiType: 'generic', suffix: [ 'dstaddr' ]                         },
    mgmtPermitJoinReq:  { ind: 'mgmtPermitJoinRsp', apiType: 'special', suffix: [ 'dstaddr' ]                         },
    mgmtNwkUpdateReq:   { ind: null },  // ind === null, 'rspless'
    endDeviceAnnce:     { ind: null },
    msgCbRegister:      { ind: null },
    msgCbRemove:        { ind: null },
    startupFromApp:     { ind: null },
    setLinkKey:         { ind: null },
    removeLinkKey:      { ind: null },
    getLinkKey:         { ind: null },
    secAddLinkKey:      { ind: null },
    secEntryLookupExt:  { ind: null },
    extRouteDisc:       { ind: null },
    extRouteCheck:      { ind: null },
    extRemoveGroup:     { ind: null },
    extRemoveAllGroup:  { ind: null },
    extFindAllGroupsEndpoint:   { ind: null },
    extFindGroup:       { ind: null },
    extAddGroup:        { ind: null },
    extCountAllGroups:  { ind: null },
    extRxIdle:          { ind: null },
    extUpdateNwkKey:    { ind: null },
    extSwitchNwkKey:    { ind: null },
    extNwkInfo:         { ind: null },
    extSecApsRemoveReq: { ind: null },
    forceConcentratorChange:    { ind: null },
    extSetParams:               { ind: null },
    endDeviceTimeoutReq:        { ind: null },
    sendData:                   { ind: null },
    nwkAddrOfInterestReq:       { ind: null }
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
    stateChangeInd: [ ],                // very special, tackled in controller._zdoIndicationEventBridge()
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

zdoHelper.hasAreq = function (reqName) {
    var meta = zdoReqRspMap[reqName];
    return meta ? (!!meta.ind) : false;
};

zdoHelper.generateEventOfRequest = function (reqName, valObj) {
    var meta = zdoReqRspMap[reqName],
        evtName,
        tags;

    if (!zdoHelper.hasAreq(reqName))
        return;

    evtName = 'ZDO:' + meta.ind;

    if (meta.suffix.length === 0)
        return evtName;

    meta.suffix.forEach(function (key) {
        evtName = evtName + ':' + valObj[key].toString();
    });

    return evtName;
};


zdoHelper.generateEventOfIndication = function (indName, msgData) {
    var meta = zdoIndSuffix[indName],
        evtName;

    if (!meta || (meta.length === 0))
        return evtName;

    meta.forEach(function (key) {
        evtName = evtName + ':' + msgData[key].toString();
    });

    return evtName;
};

module.exports = zdoHelper;
