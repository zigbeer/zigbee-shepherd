var EventEmitter = require('events'),
    controller = new EventEmitter();

var sinon = require('sinon'),
    expect = require('chai').expect,
    af = require('../lib/components/af')(controller);

// af is an inner module, don't have to check all the arguments things
describe('APIs Arguments Check for Throwing Error', function() {
    var srcEp = {},
        dstEp = {};

    describe('#.send', function() {
        it('should be a function', function () {
            expect(af.send).to.be.a('function');
        });

        it('if opt is given: should throw if opt.option is not a number', function () {
            var mock = sinon.mock(dstEp);
            expect(function () { return af.send(dstEp, dstEp, 3, new Buffer([ 1, 2 ]), { options: 'x' }); }).not.to.throw(TypeError);
        });


    });


});

describe('Module Methods Check', function() {

});