var Q = require('q'),
    sinon = require('sinon'),
    expect = require('chai').expect,
    Controller = require('../lib/components/controller');

var Device  = require('../lib/model/device'),
    Endpoint  = require('../lib/model/endpoint'),
    Coord  = require('../lib/model/coord'),
    Coordpoint  = require('../lib/model/coordpoint');

var remoteDev = new Device({
    type: 1,
    ieeeAddr: '0x123456789abcdef',
    nwkAddr: 100,
    status: 2,
    joinTime: 1469528821,
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
    ieeeAddr: '0x0abcdef123456789',
    nwkAddr: 0,
    status: 2,
    joinTime: 1469528238,
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

describe('Constructor Check', function () {
    it('should has all correct members after new', function () {
        var controller = new Controller({}, { path: '/dev/ttyUSB0' });

        expect(controller._shepherd).to.be.an('object');
        expect(controller._coord).to.be.null;
        expect(controller._znp).to.be.an('object');
        expect(controller._zdo).to.be.an('object');
        expect(controller._cfg).to.be.deep.equal({ path: '/dev/ttyUSB0' });
        expect(controller._resetting).to.be.false;
        expect(controller.querie).to.be.an('object');

        expect(controller._net).to.be.deep.equal({
            state: null,
            channel: null,
            panId: null,
            extPanId: null,
            ieeeAddr: null,
            nwkAddr: null,
            joinTimeLeft: 0,
        });

        expect(controller.nextTransId).to.be.a('function');
        expect(controller.permitJoinCountdown).to.be.a('function');
        expect(controller.isResetting).to.be.a('function');
    });

    it('should throw if cfg is not an object', function () {
        expect(function () { return new Controller({}, 'x'); }).to.throw(TypeError);
        expect(function () { return new Controller({}, 1); }).to.throw(TypeError);
        expect(function () { return new Controller({}, []); }).to.throw(TypeError);
        expect(function () { return new Controller({}, undefined); }).to.throw(TypeError);
        expect(function () { return new Controller({}, null); }).to.throw(TypeError);
        expect(function () { return new Controller({}, NaN); }).to.throw(TypeError);
        expect(function () { return new Controller({}, true); }).to.throw(TypeError);
        expect(function () { return new Controller({}, new Date()); }).to.throw(TypeError);
        expect(function () { return new Controller({}, function () {}); }).to.throw(TypeError);

        expect(function () { return new Controller({}, {}); }).not.to.throw(TypeError);
    });
});

describe('Signature Check', function () {
    var controller = new Controller({}, { path: '/dev/ttyUSB0' });

    controller._coord = coordDev;

    describe('#.reset', function () {
        it('should be a function', function () {
            expect(controller.reset).to.be.a('function');
        });

        it('should throw if mode is not a number and not a string', function () {
            expect(function () { return controller.reset([], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset({}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reset(function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.reset(1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.reset('soft', function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.request', function () {
        it('should be a function', function () {
            expect(controller.request).to.be.a('function');
        });

        it('should throw if subsys is not a number and not a string', function () {
            expect(function () { return controller.request([], 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request({}, 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(undefined, 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(null, 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(NaN, 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(true, 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(new Date(), 'ping', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request(function () {}, 'ping', {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.request(5, 'ping', {}, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', {}, function () {}); }).not.to.throw(TypeError);
        });

        it('should throw if cmdId is not a number and not a string', function () {
            expect(function () { return controller.request('ZDO', [], {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', {}, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', undefined, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', null, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', NaN, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', true, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', new Date(), {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', function () {}, {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.request('ZDO', 10, {}, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', {}, function () {}); }).not.to.throw(TypeError);
        });

        it('should throw if valObj is not an object and not an array', function () {
            expect(function () { return controller.request('ZDO', 'ping', 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', 1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.request('ZDO', 'ping', {}, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.request('ZDO', 'ping', [], function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.permitJoin', function () {
        it('should be a function', function () {
            expect(controller.permitJoin).to.be.a('function');
        });

        it('should throw if joinTime is not a number', function () {
            expect(function () { return controller.permitJoin('x', 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin([], 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin({}, 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(undefined, 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(null, 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(NaN, 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(true, 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(new Date(), 'coord', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(function () {}, 'coord', function () {}); }).to.throw(TypeError);

            expect(function () { return controller.permitJoin(10, 'coord', function () {}); }).not.to.throw(TypeError);
        });

        it('should throw if joinType is not a number and not a string', function () {
            expect(function () { return controller.permitJoin(10, [], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.permitJoin(10, 1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.permitJoin(10, 'coord', function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.simpleDescReq', function () {
        it('should be a function', function () {
            expect(controller.simpleDescReq).to.be.a('function');
        });

        it('should throw if nwkAddr is not a number', function () {
            expect(function () { return controller.simpleDescReq('x', '0x0123456789abcdef', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq([], '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq({}, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(undefined, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(null, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(NaN, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(true, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(new Date(), '0x0123456789abcdef',function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(function () {}, '0x0123456789abcdef',function () {}); }).to.throw(TypeError);

            expect(function () { return controller.simpleDescReq(12345, '0x0123456789abcdef', function () {}); }).not.to.throw(TypeError);
        });

        it('should throw if ieeeAddr is not a string', function () {
            expect(function () { return controller.simpleDescReq(12345, 1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, [], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.simpleDescReq(12345, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.simpleDescReq(12345, '0x0123456789abcdef', function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.registerEp', function () {
        it('should be a function', function () {
            expect(controller.registerEp).to.be.a('function');
        });

        it('should throw if loEp is not a Coorpoint', function () {
            expect(function () { return controller.registerEp('x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp([], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp({}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(function () {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(rmEp1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.registerEp(rmEp2, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.registerEp(loEp1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.registerEp(loEp8, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.deregisterEp', function () {
        it('should be a function', function () {
            expect(controller.deregisterEp).to.be.a('function');
        });

        it('should throw if loEp is not a Coorpoint', function () {
            expect(function () { return controller.deregisterEp('x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp([], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp({}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(function () {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(rmEp1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.deregisterEp(rmEp2, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.deregisterEp(loEp1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.deregisterEp(loEp8, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.reRegisterEp', function () {
        it('should be a function', function () {
            expect(controller.reRegisterEp).to.be.a('function');
        });

        it('should throw if loEp is not a Coorpoint', function () {
            expect(function () { return controller.reRegisterEp('x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp([], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp({}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(function () {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(rmEp1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(rmEp2, function () {}); }).to.throw(TypeError);

            expect(function () { return controller.reRegisterEp(loEp1, function () {}); }).not.to.throw(TypeError);
            expect(function () { return controller.reRegisterEp(loEp8, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.bind', function () {
        it('should be a function', function () {
            expect(controller.bind).to.be.a('function');
        });

        it('should throw if srcEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return controller.bind('x', rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(1, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind([], rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind({}, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(undefined, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(null, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(NaN, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(true, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(new Date(), rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(function () {}, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if dstEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return controller.bind(loEp1, 'x', 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, 1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, [], 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, {}, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, undefined, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, null, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, NaN, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, true, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, new Date(), 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, function () {}, 'genOnOff', null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if cId is not a number and not a string', function () {
            expect(function () { return controller.bind(loEp1, rmEp1, [], null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, {}, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, undefined, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, null, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, NaN, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, true, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, new Date(), null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, function () {}, null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if grpId is not a number', function () {
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', [], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.bind(loEp1, rmEp1, 'genOnOff', function () {}, function () {}); }).to.throw(TypeError);
        });
    });

    describe('#.unbind', function () {
        it('should be a function', function () {
            expect(controller.unbind).to.be.a('function');
        });

        it('should throw if srcEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return controller.unbind('x', rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(1, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind([], rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind({}, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(undefined, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(null, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(NaN, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(true, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(new Date(), rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(function () {}, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if dstEp is not an Endpoint or a Coorpoint', function () {
            expect(function () { return controller.unbind(loEp1, 'x', 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, 1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, [], 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, {}, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, undefined, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, null, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, NaN, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, true, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, new Date(), 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, function () {}, 'genOnOff', null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if cId is not a number and not a string', function () {
            expect(function () { return controller.unbind(loEp1, rmEp1, [], null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, {}, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, undefined, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, null, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, NaN, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, true, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, new Date(), null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, function () {}, null, function () {}); }).to.throw(TypeError);
        });

        it('should throw if grpId is not a number', function () {
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', [], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.unbind(loEp1, rmEp1, 'genOnOff', function () {}, function () {}); }).to.throw(TypeError);
        });
    });

    describe('#.remove', function () {
        it('should be a function', function () {
            expect(controller.remove).to.be.a('function');
        });

        it('should throw if dev is not a Device', function () {
            expect(function () { return controller.remove('x', {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(1, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove([], {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove({}, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(undefined, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(null, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(NaN, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(true, {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(new Date(), {}, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(function () {}, {}, function () {}); }).to.throw(TypeError);
        });

        it('should throw if cfg is not an object', function () {
            expect(function () { return controller.remove(remoteDev, 'x', function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, 1, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, [], function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, null, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, true, function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return controller.remove(remoteDev, function () {}, function () {}); }).to.throw(TypeError);
        });
    });
});
