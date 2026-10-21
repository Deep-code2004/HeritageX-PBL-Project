const FORWARDED_HEADERS = ["accept", "content-type", "cookie", "origin", "x-requested-with"];

exports.handler = async (event) => {
    const backend = process.env.API_BACKEND_URL;
    if (!backend) {
        return {
            statusCode: 503,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                success: false,
                error: { code: "API_BACKEND_NOT_CONFIGURED", message: "The API backend is not configured." }
            })
        };
    }

    const prefix = "/.netlify/functions/api-proxy";
    const path = event.path.startsWith(prefix) ? event.path.slice(prefix.length) : "";
    const rawQuery = event.rawQuery ||
        new URLSearchParams(event.queryStringParameters || {}).toString();
    const query = rawQuery ? `?${rawQuery.replace(/^\?/, "")}` : "";
    const headers = new Headers();
    FORWARDED_HEADERS.forEach((name) => {
        if (event.headers[name]) headers.set(name, event.headers[name]);
    });
    const body = event.body
        ? (event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body)
        : undefined;
    const method = event.httpMethod.toUpperCase();

    try {
        const response = await fetch(`${backend.replace(/\/+$/, "")}/api${path}${query}`, {
            method,
            headers,
            body: ["GET", "HEAD"].includes(method) ? undefined : body,
            redirect: "manual"
        });
        const responseHeaders = {};
        ["content-type", "cache-control"].forEach((name) => {
            const value = response.headers.get(name);
            if (value) responseHeaders[name] = value;
        });
        const cookies = response.headers.getSetCookie?.() || [];
        if (cookies.length) responseHeaders["set-cookie"] = cookies;
        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: await response.text(),
            isBase64Encoded: false
        };
    } catch (error) {
        console.error("API proxy request failed:", error);
        return {
            statusCode: 502,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                success: false,
                error: { code: "API_BACKEND_UNAVAILABLE", message: "The API backend could not be reached." }
            })
        };
    }
};
