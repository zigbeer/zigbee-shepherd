

// {
//     ieeeAddr: '0x123456789ABCDEF',
//     nwkAddr: '0x1111',
//     manufId: 44,
//     status: 0,
//     epList: [ 1, 2, 3, 4, 5 ],
//     endpoints: {
//         3: { id: 3, profId: 3, devId: 3, clusters: {
//                 55: { id: 55, dir: 1, attrList: [1, 2, 3], cmdList: [ 1, 2, 3 ] }
//             }
//         }
//     }
// }

// endpointInfo = {
//     endpointId : x,
//     profileId : x,
//     deviceId : x,
//     numIpClusters : x,
//     ipClusterList : [x, y, z, ...],
//     numOpClusters : x,
//     opClusterList : [x, y, z, ...]
// }


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