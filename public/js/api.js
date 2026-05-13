const API_BASE = `${window.location.origin}/api`;

async function readJson(response, fallback) {
    try {
        return await response.json();
    } catch (_error) {
        return fallback;
    }
}

export async function subscribe(email, repo, headers) {
    const response = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, repo }),
    });

    const data = await readJson(response, {});
    return { response, data };
}

export async function getSubscriptions(email, headers) {
    const response = await fetch(`${API_BASE}/subscriptions?email=${encodeURIComponent(email)}`, {
        headers,
    });

    const data = await readJson(response, []);
    return { response, data };
}

export async function unsubscribe(token, headers) {
    const response = await fetch(`${API_BASE}/unsubscribe/${encodeURIComponent(token)}`, {
        method: 'GET',
        headers,
    });

    const data = await readJson(response, {});
    return { response, data };
}
