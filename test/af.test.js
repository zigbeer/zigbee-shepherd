var EventEmitter = require('events'),
    controller = new EventEmitter();

var sinon = require('sinon'),
    expect = require('chai').expect,
    Q = require('q');

var af = require('../lib/components/af'),
    Device  = require('../lib/model/device'),
    Endpoint  = require('../lib/model/endpoint'),
    Coord  = require('../lib/model/coord'),
    Coordpoint  = require('../lib/model/coordpoint');

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

coordDev.endpoints[loEp1.getEpId()] = loEp1;
coordDev.endpoints[loEp8.getEpId()] = loEp8;

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
};

function fireFakeCnf(status, epid, transid) {
    var afEventCnf = 'AF:dataConfirm:' + epid + ':' + transid;
    setTimeout(function () {
        controller.emit(afEventCnf, { status: status, endpoint: epid, transid: transid  });
    });
}

function fireFakeZclRsp(dstNwkAddr, dstEpId, srcEpId, zclData) {
    setTimeout(function () {
        controller.emit('ZCL:incomingMsg', {
            srcaddr: dstNwkAddr,
            srcendpoint: dstEpId,
            dstendpoint: srcEpId || loEp1.getEpId(),
            zclMsg: zclData
        });
    });
}

function fireFakeZclRawRsp(dstNwkAddr, dstEpId, srcEpId, zclBuffer, cid) {
    // msg: { groupid, clusterid, srcaddr, srcendpoint, dstendpoint, wasbroadcast, linkquality, securityuse, timestamp, transseqnumber, len, data }
    setTimeout(function () {
        controller.emit('AF:incomingMsg', {
            srcaddr: dstNwkAddr,
            srcendpoint: dstEpId,
            dstendpoint: srcEpId || loEp1.getEpId(),
            clusterid: cid || 0,
            data: zclBuffer
        });
    });
}

