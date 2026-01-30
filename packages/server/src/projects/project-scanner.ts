import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ProjectMetadata, TechStackEntry, FolderMapping, EntryPoint,
  PackageManager, MonorepoTool, LintingConfig, BuildConfig,
  TestingStrategy, CiCdPipeline, ProjectScript, ArchitecturePattern,
} from '@cloudscode/shared';
import { getAuthInfo } from '../auth/api-key-provider.js';
import { logger } from '../logger.js';

export class ProjectScanner {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run a full scan and return partial metadata.
   * The caller decides whether to merge/save the result.
   */
  async fullScan(): Promise<ProjectMetadata> {
    const metadata: ProjectMetadata = {};

    // Run all static analyses
    Object.assign(metadata, this.detectTechStack());
    Object.assign(metadata, this.detectPackageManager());
    Object.assign(metadata, this.detectMonorepoTool());
    Object.assign(metadata, this.detectFolderStructure());
    Object.assign(metadata, this.detectEntryPoints());
    Object.assign(metadata, this.detectScripts());
    Object.assign(metadata, this.detectBuildConfig());
    Object.assign(metadata, this.detectLinting());
    Object.assign(metadata, this.detectTesting());
    Object.assign(metadata, this.detectCiCd());

    // AI-assisted analysis
    try {
      const aiResults = await this.aiAnalysis();
      if (aiResults) {
        Object.assign(metadata, aiResults);
      }
    } catch (err) {
      logger.warn({ err }, 'AI analysis failed, using static analysis only');
    }

    return metadata;
  }

  /**
   * Scan a specific category only.
   */
  async scanCategory(category: string): Promise<Partial<ProjectMetadata>> {
    switch (category) {
      case 'techStack': return this.detectTechStack();
      case 'packageManager': return this.detectPackageManager();
      case 'monorepoTool': return this.detectMonorepoTool();
      case 'folderMappings': return this.detectFolderStructure();
      case 'entryPoints': return this.detectEntryPoints();
      case 'scripts': return this.detectScripts();
      case 'build': return this.detectBuildConfig();
      case 'linting': return this.detectLinting();
      case 'testing': return this.detectTesting();
      case 'ciCd': return this.detectCiCd();
      case 'architecturePattern': {
        const ai = await this.aiAnalysis();
        return ai ? { architecturePattern: ai.architecturePattern } : {};
      }
      default: return {};
    }
  }

  // ---------------------------------------------------------------------------
  // Static Analysis Methods
  // ---------------------------------------------------------------------------

