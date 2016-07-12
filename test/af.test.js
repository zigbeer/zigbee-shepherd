var EventEmitter = require('events'),
    controller = new EventEmitter();

var sinon = require('sinon'),
    expect = require('chai').expect,
    Q = require('q');

var af = require('../lib/components/af')(controller),
    Device  = require('../lib/model/device'),
    Endpoint  = require('../lib/model/endpoint'),
    Coord  = require('../lib/model/coord'),
    Coordpoint  = require('../lib/model/coordpoint'),
    Cluster = require('../lib/model/cluster');

var remoteDev = new Device({
    type: 1,
    ieeeAddr: '0x123456789ABCDEF',
    nwkAddr: 100,
    status: 2,
    joinTime: 1468293176128,
    manufId: 10,
    epList: [ 1, 2 ],
    endpoints: {}
});

var rmEp1 = new Endpoint(remoteDev, {
    profId: 0x0104,
    epId: 1,
    devId: 0x0000,
    inClusterList: [ 0x0000, 0x0006 ],
    outClusterList: [ 0x0000 ]
});

var rmEp2 = new Endpoint(remoteDev, {
    profId: 0x0104,
    epId: 2,
    devId: 0x0002,
    inClusterList: [ 0x0000 ],
    outClusterList: [ 0x0000, 0x0006 ]
});

var coordDev = new Coord({
    type: 0,
    ieeeAddr: '0xABCDEF123456789',
    nwkAddr: 0,
    status: 2,
    joinTime: 1468293006128,
    manufId: 10,
    epList: [ 1, 8 ],
    endpoints: {}
});

var loEp1 = new Coordpoint(coordDev, {
    profId: 0x0104,
    epId: 1,
    devId: 0x0002,
    inClusterList: [ 0x0000 ],
    outClusterList: [ 0x0000, 0x0006 ]
}, true);

var loEp8 = new Coordpoint(coordDev, {
    profId: 0x0104,
    epId: 8,
    devId: 0x0050,
    inClusterList: [ 0x0000 ],
    outClusterList: [ 0x0000, 0x0006 ]
});

coordDev.getDelegator = function (profId) {
    if (profId === 0x0104)
        return loEp1;
};

controller.getCoord = function () {
    return coordDev;
};

var transId = 0;
controller.nextTransId = function () {
    if (++transId > 255)
        transId = 1;
    return transId;
};

controller.request = function (subsys, cmdId, valObj, callback) {
    var deferred = Q.defer();
    // callback(null, );
    process.nextTick(function () {
        deferred.resolve({ status: 0 });
    });

    return deferred.promise.nodeify(callback);
};

controller.findEndpoint = function (srcaddr, srcendpoint) {
    if (srcaddr === 100) {
        if (srcendpoint === rmEp1.getEpId())
            return rmEp1;
        else if (srcendpoint === rmEp2.getEpId())
            return rmEp2;
    } else if (srcaddr === 0) {
        if (srcendpoint === loEp1.getEpId())
            return loEp1;
        else if (srcendpoint === loEp8.getEpId())
            return loEp8;
    }
}

function fireFakeCnf(status, epid, transid) {
    var afEventCnf = 'AF:dataConfirm:' + epid + ':' + transid;
    setTimeout(function () {
        controller.emit(afEventCnf, { status: status, endpoint: epid, transid: transid  });
    });
}

function fireFakeZclRsp(dstNwkAddr, dstEpId, srcEpId, zclData) {
    // var afZclEvent = 'ZCL:incomingMsg:' + dstNwkAddr + ':' + dstEpId + ':';

    // if (srcEpId === null || srcEpId === undefined) {
    //     afZclEvent = afZclEvent + seq;
    // } else {
    //     afZclEvent = afZclEvent + srcEpId + ':' + seq;
    // }

    // console.log(afZclEvent);
    setTimeout(function () {
        controller.emit('ZCL:incomingMsg', {
            srcaddr: dstNwkAddr,
            srcendpoint: dstEpId,
            dstendpoint: srcEpId || loEp1.getEpId(),
            zclMsg: zclData
        });
    });
}

