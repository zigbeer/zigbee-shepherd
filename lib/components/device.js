function Device(devInfo) {

}


// what a device should have
// {
//     _id: db,
//     type: device type,  // distingush Coord(0), Router(1), and End Device(2, default)
//     endpoints: [],
//     address: {
//         ieee: 'xxxx',
//         network: 'xxxx'
//     },
// }

// what an endpoint should have
// {
//     inClisters: [],
//     outClusters: [],
//     epId: 3,
//     zclSupport: true,
//     publicProfile: true,    // standard ZigBee app profile : 0x0000-0x7FFFF

// }

// what a cluster should have
// {
//     cId: 3,
//     direction: 'in'
// }
