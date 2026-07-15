const fs = require('fs');
const path = require('path');
const { LAYERS, LAYER_HIERARCHY, FILE_LAYER_MAP, isViolation, getAllowedDependencies } = require('../../../docs/architecture-layers');
const { createArchitectureTestHelpers } = require('../../scripts/testUtils');


const ROOT = path.resolve(__dirname, '..', '..', '..');

const { getMappedDependencies } = createArchitectureTestHelpers({
    root: ROOT,
    fileLayerMap: FILE_LAYER_MAP,
});

describe('Architecture Layer Dependencies', () => {
    describe('Layer hierarchy is well-defined', () => {
        it('should have exactly 4 layers', () => {
            expect(LAYER_HIERARCHY).toHaveLength(4);
        });

        it('should define layers in order: presentation → application → infrastructure → shared', () => {
            expect(LAYER_HIERARCHY).toEqual([
                LAYERS.PRESENTATION,
                LAYERS.APPLICATION,
                LAYERS.INFRASTRUCTURE,
                LAYERS.SHARED,
            ]);
        });

        it('should assign every mapped file to a valid layer', () => {
            for (const [, layer] of Object.entries(FILE_LAYER_MAP)) {
                expect(LAYER_HIERARCHY).toContain(layer);
            }
        });
    });

    describe('Allowed dependencies', () => {
        it('presentation layer can depend on all layers', () => {
            expect(getAllowedDependencies(LAYERS.PRESENTATION)).toEqual([
                LAYERS.PRESENTATION, LAYERS.APPLICATION, LAYERS.INFRASTRUCTURE, LAYERS.SHARED,
            ]);
        });

        it('application layer cannot depend on presentation', () => {
            const allowed = getAllowedDependencies(LAYERS.APPLICATION);
            expect(allowed).not.toContain(LAYERS.PRESENTATION);
            expect(allowed).toContain(LAYERS.APPLICATION);
            expect(allowed).toContain(LAYERS.INFRASTRUCTURE);
            expect(allowed).toContain(LAYERS.SHARED);
        });

        it('infrastructure layer cannot depend on presentation or application', () => {
            const allowed = getAllowedDependencies(LAYERS.INFRASTRUCTURE);
            expect(allowed).not.toContain(LAYERS.PRESENTATION);
            expect(allowed).not.toContain(LAYERS.APPLICATION);
            expect(allowed).toContain(LAYERS.INFRASTRUCTURE);
            expect(allowed).toContain(LAYERS.SHARED);
        });

        it('shared layer can only depend on itself', () => {
            expect(getAllowedDependencies(LAYERS.SHARED)).toEqual([LAYERS.SHARED]);
        });
    });

    // Generic factory for the three "no upward dependency" describe-blocks —
    // they only ever differed by which layer's files they scanned.
    function describeNoUpwardDependency(layer, label) {
        describe(`${label} has no upward dependencies`, () => {
            const files = Object.entries(FILE_LAYER_MAP)
                .filter(([, l]) => l === layer)
                .map(([file]) => file);

            files.forEach((sourceFile) => {
                it(`${sourceFile} should not import disallowed layers`, () => {
                    const violations = getMappedDependencies(sourceFile)
                        .filter((dep) => isViolation(layer, dep.targetLayer));

                    expect(violations).toEqual([]);
                });
            });
        });
    }

    describeNoUpwardDependency(LAYERS.SHARED, 'Shared layer');
    describeNoUpwardDependency(LAYERS.INFRASTRUCTURE, 'Infrastructure layer');
    describeNoUpwardDependency(LAYERS.APPLICATION, 'Application layer');

    describe('All mapped source files exist', () => {
        Object.keys(FILE_LAYER_MAP).forEach((file) => {
            it(`${file} should exist on disk`, () => {
                const absolutePath = path.resolve(ROOT, file);
                expect(fs.existsSync(absolutePath)).toBe(true);
            });
        });
    });

    describe('No circular dependencies between layers', () => {
        it('should not have any layer depending on a higher layer', () => {
            const allViolations = [];

            for (const [sourceFile, sourceLayer] of Object.entries(FILE_LAYER_MAP)) {
                const violations = getMappedDependencies(sourceFile)
                    .filter((dep) => isViolation(sourceLayer, dep.targetLayer))
                    .map((dep) => ({
                        source: sourceFile,
                        sourceLayer,
                        import: dep.import,
                        target: dep.resolvedTo,
                        targetLayer: dep.targetLayer,
                        rule: `${sourceLayer} → ${dep.targetLayer} is forbidden`,
                    }));

                allViolations.push(...violations);
            }

            if (allViolations.length > 0) {
                const report = allViolations.map((v) =>
                    `  ${v.source} (${v.sourceLayer}) → ${v.target} (${v.targetLayer}): ${v.rule}`,
                ).join('\n');
                throw new Error(`Architecture violations found:\n${report}`);
            }
        });
    });

    describe('Layer coverage', () => {
        it('each layer should have at least one file mapped', () => {
            for (const layer of LAYER_HIERARCHY) {
                const files = Object.entries(FILE_LAYER_MAP)
                    .filter(([, l]) => l === layer);
                expect(files.length).toBeGreaterThan(0);
            }
        });

        it('presentation layer should contain routes and middleware', () => {
            const presentationFiles = Object.entries(FILE_LAYER_MAP)
                .filter(([, l]) => l === LAYERS.PRESENTATION)
                .map(([f]) => f);

            const hasRoutes = presentationFiles.some((f) => f.includes('Routes') || f.includes('routes'));
            const hasMiddleware = presentationFiles.some((f) => f.includes('middleware'));
            expect(hasRoutes).toBe(true);
            expect(hasMiddleware).toBe(true);
        });

        it('application layer should contain services', () => {
            const appFiles = Object.entries(FILE_LAYER_MAP)
                .filter(([, l]) => l === LAYERS.APPLICATION)
                .map(([f]) => f);

            const hasServices = appFiles.some((f) => f.includes('Service') || f.includes('service'));
            expect(hasServices).toBe(true);
        });

        it('infrastructure layer should contain repositories', () => {
            const infraFiles = Object.entries(FILE_LAYER_MAP)
                .filter(([, l]) => l === LAYERS.INFRASTRUCTURE)
                .map(([f]) => f);

            const hasRepos = infraFiles.some((f) => f.includes('Repository') || f.includes('repository'));
            expect(hasRepos).toBe(true);
        });

        it('shared layer should contain config and utilities', () => {
            const sharedFiles = Object.entries(FILE_LAYER_MAP)
                .filter(([, l]) => l === LAYERS.SHARED)
                .map(([f]) => f);

            const hasConfig = sharedFiles.some((f) => f.includes('config'));
            const hasUtils = sharedFiles.some((f) => f.includes('utils') || f.includes('logger') || f.includes('constants'));
            expect(hasConfig).toBe(true);
            expect(hasUtils).toBe(true);
        });
    });
});