  private detectTechStack(): Pick<ProjectMetadata, 'techStack'> {
    const stack: TechStackEntry[] = [];
    const root = this.projectRoot;

    // package.json
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        stack.push({ name: 'Node.js', role: 'runtime', isPrimary: true });

        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        // Detect frameworks
        if (allDeps['react']) stack.push({ name: 'React', version: allDeps['react'], role: 'framework', isPrimary: true });
        if (allDeps['next']) stack.push({ name: 'Next.js', version: allDeps['next'], role: 'framework', isPrimary: true });
        if (allDeps['vue']) stack.push({ name: 'Vue', version: allDeps['vue'], role: 'framework', isPrimary: true });
        if (allDeps['express']) stack.push({ name: 'Express', version: allDeps['express'], role: 'framework', isPrimary: true });
        if (allDeps['fastify']) stack.push({ name: 'Fastify', version: allDeps['fastify'], role: 'framework', isPrimary: true });
        if (allDeps['hono']) stack.push({ name: 'Hono', version: allDeps['hono'], role: 'framework', isPrimary: true });

        // Build tools
        if (allDeps['vite']) stack.push({ name: 'Vite', version: allDeps['vite'], role: 'build tool' });
        if (allDeps['webpack']) stack.push({ name: 'Webpack', version: allDeps['webpack'], role: 'build tool' });
        if (allDeps['esbuild']) stack.push({ name: 'esbuild', version: allDeps['esbuild'], role: 'build tool' });
        if (allDeps['turbo']) stack.push({ name: 'Turborepo', version: allDeps['turbo'], role: 'build tool' });

        // Databases
        if (allDeps['better-sqlite3']) stack.push({ name: 'SQLite', role: 'database' });
        if (allDeps['pg'] || allDeps['postgres']) stack.push({ name: 'PostgreSQL', role: 'database' });
        if (allDeps['mysql2']) stack.push({ name: 'MySQL', role: 'database' });
        if (allDeps['mongodb'] || allDeps['mongoose']) stack.push({ name: 'MongoDB', role: 'database' });
        if (allDeps['redis'] || allDeps['ioredis']) stack.push({ name: 'Redis', role: 'database' });
        if (allDeps['prisma'] || allDeps['@prisma/client']) stack.push({ name: 'Prisma', role: 'ORM' });
        if (allDeps['drizzle-orm']) stack.push({ name: 'Drizzle', role: 'ORM' });

        // Testing
        if (allDeps['jest']) stack.push({ name: 'Jest', role: 'testing' });
        if (allDeps['vitest']) stack.push({ name: 'Vitest', role: 'testing' });
        if (allDeps['playwright']) stack.push({ name: 'Playwright', role: 'testing' });
        if (allDeps['cypress']) stack.push({ name: 'Cypress', role: 'testing' });

      } catch {
        // ignore parse errors
      }
    }

    // TypeScript detection
    if (fs.existsSync(path.join(root, 'tsconfig.json')) || fs.existsSync(path.join(root, 'tsconfig.base.json'))) {
      stack.push({ name: 'TypeScript', role: 'language', isPrimary: true });
    }

    // Go
    if (fs.existsSync(path.join(root, 'go.mod'))) {
      stack.push({ name: 'Go', role: 'language', isPrimary: true });
    }

    // Python
    if (fs.existsSync(path.join(root, 'requirements.txt')) || fs.existsSync(path.join(root, 'pyproject.toml'))) {
      stack.push({ name: 'Python', role: 'language', isPrimary: true });
    }

    // Rust
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
      stack.push({ name: 'Rust', role: 'language', isPrimary: true });
    }

    return { techStack: stack };
  }

  private detectPackageManager(): Pick<ProjectMetadata, 'packageManager'> {
    const root = this.projectRoot;
    let pm: PackageManager = 'npm';

    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) pm = 'pnpm';
    else if (fs.existsSync(path.join(root, 'yarn.lock'))) pm = 'yarn';
    else if (fs.existsSync(path.join(root, 'bun.lockb'))) pm = 'bun';
    else if (fs.existsSync(path.join(root, 'package-lock.json'))) pm = 'npm';

    return { packageManager: pm };
  }

  private detectMonorepoTool(): Pick<ProjectMetadata, 'monorepoTool'> {
    const root = this.projectRoot;
    let tool: MonorepoTool = 'none';

    if (fs.existsSync(path.join(root, 'turbo.json'))) tool = 'turborepo';
    else if (fs.existsSync(path.join(root, 'nx.json'))) tool = 'nx';
    else if (fs.existsSync(path.join(root, 'lerna.json'))) tool = 'lerna';
    else if (fs.existsSync(path.join(root, 'pnpm-workspace.yaml'))) tool = 'turborepo'; // pnpm workspace often implies turbo

    return { monorepoTool: tool };
  }

  private detectFolderStructure(): Pick<ProjectMetadata, 'folderMappings'> {
    const root = this.projectRoot;
    const mappings: FolderMapping[] = [];

    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules');

      const purposeMap: Record<string, string> = {
        src: 'Source code',
        lib: 'Library code',
        dist: 'Build output',
        build: 'Build output',
        test: 'Tests',
        tests: 'Tests',
        '__tests__': 'Tests',
        docs: 'Documentation',
        scripts: 'Build/deploy scripts',
        config: 'Configuration',
        public: 'Static assets',
        assets: 'Static assets',
        packages: 'Monorepo packages',
        apps: 'Application packages',
        services: 'Service packages',
        tools: 'Development tools',
        migrations: 'Database migrations',
        fixtures: 'Test fixtures',
        mocks: 'Test mocks',
        types: 'Type definitions',
      };

      for (const dir of dirs) {
        const purpose = purposeMap[dir.name] ?? 'Project directory';
        mappings.push({ path: dir.name, purpose });
      }
    } catch {
      // ignore errors
    }

    return { folderMappings: mappings };
  }

  private detectEntryPoints(): Pick<ProjectMetadata, 'entryPoints'> {
    const root = this.projectRoot;
    const entryPoints: EntryPoint[] = [];

    const serverFiles = ['src/index.ts', 'src/server.ts', 'src/app.ts', 'src/main.ts', 'index.ts', 'server.ts'];
    const clientFiles = ['src/main.tsx', 'src/index.tsx', 'src/App.tsx'];

    for (const file of serverFiles) {
      if (fs.existsSync(path.join(root, file))) {
        entryPoints.push({ path: file, description: 'Server entry point', type: 'server' });
      }
    }

    for (const file of clientFiles) {
      if (fs.existsSync(path.join(root, file))) {
        entryPoints.push({ path: file, description: 'Client entry point', type: 'client' });
      }
    }

    // Check monorepo packages
    const packagesDir = path.join(root, 'packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
          .filter((e) => e.isDirectory());
        for (const pkg of packages) {
          for (const file of [...serverFiles, ...clientFiles]) {
            const fullPath = path.join(packagesDir, pkg.name, file);
            if (fs.existsSync(fullPath)) {
              const type = clientFiles.includes(file) ? 'client' as const : 'server' as const;
              entryPoints.push({
                path: `packages/${pkg.name}/${file}`,
                description: `${pkg.name} entry point`,
                type,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return { entryPoints };
  }

  private detectScripts(): Pick<ProjectMetadata, 'scripts'> {
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return {};

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts) return {};

      const scripts: ProjectScript[] = Object.entries(pkg.scripts).map(([name, command]) => ({
        name,
        command: command as string,
      }));

      return { scripts };
    } catch {
      return {};
    }
  }

  private detectBuildConfig(): Pick<ProjectMetadata, 'build'> {
    const root = this.projectRoot;
    const configs: BuildConfig[] = [];

    const buildTools: Array<{ glob: string; tool: BuildConfig['tool'] }> = [
      { glob: 'vite.config.*', tool: 'vite' },
      { glob: 'webpack.config.*', tool: 'webpack' },
      { glob: 'rollup.config.*', tool: 'rollup' },
    ];

    for (const { glob: pattern, tool } of buildTools) {
      // Simple check for common extensions
      const extensions = ['.ts', '.js', '.mjs', '.cjs'];
      const baseName = pattern.replace('.*', '');
      for (const ext of extensions) {
        const filePath = path.join(root, baseName + ext);
        if (fs.existsSync(filePath)) {
          configs.push({ tool, configPath: baseName + ext });
          break;
        }
      }
    }

    if (fs.existsSync(path.join(root, 'tsconfig.json')) || fs.existsSync(path.join(root, 'tsconfig.base.json'))) {
      const configPath = fs.existsSync(path.join(root, 'tsconfig.json')) ? 'tsconfig.json' : 'tsconfig.base.json';
      configs.push({ tool: 'tsc', configPath });
    }

    return configs.length > 0 ? { build: configs } : {};
  }

  private detectLinting(): Pick<ProjectMetadata, 'linting'> {
    const root = this.projectRoot;
    const configs: LintingConfig[] = [];

    // ESLint
    const eslintFiles = ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js', 'eslint.config.mjs'];
    for (const file of eslintFiles) {
      if (fs.existsSync(path.join(root, file))) {
        configs.push({ tool: 'eslint', configPath: file });
        break;
      }
    }

    // Biome
    if (fs.existsSync(path.join(root, 'biome.json')) || fs.existsSync(path.join(root, 'biome.jsonc'))) {
      const configPath = fs.existsSync(path.join(root, 'biome.json')) ? 'biome.json' : 'biome.jsonc';
      configs.push({ tool: 'biome', configPath });
    }

    // Prettier
    const prettierFiles = ['.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.cjs', 'prettier.config.js'];
    for (const file of prettierFiles) {
      if (fs.existsSync(path.join(root, file))) {
        configs.push({ tool: 'prettier', configPath: file });
        break;
      }
    }

    return configs.length > 0 ? { linting: configs } : {};
  }

  private detectTesting(): Pick<ProjectMetadata, 'testing'> {
    const root = this.projectRoot;
    const strategies: TestingStrategy[] = [];

    // Jest
    const jestFiles = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'];
    for (const file of jestFiles) {
      if (fs.existsSync(path.join(root, file))) {
        strategies.push({ framework: 'jest', configPath: file });
        break;
      }
    }

    // Vitest
    const vitestFiles = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'];
    for (const file of vitestFiles) {
      if (fs.existsSync(path.join(root, file))) {
        strategies.push({ framework: 'vitest', configPath: file });
        break;
      }
    }

    // Check for test directories
    const testDirs = ['test', 'tests', '__tests__', 'spec'];
    for (const dir of testDirs) {
      if (fs.existsSync(path.join(root, dir))) {
        // If we already have a strategy, set the test directory
        if (strategies.length > 0) {
          strategies[0].testDirectory = dir;
        }
        break;
      }
    }

    return strategies.length > 0 ? { testing: strategies } : {};
  }

  private detectCiCd(): Pick<ProjectMetadata, 'ciCd'> {
    const root = this.projectRoot;
    const pipelines: CiCdPipeline[] = [];

    // GitHub Actions
    const ghWorkflows = path.join(root, '.github', 'workflows');
    if (fs.existsSync(ghWorkflows)) {
      try {
        const files = fs.readdirSync(ghWorkflows).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
        for (const file of files) {
          pipelines.push({
            platform: 'github_actions',
            configPath: `.github/workflows/${file}`,
            description: file.replace(/\.(yml|yaml)$/, ''),
          });
        }
      } catch {
        // ignore
      }
    }

    // GitLab CI
    if (fs.existsSync(path.join(root, '.gitlab-ci.yml'))) {
      pipelines.push({ platform: 'gitlab_ci', configPath: '.gitlab-ci.yml' });
    }

    return pipelines.length > 0 ? { ciCd: pipelines } : {};
  }

  // ---------------------------------------------------------------------------
  // AI-Assisted Analysis
  // ---------------------------------------------------------------------------

  private async aiAnalysis(): Promise<Partial<ProjectMetadata> | null> {
    const auth = getAuthInfo();
    if (!auth.token) return null;

    let client: Anthropic;
    if (auth.type === 'oauth') {
      client = new Anthropic({ authToken: auth.token });
    } else if (auth.type === 'api_key') {
      client = new Anthropic({ apiKey: auth.token });
    } else {
      return null;
    }

    // Build a summary of the project structure for AI analysis
    const projectSummary = this.buildProjectSummaryForAi();

    const response = await client.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze this project structure and return a JSON object with:
- architecturePattern: one of "monolith", "microservices", "serverless", "modular_monolith", "event_driven", "layered", "hexagonal", "cqrs", "other"
- designPatterns: array of { name: string, description: string }
- primaryLanguage: string (the main programming language)

Project structure:
${projectSummary}

Return ONLY valid JSON, no markdown fences.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const result = JSON.parse(jsonMatch[0]);
      return {
        architecturePattern: result.architecturePattern as ArchitecturePattern,
        designPatterns: result.designPatterns ?? [],
      };
    } catch {
      return null;
    }
  }

  private buildProjectSummaryForAi(): string {
    const lines: string[] = [];
    const root = this.projectRoot;

    // Top-level files
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      const files = entries.filter((e) => e.isFile()).map((e) => e.name);
      const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => e.name);

      lines.push(`Files: ${files.join(', ')}`);
      lines.push(`Directories: ${dirs.join(', ')}`);
    } catch {
      // ignore
    }

    // package.json summary
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) lines.push(`Name: ${pkg.name}`);
        if (pkg.description) lines.push(`Description: ${pkg.description}`);
        if (pkg.dependencies) lines.push(`Dependencies: ${Object.keys(pkg.dependencies).join(', ')}`);
      } catch {
        // ignore
      }
    }

    // Monorepo packages
    const packagesDir = path.join(root, 'packages');
    if (fs.existsSync(packagesDir)) {
      try {
        const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
        lines.push(`Monorepo packages: ${packages.join(', ')}`);
      } catch {
        // ignore
      }
    }

    return lines.join('\n');
  }
}
