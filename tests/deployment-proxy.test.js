const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { test } = require("node:test");
const netlifyProxy = require("../netlify/functions/api-proxy.js");
const vercelProxy = require("../api/[...path].js");

async function withBackend(callback) {
    const received = [];
    const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        received.push({
            method: request.method,
            url: request.url,
            cookie: request.headers.cookie,
            body: Buffer.concat(chunks).toString()
        });
        response.writeHead(201, {
            "content-type": "application/json",
            "set-cookie": ["hx_access=access; Path=/; HttpOnly", "hx_refresh=refresh; Path=/; HttpOnly"]
        });
        response.end(JSON.stringify({ ok: true }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    process.env.API_BACKEND_URL = `http://127.0.0.1:${server.address().port}`;
    try {
        await callback(received);
    } finally {
        delete process.env.API_BACKEND_URL;
        server.close();
        await once(server, "close");
    }
}

test("Netlify proxy preserves path, method, cookies, and multiple Set-Cookie headers", async () => {
    await withBackend(async (received) => {
        const result = await netlifyProxy.handler({
            path: "/.netlify/functions/api-proxy/auth/login",
            queryStringParameters: { next: "home" },
            httpMethod: "POST",
            headers: {
                cookie: "guest=1",
                "content-type": "application/json",
                "x-requested-with": "HeritageX"
            },
            body: JSON.stringify({ email: "visitor@example.test" }),
            isBase64Encoded: false
        });

        assert.equal(result.statusCode, 201);
        assert.equal(received[0].url, "/api/auth/login?next=home");
        assert.equal(received[0].method, "POST");
        assert.equal(received[0].cookie, "guest=1");
        assert.deepEqual(JSON.parse(received[0].body), { email: "visitor@example.test" });
        assert.equal(result.headers["set-cookie"].length, 2);
    });
});

test("Vercel proxy preserves query, request cookies, and response cookies", async () => {
    await withBackend(async (received) => {
        const headers = {};
        let status;
        let body;
        const response = {
            status(code) { status = code; return this; },
            setHeader(name, value) { headers[name.toLowerCase()] = value; },
            send(value) { body = value; return this; },
            json(value) { body = value; return this; }
        };

        await vercelProxy({
            url: "/api/auth/login?next=home",
            method: "POST",
            headers: {
                host: "heritagex.example.test",
                cookie: "guest=1",
                "content-type": "application/json",
                "x-requested-with": "HeritageX"
            },
            body: { email: "visitor@example.test" }
        }, response);

        assert.equal(status, 201);
        assert.equal(received[0].url, "/api/auth/login?next=home");
        assert.equal(received[0].cookie, "guest=1");
        assert.deepEqual(JSON.parse(received[0].body), { email: "visitor@example.test" });
        assert.equal(headers["set-cookie"].length, 2);
        assert.deepEqual(JSON.parse(body.toString()), { ok: true });
    });
});

test("deployment proxies fail explicitly when API_BACKEND_URL is unset", async () => {
    delete process.env.API_BACKEND_URL;
    const netlify = await netlifyProxy.handler({
        path: "/.netlify/functions/api-proxy/health",
        httpMethod: "GET",
        headers: {}
    });
    const vercel = {};
    let status;
    let responseBody;
    await vercelProxy({ url: "/api/health", method: "GET", headers: { host: "localhost" } }, {
        status(code) { status = code; return this; },
        json(body) { responseBody = body; return this; }
    });

    assert.equal(netlify.statusCode, 503);
    assert.equal(JSON.parse(netlify.body).error.code, "API_BACKEND_NOT_CONFIGURED");
    assert.equal(status, 503);
    assert.equal(responseBody.error.code, "API_BACKEND_NOT_CONFIGURED");
});
