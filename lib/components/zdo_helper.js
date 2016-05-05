var helper = {};

var zdoReqRspMap = {
    nwkAddrReq: { ind: 'nwkAddrRsp', apiType: 'concat' },
    ieeeAddrReq: { ind: 'ieeeAddrRsp', apiType: 'concat' },
    nodeDescReq: { ind: 'nodeDescRsp', apiType: 'generic' },
    powerDescReq: { ind: 'powerDescRsp', apiType: 'generic' },
    simpleDescReq: { ind: 'simpleDescRsp', apiType: 'generic' },
    activeEpReq: { ind: 'activeEpRsp', apiType: 'generic' },
    matchDescReq: { ind: 'matchDescRsp', apiType: 'generic' },
    complexDescReq: { ind: 'complexDescRsp', apiType: 'generic' },
    userDescReq: { ind: 'userDescRsp', apiType: 'generic' },
    userDescSet: { ind: 'userDescConf', apiType: 'generic' },
    serverDiscReq: { ind: 'serverDiscRsp', apiType: 'special' },
    endDeviceBindReq: { ind: 'endDeviceBindRsp', apiType: 'generic' },
    bindReq: { ind: 'bindRsp', apiType: 'special' },
    unbindReq: { ind: 'unbindRsp', apiType: 'generic' },
    nwkDiscoveryReq: { ind: 'nwkDiscoveryCnf', apiType: 'generic' },
    joinReq: { ind: 'joinCnf', apiType: 'generic' },
    mgmtNwkDiscReq: { ind: 'mgmtNwkDiscRsp', apiType: 'concat' },
    mgmtLqiReq: { ind: 'mgmtLqiRsp', apiType: 'concat' },
    mgmtRtgReq: { ind: 'mgmtRtgRsp', apiType: 'concat' },
    mgmtBindReq: { ind: 'mgmtBindRsp', apiType: 'concat' },
    mgmtLeaveReq: { ind: 'mgmtLeaveRsp', apiType: 'generic' },
    mgmtDirectJoinReq: { ind: 'mgmtDirectJoinRsp', apiType: 'generic' },
    mgmtPermitJoinReq: { ind: 'mgmtPermitJoinRsp', apiType: 'special' }
};

var zdoRspSubEvtTag = {
    nwkAddrRsp: [ 'ieeeaddr', 'startindex' ],
    ieeeAddrRsp: [ 'shortaddr', 'startindex' ],
    nodeDescRsp: [ 'nwkaddrofinterest' ],
    powerDescRsp: [ 'nwkaddrofinterest' ],
    simpleDescRsp: [ 'nwkaddrofinterest', 'endpoint' ],
    activeEpRsp: [ 'nwkaddrofinterest' ],
    matchDescRsp: [ 'nwkaddrofinterest' ],
    complexDescRsp: [ 'nwkaddrofinterest' ],
    userDescRsp: [ 'nwkaddrofinterest' ],
    userDescConf: [ 'nwkaddrofinterest' ],
    serverDiscRsp: [ ], // ?????
    endDeviceBindRsp: [ 'dstaddr' ],
    bindRsp: [  ],  // ????
    unbindRsp: [ 'dstaddr' ],
    nwkDiscoveryCnf: [ ],
    joinCnf: [ ],
    mgmtNwkDiscRsp: [ 'dstaddr', 'startindex' ],
    mgmtLqiRsp: [ 'dstaddr', 'startindex' ],
    mgmtRtgRsp: [ 'dstaddr', 'startindex' ],
    mgmtBindRsp: [ 'dstaddr', 'startindex' ],
    mgmtLeaveRsp: [ 'dstaddr' ],
    mgmtDirectJoinRsp: [ 'dstaddr' ],
    mgmtPermitJoinRsp: [ 'dstaddr' ]
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

helper.zdoEventToListen = function (reqName, data) {
    var rspName = zdoReqRspMap[reqName],
        tags;

    if (rspName) {  // should tagged to distinguish events
        tags = zdoRspSubEvtTag[rspName];
        tags.forEach(function (key) {
            var tag = data[key].toString();
            rspName = rspName + ':' + tag;
        });
    }

    return ('AREQ:ZDO:' + rspName);
};

helper.zdoEventToEmit = function (ind, data) {
    var eventName = ind,
        tags = zdoRspSubEvtTag[ind];

    if (tags) {
        tags.forEach(function (key) {
            var tag = data[key].toString();
            eventName = eventName + ':' + tag;
        });
    }

    return eventName;
};

module.exports = helper;