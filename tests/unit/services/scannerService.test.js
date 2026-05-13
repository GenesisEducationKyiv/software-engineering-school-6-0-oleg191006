const { scanForNewReleases, checkRepoForNewRelease } = require('@/services/scannerService');
const subscriptionRepo = require('@/repositories/subscriptionRepository');
const repoRepo = require('@/repositories/repoRepository');
const githubService = require('@/services/githubService');
const emailService = require('@/services/emailService');

jest.mock('@/repositories/subscriptionRepository');
jest.mock('@/repositories/repoRepository');
jest.mock('@/services/githubService');
jest.mock('@/services/emailService');

afterEach(() => {
    jest.clearAllMocks();
});

describe('scanForNewReleases', () => {
    it('should do nothing when there are no confirmed subscriptions', async () => {
        subscriptionRepo.getDistinctConfirmedRepos.mockResolvedValue([]);

        await scanForNewReleases();

        expect(githubService.getLatestRelease).not.toHaveBeenCalled();
    });

    it('should check each distinct repo', async () => {
        subscriptionRepo.getDistinctConfirmedRepos.mockResolvedValue(['golang/go', 'nodejs/node']);
        githubService.getLatestRelease.mockResolvedValue(null);

        await scanForNewReleases();

        expect(githubService.getLatestRelease).toHaveBeenCalledTimes(2);
    });

    it('should continue checking other repos if one fails', async () => {
        subscriptionRepo.getDistinctConfirmedRepos.mockResolvedValue(['fail/repo', 'ok/repo']);
        githubService.getLatestRelease
            .mockRejectedValueOnce(new Error('API error'))
            .mockResolvedValueOnce(null);

        await scanForNewReleases();

        expect(githubService.getLatestRelease).toHaveBeenCalledTimes(2);
    });
});

describe('checkRepoForNewRelease', () => {
    const repo = 'golang/go';
    const release = {
        tag: 'v1.22.0',
        name: 'Go 1.22.0',
        url: 'https://github.com/golang/go/releases/tag/v1.22.0',
        publishedAt: '2024-06-01T00:00:00Z',
    };

    it('should skip when there are no releases', async () => {
        githubService.getLatestRelease.mockResolvedValue(null);

        await checkRepoForNewRelease(repo);

        expect(repoRepo.upsert).not.toHaveBeenCalled();
    });

    it('should skip when tag is the same as cached', async () => {
        githubService.getLatestRelease.mockResolvedValue(release);
        repoRepo.findByRepo.mockResolvedValue({ last_seen_tag: 'v1.22.0' });

        await checkRepoForNewRelease(repo);

        expect(repoRepo.upsert).not.toHaveBeenCalled();
        expect(emailService.sendReleaseNotification).not.toHaveBeenCalled();
    });

    it('should notify subscribers when new release is detected', async () => {
        githubService.getLatestRelease.mockResolvedValue(release);
        repoRepo.findByRepo.mockResolvedValue({ last_seen_tag: 'v1.21.0' });
        repoRepo.upsert.mockResolvedValue();
        subscriptionRepo.findConfirmedByRepo.mockResolvedValue([
            { id: 1, email: 'user1@example.com', last_seen_tag: 'v1.21.0', unsubscribe_token: 'tok1' },
            { id: 2, email: 'user2@example.com', last_seen_tag: 'v1.21.0', unsubscribe_token: 'tok2' },
        ]);
        emailService.sendReleaseNotification.mockResolvedValue();
        subscriptionRepo.updateLastSeenTag.mockResolvedValue();

        await checkRepoForNewRelease(repo);

        expect(repoRepo.upsert).toHaveBeenCalledWith(repo, 'v1.22.0');
        expect(emailService.sendReleaseNotification).toHaveBeenCalledTimes(2);
        expect(subscriptionRepo.updateLastSeenTag).toHaveBeenCalledTimes(2);
        expect(subscriptionRepo.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.22.0');
        expect(subscriptionRepo.updateLastSeenTag).toHaveBeenCalledWith(2, 'v1.22.0');
    });

    it('should skip subscriber whose last_seen_tag already matches', async () => {
        githubService.getLatestRelease.mockResolvedValue(release);
        repoRepo.findByRepo.mockResolvedValue({ last_seen_tag: 'v1.20.0' });
        repoRepo.upsert.mockResolvedValue();
        subscriptionRepo.findConfirmedByRepo.mockResolvedValue([
            { id: 1, email: 'user@example.com', last_seen_tag: 'v1.22.0', unsubscribe_token: 'tok1' },
        ]);

        await checkRepoForNewRelease(repo);

        expect(emailService.sendReleaseNotification).not.toHaveBeenCalled();
        expect(subscriptionRepo.updateLastSeenTag).not.toHaveBeenCalled();
    });

    it('should handle first-time check (no cached repo)', async () => {
        githubService.getLatestRelease.mockResolvedValue(release);
        repoRepo.findByRepo.mockResolvedValue(null);
        repoRepo.upsert.mockResolvedValue();
        subscriptionRepo.findConfirmedByRepo.mockResolvedValue([
            { id: 1, email: 'user@example.com', last_seen_tag: null, unsubscribe_token: 'tok1' },
        ]);
        emailService.sendReleaseNotification.mockResolvedValue();
        subscriptionRepo.updateLastSeenTag.mockResolvedValue();

        await checkRepoForNewRelease(repo);

        expect(repoRepo.upsert).toHaveBeenCalledWith(repo, 'v1.22.0');
        expect(emailService.sendReleaseNotification).toHaveBeenCalledTimes(1);
    });

    it('should continue notifying other subscribers if one fails', async () => {
        githubService.getLatestRelease.mockResolvedValue(release);
        repoRepo.findByRepo.mockResolvedValue({ last_seen_tag: 'v1.21.0' });
        repoRepo.upsert.mockResolvedValue();
        subscriptionRepo.findConfirmedByRepo.mockResolvedValue([
            { id: 1, email: 'fail@example.com', last_seen_tag: 'v1.21.0', unsubscribe_token: 'tok1' },
            { id: 2, email: 'ok@example.com', last_seen_tag: 'v1.21.0', unsubscribe_token: 'tok2' },
        ]);
        emailService.sendReleaseNotification
            .mockRejectedValueOnce(new Error('SMTP error'))
            .mockResolvedValueOnce();
        subscriptionRepo.updateLastSeenTag.mockResolvedValue();

        await checkRepoForNewRelease(repo);

        expect(emailService.sendReleaseNotification).toHaveBeenCalledTimes(2);
        expect(subscriptionRepo.updateLastSeenTag).toHaveBeenCalledTimes(1);
        expect(subscriptionRepo.updateLastSeenTag).toHaveBeenCalledWith(2, 'v1.22.0');
    });
});
