const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../proto/notification/v1/notification.proto');

const LOADER_OPTIONS = {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
};

const packageDefinition = protoLoader.loadSync(PROTO_PATH, LOADER_OPTIONS);
const proto = grpc.loadPackageDefinition(packageDefinition);

module.exports = {
    notificationProto: proto.notification.v1,
    PROTO_PATH,
};