// af is an inner module, don't have to check all the arguments things
describe('APIs Arguments Check for Throwing Error', function() {
    before(function () {
        af = require('../lib/components/af')(controller);
    });

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
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], NaN, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], null, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFoundation(rmEp1, rmEp1, 3, 'read', [], undefined, function () {}); }).not.to.throw(TypeError);
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
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, NaN, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, null, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, undefined, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclFunctional(rmEp1, rmEp1, 'genScenes', 'removeAll', {}, {}, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.zclClusterAttrIdsReq', function() {
        it('Throw TypeError if dstEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclClusterAttrIdsReq('x', 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(1, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq([], 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq({}, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(null, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(true, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(undefined, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(new Date(), 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(function () {}, 'genScenes', function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, 5, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, 'genScenes', function () {}); }).not.to.throw(TypeError);
        });
    
        it('Throw TypeError if cId is not a string or a number', function () {
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, [], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, 5, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclClusterAttrIdsReq(rmEp1, 'genScenes', function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.zclClusterAttrsReq', function() {
        it('Throw TypeError if dstEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclClusterAttrsReq('x', 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(1, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq([], 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq({}, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(null, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(true, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(undefined, 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(new Date(), 'genScenes', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(function () {}, 'genScenes', function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclClusterAttrsReq(rmEp1, 5, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, 'genScenes', function () {}); }).not.to.throw(TypeError);
        });

        it('Throw TypeError if cId is not a string or a number', function () {
            expect(function () { return af.zclClusterAttrsReq(rmEp1, [], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclClusterAttrsReq(rmEp1, 5, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclClusterAttrsReq(rmEp1, 'genScenes', function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.zclClustersReq', function() {
        it('Throw TypeError if dstEp is not an Instance of Endpoint or Coordpoint class', function () {
            expect(function () { return af.zclClustersReq('x', function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(1, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq([], function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq({}, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(null, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(true, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return af.zclClustersReq(function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return af.zclClustersReq(rmEp1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return af.zclClustersReq(rmEp1, function () {}); }).not.to.throw(TypeError);
        });
    });
});

describe('Module Methods Check', function() {
    before(function () {
        af = require('../lib/components/af')(controller);
    });

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
                    direction: 1,
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
        it('zcl good send', function (done) {
            var fakeZclMsg;
            af.zclFoundation(loEp8, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], { direction: 0 }, function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                }
            };


            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), loEp8.getEpId(), fakeZclMsg);
        });

        it('zcl good send - rsp, no listen', function (done) {
            var fakeZclMsg;
            af.zclFoundation(loEp8, rmEp1, 3, 'readRsp', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], { direction: 1 }, function (err, msg) {
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
        it('zcl good send', function (done) {
            var fakeZclMsg;

            af.zclFunctional(rmEp1, rmEp1, 5, 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 1,
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
        });

        it('zcl bad send - unkown cId', function (done) {
            af.zclFunctional(rmEp1, rmEp1, 'xxx', 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (err)
                    done();
            });
        });

        it('zcl bad send - unkown cmd', function (done) {
            af.zclFunctional(rmEp1, rmEp1, 5, 'removeAllxxx', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (err)
                    done();
            });
        });
    });

    describe('#.zclFunctional - by loEp8', function() {
        it('zcl good send', function (done) {
            var fakeZclMsg;

            af.zclFunctional(loEp8, rmEp1, 5, 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (!err && (zclMsg === fakeZclMsg))
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 1,
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), loEp8.getEpId(), fakeZclMsg);
        });


        it('zcl good send - rsp, no listen', function (done) {
            var fakeZclMsg;

            af.zclFunctional(loEp8, rmEp1, 5, 'removeAllRsp', { status: 0, groupid: 1 }, { direction: 1 }, function (err, zclMsg) {
                if (!err )
                    done();
            });

            fireFakeCnf(0, loEp8.getEpId(), transId);
        });

        it('zcl bad send - unkown cId', function (done) {
            af.zclFunctional(loEp8, rmEp1, 'xxx', 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (err)
                    done();
            });
        });

        it('zcl bad send - unkown cmd', function (done) {
            af.zclFunctional(loEp8, rmEp1, 5, 'removeAllxxx', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (err)
                    done();
            });
        });
    });

    describe('#.zclFoundation - by delegator - rawZclRsp', function() {
        it('zcl good send', function (done) {
            var fakeZclRaw;
            af.zclFoundation(rmEp1, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], function (err, zclMsg) {
                if (!err)
                    done();
            });

            fakeZclRaw = new Buffer([ 8, af._seq, 0, 10, 10]);
            fireFakeZclRawRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclRaw);
        });
    });

    describe('#.zclFoundation - by loEp8', function() {
        it('zcl good send', function (done) {
            var fakeZclRaw;
            af.zclFoundation(loEp8, rmEp1, 3, 'read', [ { attrId: 0 }, { attrId: 1 }, { attrId: 3 } ], { direction: 0 }, function (err, zclMsg) {
                if (!err)
                    done();
            });

            fakeZclRaw = new Buffer([ 8, af._seq, 0, 10, 10]);
            fireFakeZclRawRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), loEp8.getEpId(), fakeZclRaw);
        });
    });

    describe('#.zclFunctional - by delegator', function() {
        it('zcl good send', function (done) {
            var fakeZclRaw;

            af.zclFunctional(rmEp1, rmEp1, 5, 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (!err)
                    done();
            });

            fakeZclRaw = new Buffer([ 9, af._seq, 3, 10, 10, 10]);
            fireFakeZclRawRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclRaw, 5);
        });
    });

    describe('#.zclFunctional - by loEp8', function() {
        it('zcl good send', function (done) {
            var fakeZclRaw;

            af.zclFunctional(loEp8, rmEp1, 5, 'removeAll', { groupid: 1 }, { direction: 0 }, function (err, zclMsg) {
                if (!err)
                    done();
            });
            fakeZclRaw = new Buffer([ 9, af._seq, 3, 10, 10, 10]);
            fireFakeZclRawRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), loEp8.getEpId(), fakeZclRaw, 5);
        });
    });


    describe('#.zclClusterAttrIdsReq', function() {
        it('zcl good send - only 1 rsp', function (done) {
            var fakeZclMsg;
            af.zclClusterAttrIdsReq(rmEp1, 6, function (err, rsp) {
                if (!err)
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                },
                payload: {
                    discComplete: 1,
                    attrInfos: [ { attrId: 1, dataType: 0 } ]
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
        });


        it('zcl good send - 3 rsps', function (done) {
            var fakeZclMsg,
                seqNum1,
                seqNum2,
                seqNum3;

            af.zclClusterAttrIdsReq(rmEp1, 6, function (err, rsp) {
                if (!err)
                    done();
            });

            seqNum1 = af._seq;
            seqNum2 = af._seq + 1;
            seqNum3 = af._seq + 2;

            fakeZclMsg = {
                seqNum: seqNum1,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                },
                payload: {
                    discComplete: 0,
                    attrInfos: [ { attrId: 1, dataType: 0 } ]
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);

            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum2;
                fakeZclMsg.payload.attrInfos = [ { attrId: 2, dataType: 0 }, { attrId: 3, dataType: 0 } ];
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 20);

            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum3;
                fakeZclMsg.payload.discComplete = 1;
                fakeZclMsg.payload.attrInfos = [ { attrId: 6, dataType: 0 }, { attrId: 7, dataType: 0 }, { attrId: 18, dataType: 0 } ];
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 40);
        });
    });


    describe('#.zclClusterAttrsReq', function() {
        it('zcl good send - only 1 rsp', function (done) {
            var fakeZclMsg;
            af.zclClusterAttrsReq(rmEp1, 6, function (err, rsp) {
                if (!err)
                    done();
            });

            fakeZclMsg = {
                seqNum: af._seq,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                },
                payload: {
                    discComplete: 1,
                    attrInfos: [ { attrId: 16384, dataType: 0 }, { attrId: 16385, dataType: 0 } ]
                }
            };
            var seqNum2 = af._seq + 1;

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum2;
                fakeZclMsg.payload = [ { attrId: 16384, status: 0, dataType: 0, attrData: 10 }, { attrId: 16385, status: 0, dataType: 0, attrData: 110 } ];
                // { attrId, status , dataType, attrData }
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 20);
        });


        it('zcl good send - 3 rsps', function (done) {
            var fakeZclMsg,
                seqNum1,
                seqNum2,
                seqNum3;

            af.zclClusterAttrsReq(rmEp1, 6, function (err, rsp) {
                if (!err)
                    done();
            });

            seqNum1 = af._seq;
            seqNum2 = af._seq + 1;
            seqNum3 = af._seq + 2;
            seqNum4 = af._seq + 3;

            fakeZclMsg = {
                seqNum: seqNum1,
                frameCntl: {
                    frameType: 0,  // Command acts across the entire profile (foundation)
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 0
                },
                payload: {
                    discComplete: 0,
                    attrInfos: [ { attrId: 0, dataType: 0 } ]
                }
            };

            fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);

            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum2;
                fakeZclMsg.payload.attrInfos = [ { attrId: 16384, dataType: 0 }, { attrId: 16385, dataType: 0 } ];
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 20);

            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum3;
                fakeZclMsg.payload.discComplete = 1;
                fakeZclMsg.payload.attrInfos = [ { attrId: 16386, dataType: 0 } ];
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 40);

            setTimeout(function () {
                fakeZclMsg.seqNum = seqNum4;
                fakeZclMsg.payload = [
                    { attrId: 0, status: 0, dataType: 0, attrData: 'hi' }, { attrId: 16384, status: 0, dataType: 0, attrData: 10 },
                    { attrId: 16385, status: 0, dataType: 0, attrData: 110 }, { attrId: 16386, status: 0, dataType: 0, attrData: 'hello' }
                ];
                // { attrId, status , dataType, attrData }
                fireFakeZclRsp(rmEp1.getNwkAddr(), rmEp1.getEpId(), null, fakeZclMsg);
            }, 60);
        });
    });

    describe('#.zclClustersReq', function() {
       it('should resove for sequentially requests', function (done) {
            var rmEp1GetClusterListStub = sinon.stub(rmEp1, 'getClusterList').returns([ 1, 2, 3, 4, 5 ]),
                rmEp1GetInClusterListStub = sinon.stub(rmEp1, 'getInClusterList').returns([ 1, 2, 3 ]),
                rmEp1GetOutClusterListStub = sinon.stub(rmEp1, 'getOutClusterList').returns([ 1, 3, 4, 5 ]);

            var requestStub = sinon.stub(af, 'zclClusterAttrsReq', function (dstEp, cId, callback) {
                    var deferred = Q.defer();
                    setTimeout(function () {
                        deferred.resolve({
                            x1: { value: 'hello' },
                            x2: { value: 'world' }
                        });
                    }, 10);
                    return deferred.promise.nodeify(callback);
            });

            af.zclClustersReq(rmEp1, function (err, data) {
                rmEp1GetClusterListStub.restore();
                rmEp1GetInClusterListStub.restore();
                rmEp1GetOutClusterListStub.restore();
                requestStub.restore();

                var good = false;
                if (data.genPowerCfg.dir === 3 && data.genPowerCfg.attrs.x1.value === 'hello' && data.genPowerCfg.attrs.x2.value === 'world' )
                    good = true;

                if (data.genDeviceTempCfg.dir === 1 && data.genDeviceTempCfg.attrs.x1.value === 'hello' && data.genDeviceTempCfg.attrs.x2.value === 'world' )
                    good = good && true;

                if (data.genIdentify.dir === 3 && data.genIdentify.attrs.x1.value === 'hello' && data.genIdentify.attrs.x2.value === 'world' )
                    good = good && true;

                if (data.genGroups.dir === 2 && data.genGroups.attrs.x1.value === 'hello' && data.genGroups.attrs.x2.value === 'world' )
                    good = good && true;

                if (data.genScenes.dir === 2 && data.genScenes.attrs.x1.value === 'hello' && data.genScenes.attrs.x2.value === 'world' )
                    good = good && true;

                if (good)
                    done();
            });
       });

       // it('should reject for sequentially requests when receiver bad', function (done) {
       //      var rmEp1GetClusterListStub = sinon.stub(rmEp1, 'getClusterList').returns([ 1, 2, 3, 4, 5 ]),
       //          rmEp1GetInClusterListStub = sinon.stub(rmEp1, 'getInClusterList').returns([ 1, 2, 3 ]),
       //          rmEp1GetOutClusterListStub = sinon.stub(rmEp1, 'getOutClusterList').returns([ 1, 3, 4, 5 ]);

       //      var requestStub = sinon.stub(af, 'zclClusterAttrsReq', function (dstEp, cId, callback) {
       //              var deferred = Q.defer();
       //              setTimeout(function () {
       //                  if (cId !== 3) {
       //                      deferred.resolve({
       //                          x1: { value: 'hello' },
       //                          x2: { value: 'world' }
       //                      });
       //                  } else {
       //                      deferred.reject(new Error('TEST ERROR'));
       //                  }

       //              }, 10);
       //              return deferred.promise.nodeify(callback);
       //      });

       //      af.zclClustersReq(rmEp1, function (err, data) {
       //          rmEp1GetClusterListStub.restore();
       //          rmEp1GetInClusterListStub.restore();
       //          rmEp1GetOutClusterListStub.restore();
       //          requestStub.restore();

       //          if (err)
       //              done();
       //      });
       // });
    });
});
