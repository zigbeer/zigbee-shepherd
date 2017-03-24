# zigbee-shepherd
An open source ZigBee gateway solution with node.js  

[![NPM](https://nodei.co/npm/zigbee-shepherd.png?downloads=true)](https://nodei.co/npm/zigbee-shepherd/)  

[![Travis branch](https://img.shields.io/travis/zigbeer/zigbee-shepherd/master.svg?maxAge=2592000)](https://travis-ci.org/zigbeer/zigbee-shepherd)
[![npm](https://img.shields.io/npm/v/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)
[![npm](https://img.shields.io/npm/l/zigbee-shepherd.svg?maxAge=2592000)](https://www.npmjs.com/package/zigbee-shepherd)

<br />

## Documentation  

Please visit the [Wiki](https://github.com/zigbeer/zigbee-shepherd/wiki).

<br />

## Overview  

**zigbee-shepherd** is an open source ZigBee gateway solution with node.js. It uses TI's [CC253X](http://www.ti.com/lsds/ti/wireless_connectivity/zigbee/overview.page) wireless SoC as a [zigbee network processor (ZNP)](http://www.ti.com/lit/an/swra444/swra444.pdf), and takes the ZNP approach with [cc-znp](https://github.com/zigbeer/cc-znp) to run the CC253X as a coordinator and to run zigbee-shepherd as the host.

* [**A simple demo webapp**](https://github.com/zigbeer/zigbee-demo#readme)

![ZigBee Network](https://raw.githubusercontent.com/zigbeer/documents/master/zigbee-shepherd/zigbee_net.png)

<br />

## Installation  

* Install zigbee-shepherd

> $ npm install zigbee-shepherd --save

* Hardware
    - [SmartRF05EB (with CC2530EM)](http://www.ti.com/tool/cc2530dk)  
    - [CC2531 USB Stick](http://www.ti.com/tool/cc2531emk)  
    - CC2538 (Not tested yet. I don't have the kit.)  
    - CC2630/CC2650 (Not tested yet. I don't have the kit.)  

* Firmware
    - To use CC2530/31 as the coordinator, please download the [**pre-built ZNP image**](https://github.com/zigbeer/documents/tree/master/zigbee-shepherd) to your chip first. The pre-built image has been compiled as a ZNP with ZDO callback, ZCL supports, and functions we need.  

<br />

## Usage  

```js
var ZShepherd = require('zigbee-shepherd');
var shepherd = new ZShepherd('/dev/ttyUSB0');  // create a ZigBee server

shepherd.on('ready', function () {
    console.log('Server is ready.');

    // allow devices to join the network within 60 secs
    shepherd.permitJoin(60, function (err) {
        if (err)
            console.log(err);
    }); 
});

shepherd.start(function (err) {                // start the server
    if (err)
        console.log(err);
});
```

<br />

## License  

Licensed under [MIT](https://github.com/zigbeer/zigbee-shepherd/blob/master/LICENSE).
