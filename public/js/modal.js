export function createUnsubscribeModalController(elements) {
    const {
        modal,
        repoLabel,
        tokenInput,
        confirmButton,
        cancelButton,
    } = elements;

    let resolver = null;

    if (!modal || !repoLabel || !tokenInput || !confirmButton || !cancelButton) {
        return {
            open: async () => null,
        };
    }

    const close = (value = null) => {
        if (!resolver) {
            return;
        }

        const nextResolve = resolver;
        resolver = null;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        tokenInput.value = '';
        nextResolve(value);
    };

    confirmButton.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        close(token || null);
    });

    cancelButton.addEventListener('click', () => close());

    modal.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement && event.target.dataset.closeModal === 'true') {
            close();
        }
    });

    tokenInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmButton.click();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && resolver) {
            close();
        }
    });

    return {
        open: (repo) => new Promise((resolve) => {
            if (resolver) {
                resolver(null);
            }

            resolver = resolve;
            repoLabel.textContent = `Repository: ${repo}`;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            tokenInput.focus();
        }),
    };
}
