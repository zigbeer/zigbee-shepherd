var Q = require('q'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    expect = chai.expect;

var //af = require('../lib/components/af')(controller),
    Device  = require('../lib/model/device'),
    Endpoint  = require('../lib/model/endpoint'),
    Coord  = require('../lib/model/coord');
    //Coordpoint  = require('../lib/model/coordpoint');

chai.use(sinonChai);

var Shepherd = require('../index.js');

var coordDev = new Coord({
    type: 0,
    ieeeAddr: '0x00124b00019c2ee9',
    nwkAddr: 0,
    manufId: 10,
    epList: [ 1, 2]
});

var dev1 = new Device({
    type: 1,
    ieeeAddr: '0x00137a00000161f2',
    nwkAddr: 100,
    manufId: 10,
    epList: [ 1 ]
});

var dev2 = new Device({
    type: 1,
    ieeeAddr: '0x0123456789abcdef',
    nwkAddr: 200,
    manufId: 20,
    epList: [ 1 ]
});


describe('Constructor Check', function () {
    var shepherd;
    before(function () {
        shepherd = new Shepherd('/dev/ttyUSB0');
    });

    it('should has all correct members after new', function () {
        expect(shepherd._startTime).to.be.equal(0);
        expect(shepherd._enabled).to.be.false;
        expect(shepherd._zApp).to.be.an('array');
        expect(shepherd._devbox).to.be.an('object');
        expect(shepherd.controller).to.be.an('object');
        expect(shepherd.af).to.be.an('object');
    });

    it('should throw if path is not a string', function () {
        expect(function () { return new Shepherd({}, {}); }).to.throw(TypeError);
        expect(function () { return new Shepherd([], {}); }).to.throw(TypeError);
        expect(function () { return new Shepherd(1, {}); }).to.throw(TypeError);
        expect(function () { return new Shepherd(true, {}); }).to.throw(TypeError);
        expect(function () { return new Shepherd(NaN, {}); }).to.throw(TypeError);

        expect(function () { return new Shepherd('xxx'); }).not.to.throw(Error);
    });

    it('should throw if opts is given but not an object', function () {
        expect(function () { return new Shepherd('xxx', []); }).to.throw(TypeError);
        expect(function () { return new Shepherd('xxx', 1); }).to.throw(TypeError);
        expect(function () { return new Shepherd('xxx', true); }).to.throw(TypeError);

        expect(function () { return new Shepherd('xxx', {}); }).not.to.throw(Error);
    });
});

describe('Signature Check', function () {
    var shepherd;
    before(function () {
        shepherd = new Shepherd('/dev/ttyUSB0');
        shepherd._enabled = true;
    });

    describe('#.reset', function () {
        it('should throw if mode is not a number and not a string', function () {
            expect(function () { shepherd.reset({}); }).to.throw(TypeError);
            expect(function () { shepherd.reset(true); }).to.throw(TypeError);
        });
    });

    describe('#.permitJoin', function () {
        it('should throw if time is not a number', function () {
            expect(function () { shepherd.permitJoin({}); }).to.throw(TypeError);
            expect(function () { shepherd.permitJoin(true); }).to.throw(TypeError);
        });

        it('should throw if type is given but not a number and not a string', function () {
            expect(function () { shepherd.permitJoin({}); }).to.throw(TypeError);
            expect(function () { shepherd.permitJoin(true); }).to.throw(TypeError);
        });
    });

    describe('#.mount', function () {
        it('should throw if zApp is not an object', function () {
            expect(function () { shepherd.mount(true); }).to.throw(TypeError);
            expect(function () { shepherd.mount('ceed'); }).to.throw(TypeError);
        });
    });

    describe('#.list', function () {
        it('should throw if ieeeAddrs is not an array of strings', function () {
            expect(function () { shepherd.list({}); }).to.throw(TypeError);
            expect(function () { shepherd.list(true); }).to.throw(TypeError);
            expect(function () { shepherd.list([ 'ceed', {} ]); }).to.throw(TypeError);

            expect(function () { shepherd.list('ceed'); }).not.to.throw(Error);
            expect(function () { shepherd.list([ 'ceed', 'xxx' ]); }).not.to.throw(Error);
        });
    });

    describe('#.find', function () {
        it('should throw if addr is not a number and not a string', function () {
            expect(function () { shepherd.find({}, 1); }).to.throw(TypeError);
            expect(function () { shepherd.find(true, 1); }).to.throw(TypeError);
        });

        it('should throw if epId is not a number', function () {
            expect(function () { shepherd.find(1, {}); }).to.throw(TypeError);
            expect(function () { shepherd.find(1, true); }).to.throw(TypeError);
        });
    });

    describe('#.lqi', function () {
        it('should throw if ieeeAddr is not a string', function () {
            expect(function () { shepherd.lqi({}); }).to.throw(TypeError);
            expect(function () { shepherd.lqi(true); }).to.throw(TypeError);
            expect(function () { shepherd.lqi('ceed'); }).not.to.throw(TypeError);
        });
    });

    describe('#.remove', function () {
        it('should throw if ieeeAddr is not a string', function () {
            expect(function () { shepherd.remove({}); }).to.throw(TypeError);
            expect(function () { shepherd.remove(true); }).to.throw(TypeError);
            expect(function () { shepherd.remove('ceed'); }).not.to.throw(TypeError);
        });
    });
});

describe('Functional Check', function () {
    var shepherd = new Shepherd('/dev/ttyUSB0');

    shepherd.controller.request = function (subsys, cmdId, valObj, callback) {
        var deferred = Q.defer();
        process.nextTick(function () {
            deferred.resolve({ status: 0 });
        });

        return deferred.promise.nodeify(callback);
    };

    describe('#.permitJoin', function () {
        it('should throw if shepherd is not enabled when permitJoin invoked - shepherd is disabled.', function () {
            expect(function () { return shepherd.permitJoin(3); }).to.throw(Error);
        });

        it('should trigger permitJoin counter and event when permitJoin invoked - shepherd is enabled.', function (done) {
            shepherd._enabled = true;
            shepherd.on('permitJoining', function (joinTime) {
                shepherd._enabled = false;
                if (joinTime === 3)
                    done();
            });
            shepherd.permitJoin(3);
        });
    });

    describe('#.start', function () {
        this.timeout(6000);

        it('should start ok, _ready and reday should be fired, _enabled,', function (done) {
            var _readyCbCalled = false,
                readyCbCalled = false,
                startCbCalled = false,
                startStub = sinon.stub(shepherd, 'start', function (callback) {
                    var deferred = Q.defer();

                    shepherd._enabled = true;
                    shepherd.controller._coord = coordDev;
                    deferred.resolve();

                    setTimeout(function () {
                        shepherd.emit('_ready');
                    }, 50);

                    return deferred.promise.nodeify(callback);
                });

            shepherd.once('_ready', function () {
                _readyCbCalled = true;
                if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled)
                    setTimeout(function () {
                        startStub.restore();
                        done();
                    }, 200);
            });

            shepherd.once('ready', function () {
                readyCbCalled = true;
                if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled)
                    setTimeout(function () {
                        startStub.restore();
                        done();
                    }, 200);
            });

            shepherd.start(function (err) {
                startCbCalled = true;
                if (_readyCbCalled && readyCbCalled && startCbCalled && shepherd._enabled)
                    setTimeout(function () {
                        startStub.restore();
                        done();
                    }, 200);
            });
        });
    });

    describe('#.find', function () {
        it('should find nothing', function () {
            expect(shepherd.find('nothing', 1)).to.be.undefined;
        });
    });

    describe('#.list', function () {
        it('should list 2 devices', function (done) {
            shepherd._registerDev(dev1).then(function () {
                return shepherd._registerDev(dev2);
            }).then(function () {
                var devList = shepherd.list();
                expect(devList.length).to.be.equal(2);
                expect(devList[0].type).to.be.equal(1);
                expect(devList[0].ieeeAddr).to.be.equal('0x00137a00000161f2');
                expect(devList[0].nwkAddr).to.be.equal(100);
                expect(devList[0].manufId).to.be.equal(10);
                expect(devList[0].epList).to.be.deep.equal([ 1 ]);
                expect(devList[0].status).to.be.equal('offline');
                expect(devList[1].type).to.be.equal(1);
                expect(devList[1].ieeeAddr).to.be.equal('0x0123456789abcdef');
                expect(devList[1].nwkAddr).to.be.equal(200);
                expect(devList[1].manufId).to.be.equal(20);
                expect(devList[1].epList).to.be.deep.equal([ 1 ]);
                expect(devList[1].status).to.be.equal('offline');
                done();
            }).fail(function (err) {
                console.log(err);
            });
        });
    });

});
