const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const express = require('express');
const autocannon = require('autocannon');
const path = require('path');

const PROTO_PATH = path.resolve(__dirname, '../proto/notification/v1/notification.proto');
const GRPC_HOST = '127.0.0.1';
const DURATION_SECONDS = 10;
const LEVELS = [10, 100, 1000];

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false, longs: String, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition);
const notificationProto = proto.notification.v1;

function startRestServer() {
    return new Promise((resolve) => {
        const app = express();
        app.use(express.json());
        app.post('/api/notify/confirmation', (_req, res) => res.json({ success: true }));
        const server = app.listen(0, GRPC_HOST, () => {
            resolve({ server, port: server.address().port });
        });
    });
}

function startGrpcServer() {
    return new Promise((resolve, reject) => {
        const server = new grpc.Server();
        server.addService(notificationProto.NotificationService.service, {
            sendConfirmation: (_call, cb) => cb(null, { success: true }),
            sendReleaseNotification: (_call, cb) => cb(null, { success: true }),
        });
        server.bindAsync(`${GRPC_HOST}:0`, grpc.ServerCredentials.createInsecure(), (err, port) => {
            if (err) {return reject(err);}
            resolve({ server, port });
        });
    });
}

async function benchmarkRest(port, connections) {
    const result = await autocannon({
        url: `http://${GRPC_HOST}:${port}/api/notify/confirmation`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: 'bench@example.com',
            repo: 'owner/repo',
            confirmUrl: 'http://localhost:3000/api/confirm/token',
            unsubscribeToken: 'unsub-token',
        }),
        duration: DURATION_SECONDS,
        connections,
        silent: true,
    });
    return {
        rps: Math.round(result.requests.average),
        total: result.requests.total,
        latAvg: result.latency.average,
        latP50: result.latency.p50,
        latP99: result.latency.p99,
        errors: result.errors,
    };
}

async function benchmarkGrpc(port, connections) {
    const clients = Array.from({ length: connections }, () =>
        new notificationProto.NotificationService(
            `${GRPC_HOST}:${port}`, grpc.credentials.createInsecure(),
        ),
    );

    const request = {
        to: 'bench@example.com',
        repo: 'owner/repo',
        confirmUrl: 'http://localhost:3000/api/confirm/token',
        unsubscribeToken: 'unsub-token',
    };

    let totalRequests = 0;
    let totalErrors = 0;
    const latencies = [];
    const startTime = Date.now();
    const endTime = startTime + DURATION_SECONDS * 1000;

    await Promise.all(clients.map(async (client) => {
        while (Date.now() < endTime) {
            const t0 = process.hrtime.bigint();
            try {
                await new Promise((resolve, reject) => {
                    client.sendConfirmation(request, (err, res) => {
                        if (err) {return reject(err);}
                        resolve(res);
                    });
                });
                latencies.push(Number(process.hrtime.bigint() - t0) / 1e6);
                totalRequests++;
            } catch {
                totalErrors++;
            }
        }
    }));

    const elapsed = (Date.now() - startTime) / 1000;
    latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    clients.forEach((c) => grpc.closeClient(c));

    return {
        rps: Math.round(totalRequests / elapsed),
        total: totalRequests,
        latAvg: +avg.toFixed(2),
        latP50: +(latencies[Math.floor(latencies.length * 0.5)] ?? 0).toFixed(2),
        latP99: +(latencies[Math.floor(latencies.length * 0.99)] ?? 0).toFixed(2),
        errors: totalErrors,
    };
}

async function main() {
    console.log('=== gRPC vs REST Throughput Benchmark ===');
    console.log(`Duration per run: ${DURATION_SECONDS}s | Connection levels: ${LEVELS.join(', ')}\n`);

    const rest = await startRestServer();
    const grpcSrv = await startGrpcServer();

    const results = [];

    for (const connections of LEVELS) {
        process.stdout.write(`Running ${connections} connections... `);

        const restR = await benchmarkRest(rest.port, connections);
        const grpcR = await benchmarkGrpc(grpcSrv.port, connections);

        results.push({ connections, restR, grpcR });
        console.log(`REST ${restR.rps} rps | gRPC ${grpcR.rps} rps`);
    }

    rest.server.close();
    grpcSrv.server.forceShutdown();

    console.log('\n=== SUMMARY ===\n');
    console.log('Connections | Protocol | Req/sec | Lat avg | Lat p50 | Lat p99 | Errors');
    console.log('------------|----------|---------|---------|---------|---------|-------');
    for (const { connections, restR, grpcR } of results) {
        const pad = (v, n = 7) => String(v).padStart(n);
        console.log(`${String(connections).padEnd(11)} | REST     | ${pad(restR.rps)} | ${pad(restR.latAvg)} | ${pad(restR.latP50)} | ${pad(restR.latP99)} | ${restR.errors}`);
        console.log(`${' '.repeat(11)} | gRPC     | ${pad(grpcR.rps)} | ${pad(grpcR.latAvg)} | ${pad(grpcR.latP50)} | ${pad(grpcR.latP99)} | ${grpcR.errors}`);
        const ratio = (grpcR.rps / restR.rps).toFixed(2);
        console.log(`${' '.repeat(11)} | ratio    | ${ratio}x`);
        console.log('------------|----------|---------|---------|---------|---------|-------');
    }

    return results;
}

main().catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
