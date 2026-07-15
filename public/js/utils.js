import { showAlert, setLoading } from './ui.js';

export function alertApiError(alertElement, response, data, defaultType = 'error') {
    const typeByStatus = {
        409: defaultType === 'warning' ? 'warning' : 'error',
    };

    const type = typeByStatus[response.status] || defaultType;
    showAlert(alertElement, type, data.error || `Error: ${response.status}`);
}

export async function withButtonLoading(button, callback) {
    setLoading(button, true);
    try {
        await callback();
    } finally {
        setLoading(button, false);
    }
}
