var util = rquire('util');
var Endpoint = require('./endpoint');

function Coordpoint(info) {
    // coordpoint is a endpoint, but a "LOCAL" endpoint
    // This class is used to create delegators, local applications
    Endpoint.call(this, info);
}

util.inherits(Coordpoint, Endpoint);

