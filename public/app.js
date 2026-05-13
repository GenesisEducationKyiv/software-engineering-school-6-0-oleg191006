import {
    initTabs,
    syncApiKeyInputs,
} from './js/ui.js';
import { createUnsubscribeModalController } from './js/modal.js';
import { setupSubscriptionHandlers } from './js/subscriptionController.js';

const elements = {
    subscribeForm: document.getElementById('subscribe-form'),
    subscribeAlert: document.getElementById('subscribe-alert'),
    subscribeButton: document.getElementById('subscribe-btn'),
    emailInput: document.getElementById('email'),
    repoInput: document.getElementById('repo'),
    lookupForm: document.getElementById('lookup-form'),
    lookupAlert: document.getElementById('lookup-alert'),
    lookupButton: document.getElementById('lookup-btn'),
    lookupEmailInput: document.getElementById('lookup-email'),
    subscriptionsList: document.getElementById('sub-list'),
};

initTabs();
syncApiKeyInputs();

const unsubscribeModal = createUnsubscribeModalController({
    modal: document.getElementById('unsubscribe-modal'),
    repoLabel: document.getElementById('unsubscribe-modal-repo'),
    tokenInput: document.getElementById('unsubscribe-token-input'),
    confirmButton: document.getElementById('unsubscribe-confirm-btn'),
    cancelButton: document.getElementById('unsubscribe-cancel-btn'),
});

setupSubscriptionHandlers(elements, unsubscribeModal);
