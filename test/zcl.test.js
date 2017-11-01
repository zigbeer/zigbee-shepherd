var expect = require('chai').expect,
    zcl = require('../lib/components/zcl');

describe('APIs Arguments Check for Throwing Error', function() {
    describe('#.frame', function() {
        var frameCntl = {frameType:1, manufSpec: 0, direction: 0, disDefaultRsp: 1};

        it('should be a function', function () {
            expect(zcl.frame).to.be.a('function');
        });

        it('should throw TypeError if input frameCntl is not an object', function () {
            expect(function () { return zcl.frame(undefined, 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(null, 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(NaN, 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame([], 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(true, 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(new Date(), 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(function () {}, 0, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);

            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, 'genOnOff'); }).not.to.throw(TypeError);
        });

        it('should throw TypeError if input manufCode is not a number', function () {
            expect(function () { return zcl.frame(frameCntl, undefined, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, null, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, NaN, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, [], 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, true, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, new Date(), 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, function () {}, 0, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
        });

        it('should throw TypeError if input seqNum is not a number', function () {
            expect(function () { return zcl.frame(frameCntl, 0, undefined, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, null, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, NaN, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, [], 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, true, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, new Date(), 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, function () {}, 'toggle', {}, 'genOnOff'); }).to.throw(TypeError);
        });

        it('should throw TypeError if input cmd is not a number and not a string', function () {
            expect(function () { return zcl.frame(frameCntl, 0, 0, undefined, {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, null, {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, NaN, {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, [], {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, true, {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, new Date(), {}, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, function () {}, {}, 'genOnOff'); }).to.throw(TypeError);

            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, 'genOnOff'); }).not.to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 2, {}, 'genOnOff'); }).not.to.throw(TypeError);
        });

        it('should throw TypeError if input zclPayload is not an object and not an array', function () {
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', undefined, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', null, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', NaN, 'genOnOff'); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', true, 'genOnOff'); }).to.throw(TypeError);

            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, 'genOnOff'); }).not.to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', [], 'genOnOff'); }).not.to.throw(TypeError);
        });

        it('should throw TypeError if input clusterId is not a number and not a string', function () {
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, undefined); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, null); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, NaN); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, []); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, true); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, new Date()); }).to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, function () {}); }).to.throw(TypeError);

            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, 'genOnOff'); }).not.to.throw(TypeError);
            expect(function () { return zcl.frame(frameCntl, 0, 0, 'toggle', {}, 6); }).not.to.throw(TypeError);
        });
    });

    describe('#.parse', function() {
        var zclBuf = new Buffer([0x11, 0x00, 0x02]);

        it('should be a function', function () {
            expect(zcl.parse).to.be.a('function');
        });

        it('should throw TypeError if input zclBuf is not a buffer', function () {
            expect(function () { return zcl.parse(undefined, 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(null, 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(NaN, 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse([], 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(true, 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(new Date(), 0, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(function () {}, 0, function () {}); }).to.throw(TypeError);
        });

        it('should throw TypeError if input clusterId is not a number and not a string', function () {
            expect(function () { return zcl.parse(zclBuf, undefined, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, null, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, NaN, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, [], function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, true, function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, new Date(), function () {}); }).to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, function () {}, function () {}); }).to.throw(TypeError);

            expect(function () { return zcl.parse(zclBuf, 'genOnOff', function () {}); }).not.to.throw(TypeError);
            expect(function () { return zcl.parse(zclBuf, 6, function () {}); }).not.to.throw(TypeError);
        });
    });

    describe('#.header', function() {
        it('should be a function', function () {
            expect(zcl.header).to.be.a('function');
        });

        it('should throw TypeError if input buf is not a buffer', function () {
            expect(function () { return zcl.header(undefined); }).to.throw(TypeError);
            expect(function () { return zcl.header(null); }).to.throw(TypeError);
            expect(function () { return zcl.header(NaN); }).to.throw(TypeError);
            expect(function () { return zcl.header([]); }).to.throw(TypeError);
            expect(function () { return zcl.header(true); }).to.throw(TypeError);
            expect(function () { return zcl.header(new Date()); }).to.throw(TypeError);
            expect(function () { return zcl.header(function () {}); }).to.throw(TypeError);
        });
    });
});

describe('Module Methods Check', function() {
    describe('zcl foundation #.frame and #.parse Check', function () {
        var zclFrames = [
                {
                    frameCntl: {
                        frameType: 0,
                        manufSpec: 0,
                        direction: 0,
                        disDefaultRsp: 1
                    },
                    manufCode: 0,
                    seqNum: 0,
                    cmdId: 'writeUndiv',
                    payload: [
                        {attrId: 0x1234, dataType: 0x41, attrData: 'hello'},
                        {attrId: 0xabcd, dataType: 0x24, attrData: [100, 2406]},
                        {attrId: 0x1234, dataType: 0x08, attrData: 60}
                    ]
                },
                {
                    frameCntl: {
                        frameType: 0,
                        manufSpec: 1,
                        direction: 0,
                        disDefaultRsp: 1
                    },
                    manufCode: 0xaaaa,
                    seqNum: 1,
                    cmdId: 'configReport',
                    payload: [
                        {direction: 0, attrId: 0x0001, dataType: 0x20, minRepIntval: 500, maxRepIntval: 1000, repChange: 10},
                        {direction: 1, attrId: 0x0001, timeout: 999},
                        {direction: 0, attrId: 0x0001, dataType: 0x43, minRepIntval: 100, maxRepIntval: 200}
                    ]
                },
                {
                    frameCntl: {
                        frameType: 0,
                        manufSpec: 0,
                        direction: 1,
                        disDefaultRsp: 1
                    },
                    manufCode: 0,
                    seqNum: 2,
                    cmdId: 'writeStrcut',
                    payload: [
                        {attrId: 0x0011, selector: {indicator: 3, indexes: [0x0101, 0x0202, 0x0303]}, dataType: 0x21, attrData: 60000},
                        {attrId: 0x0022, selector: {indicator: 0}, dataType: 0x50, attrData: {elmType: 0x20, numElms: 3, elmVals: [1, 2, 3]}},
                        {attrId: 0x0033, selector: {indicator: 1, indexes: [0x0101]}, dataType: 0x4c, attrData: {numElms: 0x01, structElms: [{elmType: 0x20, elmVal: 1}]}}
                    ]
                }
            ];

        zclFrames.forEach(function(zclFrame) {
            var zBuf;

            it('zcl foundation framer and parser Check', function () {
                zBuf = zcl.frame(zclFrame.frameCntl, zclFrame.manufCode, zclFrame.seqNum, zclFrame.cmdId, zclFrame.payload);
                zcl.parse(zBuf, function (err, result) {
                    expect(result).to.eql(zclFrame);
                });
            });
        });
    });

    describe('zcl functional #.frame and #.parse Check', function () {
      var zclFrames = [
            {
                frameCntl: {
                    frameType: 1,
                    manufSpec: 0,
                    direction: 0,
                    disDefaultRsp: 1
                },
                manufCode: 0,
                seqNum: 0,
                cmdId: 'add',
                payload: {
                    groupid: 0x1234,
                    sceneid: 0x08,
                    transtime: 0x2468,
                    scenename: 'genscenes',
                    extensionfieldsets: [ { clstId: 0x0006, len: 0x3, extField: [0x01, 0x02, 0x03]}, 
                                          { clstId: 0x0009, len: 0x5, extField: [0x05, 0x04, 0x03, 0x02, 0x01]} ]
                }
            },
            {
                frameCntl: {
                    frameType: 1,
                    manufSpec: 1,
                    direction: 1,
                    disDefaultRsp: 0
                },
                manufCode: 0xaaaa,
                seqNum: 1,
                cmdId: 'addRsp',
                payload: {
                    status: 0x26,
                    groupId: 0xffff,
                    sceneId: 0x06
                }
            },
            {
                frameCntl: {
                    frameType: 1,
                    manufSpec: 0,
                    direction: 1,
                    disDefaultRsp: 1
                },
                manufCode: 0,
                seqNum: 2,
                cmdId: 'getSceneMembershipRsp',
                payload: {
                    status: 0x01,
                    capacity: 0x02,
                    groupid: 0x2468,
                    scenecount: 3,
                    scenelist: [0x22, 0x33, 0x56]
                }
            }
        ];

        zclFrames.forEach(function(zclFrame) {
            var zBuf;

            it('zcl functional framer and parser Check', function () {
                zBuf = zcl.frame(zclFrame.frameCntl, zclFrame.manufCode, zclFrame.seqNum, zclFrame.cmdId, zclFrame.payload, 0x0005);
                zcl.parse(zBuf, 0x0005, function (err, result) {
                    if (result.cmdId === 'add')
                        result.frameCntl.direction = 0;
                    else 
                        result.frameCntl.direction = 1;

                    expect(result).to.eql(zclFrame);
                });
            });
        });
    });

    describe('zcl #.header Check', function () {
        var headers = [
            {
                buf: new Buffer([ 0x00, 0x00, 0x00 ]),
                obj: {
                    frameCntl: { frameType: 0, manufSpec: 0, direction: 0, disDefaultRsp: 0 },
                    manufCode: null,
                    seqNum: 0,
                    cmdId: 0
                }
            },
            {
                buf: new Buffer([ 0x1d, 0x34, 0x12, 0xff, 0x01 ]),
                obj: {
                    frameCntl: { frameType: 1, manufSpec: 1, direction: 1, disDefaultRsp: 1 },
                    manufCode: 0x1234,
                    seqNum: 0xff,
                    cmdId: 0x01
                }
            },
        ];

        headers.forEach(function (header) {
            var result = zcl.header(header.buf);

            it('zcl header Check', function () {
                expect(result).to.eql(header.obj);
            });
        });
    });

    describe('zcl #.header Check - Bad command', function () {
        var headers = [
            {
                buf: new Buffer([ 0x1e, 0x34, 0x12, 0xff, 0x01 ])
            },
            {
                buf: new Buffer([ 0x1f, 0x34, 0x12, 0xff, 0x01 ])
            },
        ];

        headers.forEach(function (header) {
            var result = zcl.header(header.buf);
            it('zcl header Check', function () {
                expect(result).to.be.undefined;
            });
        });
    });

});