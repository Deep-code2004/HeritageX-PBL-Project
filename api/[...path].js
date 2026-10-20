const FORWARDED_HEADERS = ["accept", "content-type", "cookie", "origin", "x-requested-with"];

module.exports = async (req, res) => {
    const backend = process.env.API_BACKEND_URL;
    if (!backend) {
        return res.status(503).json({
            success: false,
            error: { code: "API_BACKEND_NOT_CONFIGURED", message: "The API backend is not configured." }
        });
    }

    const requestUrl = new URL(req.url, `https://${req.headers.host}`);
    const apiPath = requestUrl.pathname.replace(/^\/api/, "");
    const headers = new Headers();
    FORWARDED_HEADERS.forEach((name) => {
        const value = req.headers[name];
        if (value) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    });
    const method = req.method.toUpperCase();
    const body = ["GET", "HEAD"].includes(method) || req.body === undefined
        ? undefined
        : (typeof req.body === "string" || Buffer.isBuffer(req.body)
            ? req.body
            : JSON.stringify(req.body));

    try {
        const response = await fetch(`${backend.replace(/\/+$/, "")}/api${apiPath}${requestUrl.search}`, {
            method,
            headers,
            body,
            redirect: "manual"
        });
        const contentType = response.headers.get("content-type");
        const cacheControl = response.headers.get("cache-control");
        if (contentType) res.setHeader("content-type", contentType);
        if (cacheControl) res.setHeader("cache-control", cacheControl);
        const cookies = response.headers.getSetCookie?.() || [];
        if (cookies.length) res.setHeader("set-cookie", cookies);
        return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error("API proxy request failed:", error);
        return res.status(502).json({
            success: false,
            error: { code: "API_BACKEND_UNAVAILABLE", message: "The API backend could not be reached." }
        });
    }
};