// af is an inner module, don't have to check all the arguments things
describe('APIs Arguments Check for Throwing Error', function() {
    describe('#.send', function() {
        it('should be a function', function () {
            expect(af.send).to.be.a('function');
        });

        it('Throw TypeError if srcEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return af.send('x', rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send([], rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send({}, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(undefined, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(null, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(NaN, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(new Date(), rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(function () {}, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.send(loEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);

        });

        it('Throw TypeError if dstEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return af.send(rmEp1, 'x', 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, 1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, [], 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, {}, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, undefined, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, null, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, NaN, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, new Date(), 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, function () {}, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp2, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.send(rmEp1, loEp8, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cluster id is string, but not a valud id', function (done) {
            af.send(rmEp1, rmEp1, 'x', new Buffer([ 1, 2 ]), { options: 3000 }, function (err) {
                if (err)
                    done();
            });
        });

        it('Throw TypeError if cluster id is string, but a valud id', function (done) {
            af.send(rmEp1, rmEp1, 'genAlarms', new Buffer([ 1, 2 ]), { options: 3000 }, function (err) {
                if (!err)
                    done();
            });

            fireFakeCnf(0, 1, transId);
        });

        it('Throw TypeError if cluster id is not a number', function () {
            expect(function () { return af.send(rmEp1, rmEp1, {}, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, [], new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, NaN, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, undefined, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, null, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, new Date(), new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, function () {}, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if rawPayload is not a buffer', function () {
            expect(function () { return af.send(rmEp1, rmEp1, 3, 'x', { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, [], { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, {}, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, 311, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, NaN, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Date(), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, function () {}, { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.options is not a number', function () {
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.radius is not a number', function () {
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { radius: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.timeout is not a number', function () {
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.sendExt', function() {
        it('should be a function', function () {
            expect(af.sendExt).to.be.a('function');
        });

        it('Throw TypeError if srcEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.sendExt('x', 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(1, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt([], 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt({}, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(new Date(), 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(null, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(undefined, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(NaN, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(function () {}, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if addrMode is not a number', function () {
            expect(function () { return af.sendExt(loEp8, 'x', 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, [], 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, {}, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, NaN, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, new Date(), 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, function () {}, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if dstAddrOrGrpId is not a number for ADDR_16BIT(2)', function () {
            expect(function () { return af.sendExt(loEp8, 2, [], 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, NaN, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, new Date(), 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, function () {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 'xxx', 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if dstAddrOrGrpId is not a number for ADDR_GROUP(1)', function () {
            expect(function () { return af.sendExt(loEp8, 1, [], 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 1, {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 1, NaN, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 1, new Date(), 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 1, function () {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 1, 'xxx', 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 1, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if dstAddrOrGrpId is not a string for ADDR_64BIT(1)', function () {
            expect(function () { return af.sendExt(loEp8, 3, [], 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 3, {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 3, NaN, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 3, new Date(), 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 3, function () {}, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 3, 1234, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 3, 'xxx', 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cluster id is string, but not a valud id', function (done) {
            af.sendExt(loEp8, 2, 3, 'x', new Buffer([ 1, 2 ]), { options: 3000 }, function (err) {
                if (err)
                    done();
            });
        });

        it('Throw TypeError if cluster id is string, but a valud id', function (done) {
            af.sendExt(loEp8, 2, 3, 'genAlarms', new Buffer([ 1, 2 ]), { options: 3000 }, function (err) {
                if (!err)
                    done();
            });

            fireFakeCnf(0, 8, transId);
        });

        it('Throw TypeError if cluster id is not a number', function () {
            expect(function () { return af.sendExt(loEp8, 2, 3, {}, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, [], new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, NaN, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, undefined, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, null, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, new Date(), new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, function () {}, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 3, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if rawPayload is not a buffer', function () {
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, 'x', { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, [], { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, {}, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, 311, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, NaN, { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Date(), { options: 3000 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, function () {}, { options: 3000 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.options is not a number', function () {
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.radius is not a number', function () {
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { radius: 3000 }, function () {}); }).not.to.throw(TypeError);
        });

        it('if opt is given: should throw if opt.timeout is not a number', function () {
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 'x' }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: [] }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: null }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: function () {} }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: NaN }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.zclFoundation', function() {
        it('Throw TypeError if srcEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclFoundation('x', rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation([], rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation({}, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(null, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(true, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(undefined, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(new Date(), rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(function () {}, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if dstEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclFoundation(rmEp1, 'x', 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, 1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, [], 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, {}, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, null, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, true, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, undefined, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, new Date(), 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, function () {}, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cId is not a string and not a number', function () {
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, [], 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, {}, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, null, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, undefined, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, NaN, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, false, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, new Date(), 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, function () {}, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cmd is not a string and not a number', function () {
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, [], [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, {}, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, null, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, undefined, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, NaN, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, false, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, new Date(), [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, function () {}, [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if zclData is with bad type', function () {
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', 3, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', function () {}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cfg is given but not an object', function () {
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], 1, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], [], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], {}, function () {}); }).not.to.throw(TypeError);
        });
    });
    describe('#.zclFunctional', function() {
        it('Throw TypeError if srcEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclFunctional('x', rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(1, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional([], rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional({}, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(null, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(true, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(undefined, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(new Date(), rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(function () {}, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 5, 3, { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if dstEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclFunctional(rmEp1, 'x', 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, 1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, [], 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, {}, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, null, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, true,  'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, undefined, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, new Date(), 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, function () {}, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 5, 3, { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cId is not a string and not a number', function () {
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, [], 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, {}, 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, null, 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, true, 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, undefined, 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, new Date(), 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, function () {}, 'removeAll', { groupid: 1 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 5, 3, { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
        });
        it('Throw TypeError if cmd is not a string and not a number', function () {
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', [], { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', {}, { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', null, { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', true, { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', undefined, { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', NaN, { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', new Date(), { groupid: 1 }, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', function () {}, { groupid: 1 }, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 5, 3, { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', { groupid: 1 }, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if zclData is with bad type', function () {
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', 3, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', function () {}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cfg is given but not an object', function () {
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, 1, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, [], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, {}, function () {}); }).not.to.throw(TypeError);
        });
    });
});

describe('Module Methods Check', function() {
    describe('#.send - by delegator', function() {
        it('if srsp status !== 0, === 1, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 1 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp !== 0 && rsp !== 'SUCCESS')
                    done();
            });

            requestStub.restore();
        });

        it('if srsp status === 0, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 1, transId);
            requestStub.restore();
        });

        it('if srsp status === SUCCESS, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 'SUCCESS'});
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 1, transId);
            requestStub.restore();
        });

        it('if areq status === 0xcd, NWK_NO_ROUTE, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xcd, 1, transId);
            requestStub.restore();
        });

        it('if areq status === 0xe9, MAC_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xe9, 1, transId);
            requestStub.restore();
        });

        it('if areq status === 0xb7, APS_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xb7, 1, transId);
            requestStub.restore();
        });

        it('if areq status === 0xf0, MAC_TRANSACTION_EXPIRED, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xf0, 1, transId);
            requestStub.restore();
        });

        it('if areq status === 0xANY, UNKNOWN ERROR, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xEE, 1, transId);
            requestStub.restore();
        });

        it('if srsp status === 0, apsAck = 0, resolve successfully', function (done) {
            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 0 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
        });

        it('if srsp status === 0, resolve successfully', function (done) {
            af.send(rmEp1, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 1, transId);
        });
    });

    describe('#.send - by local ep 8', function() {
        it('if srsp status !== 0, === 1, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 1 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp !== 0 && rsp !== 'SUCCESS')
                    done();
            });

            requestStub.restore();
        });

        it('if srsp status === 0, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 8, transId);
            requestStub.restore();
        });

        it('if srsp status === SUCCESS, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 'SUCCESS'});
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xcd, NWK_NO_ROUTE, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xcd, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xe9, MAC_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xe9, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xb7, APS_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xb7, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xf0, MAC_TRANSACTION_EXPIRED, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xf0, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xANY, UNKNOWN ERROR, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err) {
                    done();
                }
            });

            fireFakeCnf(0xEE, 8, transId);
            requestStub.restore();
        });

        it('if srsp status === 0, apsAck = 0, resolve successfully', function (done) {
            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { options: 0 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
        });

        it('if srsp status === 0, resolve successfully', function (done) {
            af.send(loEp8, rmEp1, 3, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
            fireFakeCnf(0, 8, transId);
        });
    });

    describe('#.sendExt', function() {
        it('if srsp status !== 0, === 1, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 1 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp !== 0 && rsp !== 'SUCCESS')
                    done();
            });

            requestStub.restore();
        });

        it('if srsp status === 0, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });

            fireFakeCnf(0, 8, transId);
            requestStub.restore();
        });

        it('if srsp status === SUCCESS, nothing happen', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 'SUCCESS'});
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });

            fireFakeCnf(0, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xcd, NWK_NO_ROUTE, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err)
                    done();
            });

            fireFakeCnf(0xcd, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xe9, MAC_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err)
                    done();
            });

            fireFakeCnf(0xe9, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xb7, APS_NO_ACK, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err)
                    done();
            });

            fireFakeCnf(0xb7, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xf0, MAC_TRANSACTION_EXPIRED, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err)
                    done();
            });

            fireFakeCnf(0xf0, 8, transId);
            requestStub.restore();
        });

        it('if areq status === 0xANY, UNKNOWN ERROR, reject', function (done) {
            var requestStub = sinon.stub(controller, 'request', function (subsys, cmdId, valObj, callback) {
                    var deferred = Q.defer();
                    process.nextTick(function () {
                        deferred.resolve({ status: 0 });
                    });
                    return deferred.promise.nodeify(callback);
            });

            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (err)
                    done();
            });

            fireFakeCnf(0xEE, 8, transId);
            requestStub.restore();
        });

        it('if srsp status === 0, apsAck = 0, resolve successfully', function (done) {
            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { options: 0 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });
        });

        it('if srsp status === 0, resolve successfully', function (done) {
            af.sendExt(loEp8, 2, 3, 12, new Buffer([ 1, 2 ]), { timeout: 3000 }, function (err, rsp) {
                if (rsp.status === 0)
                    done();
            });

            fireFakeCnf(0, 8, transId);
        });
    });

    describe('#.zclFoundation - by delegator', function() {
        // fireFakeZclRsp(dstNwkAddr, dstEpId, srcEpId, seq) 
        // af.zclFoundation(srcEp, dstEp, cId, cmd, zclData, cfg, callback);

        it('zcl good send', function (done) {
            var fakeZclMsg;
            af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 0,
                    disDefaultRsp: 0
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
        });

        it('zcl bad send - unkown cId', function (done) {
            af.zclFoundation(rmEp1, rmEp1, 'xxx', 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (err)
                    done();
            });
        });

        it('zcl bad send - unkown cmd', function (done) {
            af.zclFoundation(rmEp1, rmEp1, 3, 'read333', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (err)
                    done();
            });
        });
    });

    describe('#.zclFoundation - by loEp8', function() {
        // fireFakeZclRsp(dstNwkAddr, dstEpId, srcEpId, zclData) 
        // af.zclFoundation(srcEp, dstEp, cId, cmd, zclData, cfg, callback);
        it('zcl good send', function (done) {
            var fakeZclMsg;
            af.zclFoundation(loEp8, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], { direction: 1 }, function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 0,
                    disDefaultRsp: 0
                }
            };


            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), loEp8.getEpId(), fakeZclMsg);
        });

        it('zcl good send - rsp, no listen', function (done) {
            var fakeZclMsg;
            af.zclFoundation(loEp8, rmEp1, 3, 'readRsp', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], { direction: 0 }, function (err, msg) {
                if (!err && (msg.status === 0))
                    done();
            });

            fireFakeCnf(0, loEp8.getEpId(), transId);
        });

        it('zcl bad send - unkown cId', function (done) {
            af.zclFoundation(loEp8, rmEp1, 'xxx', 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (err)
                    done();
            });
        });

        it('zcl bad send - unkown cmd', function (done) {
            af.zclFoundation(loEp8, rmEp1, 3, 'read333', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (err)
                    done();
            });
        });
    });

    describe('#.zclFunctional - by delegator', function() {
        // fireFakeZclRsp(dstNwkAddr, dstEpId, srcEpId, seq) 
        // af.zclFoundation(srcEp, dstEp, cId, cmd, zclData, cfg, callback);

        it('zcl good send', function (done) {
            var fakeZclMsg;

            // [TODO] why direction casuing error? DEAD here!!!
            af.zclFunctional(rmEp1, rmEp1, 5, 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 1,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 0,
                    disDefaultRsp: 0
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
        });

        // it('zcl bad send - unkown cId', function (done) {
        //     af.zclFoundation(rmEp1, rmEp1, 'xxx', 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
        //         if (err)
        //             done();
        //     });
        // });

        // it('zcl bad send - unkown cmd', function (done) {
        //     af.zclFoundation(rmEp1, rmEp1, 3, 'read333', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
        //         if (err)
        //             done();
        //     });
        // });
    });

});

