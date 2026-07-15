import {
    showAlert,
    hideAlert,
    getHeaders,
    escapeHtml,
    normalizeUnsubscribeToken,
} from './ui.js';
import {
    subscribe as subscribeRequest,
    getSubscriptions as getSubscriptionsRequest,
    unsubscribe as unsubscribeRequest,
} from './api.js';
import {
    NETWORK_ERROR_MESSAGE,
    UNSUBSCRIBE_NOT_FOUND_MESSAGE,
    UNSUBSCRIBE_PENDING_MESSAGE,
} from './constants.js';
import { alertApiError, withButtonLoading } from './utils.js';

function renderSubscriptions(listElement, subscriptions) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
        listElement.innerHTML = '<div class="empty-state">No subscriptions found 🤷</div>';
        return;
    }

    listElement.innerHTML = '';
    subscriptions.forEach((sub) => {
        const item = document.createElement('li');
        item.className = 'sub-item';
        item.innerHTML = `
                        <div>
                            <span class="repo">${escapeHtml(sub.repo)}</span>
                            <div class="tag">${sub.last_seen_tag ? `Last release: ${escapeHtml(sub.last_seen_tag)}` : 'No releases yet'}</div>
                        </div>
                        <div class="sub-actions">
                            <span class="badge ${sub.confirmed ? 'badge-confirmed' : 'badge-pending'}">
                                ${sub.confirmed ? '✓ Confirmed' : '⏳ Pending'}
                            </span>
                            ${sub.confirmed
        ? `<button type="button" class="btn btn-danger btn-unsubscribe" data-repo="${encodeURIComponent(sub.repo)}">Unsubscribe</button>`
        : ''}
                        </div>
                    `;
        listElement.appendChild(item);
    });
}

async function refreshSubscriptions(email, listElement, alertElement) {
    const { response, data } = await getSubscriptionsRequest(email, getHeaders('lookup-api-key'));

    if (!response.ok) {
        alertApiError(alertElement, response, data);
        return false;
    }

    renderSubscriptions(listElement, data);
    return true;
}

function attachSubscribeHandler(elements) {
    elements.subscribeForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const alertElement = elements.subscribeAlert;
        const button = elements.subscribeButton;
        hideAlert(alertElement);

        const email = elements.emailInput.value.trim();
        const repo = elements.repoInput.value.trim();

        if (!email || !repo) {
            showAlert(alertElement, 'error', 'Please fill in all fields');
            return;
        }

        await withButtonLoading(button, async () => {
            try {
                const { response, data } = await subscribeRequest(email, repo, getHeaders('api-key'));

                if (response.ok) {
                    showAlert(alertElement, 'success', data.message || 'Subscription created! Check your email to confirm.');
                    elements.subscribeForm.reset();
                    return;
                }

                if (response.status === 409) {
                    showAlert(alertElement, 'warning', data.error || 'You are already subscribed to this repository.');
                    return;
                }

                alertApiError(alertElement, response, data);
            } catch (_error) {
                showAlert(alertElement, 'error', NETWORK_ERROR_MESSAGE);
            }
        });
    });
}

function attachLookupHandler(elements) {
    elements.lookupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const alertElement = elements.lookupAlert;
        const button = elements.lookupButton;
        const listElement = elements.subscriptionsList;

        hideAlert(alertElement);
        listElement.innerHTML = '';

        const email = elements.lookupEmailInput.value.trim();
        if (!email) {
            showAlert(alertElement, 'error', 'Please enter your email');
            return;
        }

        await withButtonLoading(button, async () => {
            try {
                await refreshSubscriptions(email, listElement, alertElement);
            } catch (_error) {
                showAlert(alertElement, 'error', NETWORK_ERROR_MESSAGE);
            }
        });
    });
}

function attachUnsubscribeHandler(elements, unsubscribeModal) {
    elements.subscriptionsList.addEventListener('click', async (event) => {
        const button = event.target.closest('.btn-unsubscribe');
        if (!button) {
            return;
        }

        const listElement = elements.subscriptionsList;
        const alertElement = elements.lookupAlert;
        const email = elements.lookupEmailInput.value.trim();
        const repo = decodeURIComponent(button.dataset.repo || '');

        if (!email || !repo) {
            showAlert(alertElement, 'error', 'Please load subscriptions first.');
            return;
        }

        hideAlert(alertElement);

        const tokenInput = await unsubscribeModal.open(repo);
        const token = normalizeUnsubscribeToken(tokenInput);
        if (!token) {
            showAlert(alertElement, 'warning', 'Unsubscribe canceled. Token is required.');
            return;
        }

        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Removing...';

        try {
            const { response, data } = await unsubscribeRequest(token, getHeaders('lookup-api-key'));

            if (!response.ok) {
                if (response.status === 404) {
                    showAlert(alertElement, 'error', UNSUBSCRIBE_NOT_FOUND_MESSAGE);
                    return;
                }
                if (response.status === 409) {
                    showAlert(alertElement, 'warning', data.error || UNSUBSCRIBE_PENDING_MESSAGE);
                    return;
                }
                alertApiError(alertElement, response, data);
                return;
            }

            showAlert(alertElement, 'success', data.message || 'Unsubscribed successfully.');
            await refreshSubscriptions(email, listElement, alertElement);
        } catch (_error) {
            showAlert(alertElement, 'error', NETWORK_ERROR_MESSAGE);
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

export function setupSubscriptionHandlers(elements, unsubscribeModal) {
    attachSubscribeHandler(elements);
    attachLookupHandler(elements);
    attachUnsubscribeHandler(elements, unsubscribeModal);
}
