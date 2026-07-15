export function initTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
            document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.panel).classList.add('active');
        });
    });
}

export function showAlert(element, type, message) {
    element.className = `alert show alert-${type}`;
    element.textContent = message;
}

export function hideAlert(element) {
    element.className = 'alert';
    element.textContent = '';
}

export function setLoading(button, loading) {
    if (loading) {
        button.disabled = true;
        button._originalText = button.textContent;
        button.innerHTML = '<span class="spinner"></span> Loading...';
        return;
    }

    button.disabled = false;
    button.textContent = button._originalText || button.textContent;
}

export function getHeaders(apiKeyInputId) {
    const headers = { 'Content-Type': 'application/json' };
    const primaryKey = document.getElementById(apiKeyInputId)?.value?.trim();
    const fallbackId = apiKeyInputId === 'api-key' ? 'lookup-api-key' : 'api-key';
    const fallbackKey = document.getElementById(fallbackId)?.value?.trim();
    const key = primaryKey || fallbackKey;

    if (key) {
        headers['X-API-Key'] = key;
    }

    return headers;
}

export function syncApiKeyInputs() {
    const subscribeKeyInput = document.getElementById('api-key');
    const lookupKeyInput = document.getElementById('lookup-api-key');

    if (!subscribeKeyInput || !lookupKeyInput) {
        return;
    }

    subscribeKeyInput.addEventListener('input', () => {
        lookupKeyInput.value = subscribeKeyInput.value;
    });

    lookupKeyInput.addEventListener('input', () => {
        subscribeKeyInput.value = lookupKeyInput.value;
    });
}

export function escapeHtml(value) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(value));
    return div.innerHTML;
}

export function normalizeUnsubscribeToken(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') {
        return '';
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
        return '';
    }

    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }

    try {
        const url = new URL(trimmed);
        const segments = url.pathname.split('/').filter(Boolean);
        return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : '';
    } catch (_error) {
        return trimmed;
    }
}
