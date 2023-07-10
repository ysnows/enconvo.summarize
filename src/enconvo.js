import jsonrpc from 'jsonrpc-lite';
import http from 'http';
import EventEmitter from 'events';

let paramsList = [];
const paramsEmitter = new EventEmitter();

async function stream(params) {
    //把 string split成多个,每个最多10个字
    paramsList.push(params);
    paramsEmitter.emit("params");
}

let isRunning = false;

async function startMonitor() {
    paramsEmitter.on("params", async () => {
        if (!isRunning) {
            isRunning = true;
            while (paramsList.length > 0) {
                // console.log("paramsList:", paramsList.shift())
                await result("stream", paramsList.shift());
            }
            isRunning = false;
        }
    });
}

function result(method, params) {
    return new Promise((resolve, reject) => {

        const requestData = jsonrpc.request("123", method, params);

        const options = {
            hostname: '127.0.0.1', // 您的服务器地址
            port: 18080, // 服务器端口
            path: '/dynamic/jsonRpc', // 请求路径
            method: 'POST', // 使用 POST 方法
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(requestData)),
            },
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(data)
            });
        });

        req.on('error', (error) => {
            reject(error)
        });

        req.write(JSON.stringify(requestData));
        req.end();

    })
}

export {result, stream, startMonitor};
