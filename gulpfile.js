require('source-map-support').install();

const fs = require('fs');
const path = require('path');
const gulp = require('gulp');
const _ = require('lodash');
const vm = require('vm');
const gulpif = require('gulp-if');
const rev = require('gulp-rev');
const sass = require('gulp-sass');
const shell = require('gulp-shell');
const cssnano = require('gulp-cssnano');
const imagemin = require('gulp-imagemin');
const autoprefixer = require('gulp-autoprefixer');
const liveServer = require('gulp-live-server');
const sizereport = require('gulp-sizereport');
const markdownTree = require('markdown-tree');
const del = require('del');
const mocha = require('gulp-spawn-mocha');
const remapIstanbul = require('remap-istanbul/lib/gulpRemapIstanbul');
const spawn = require('child_process').spawn;
const argv = require('yargs').argv;
const config = require('./config.json');
const stamp = Math.floor(Math.random() * 0xffffffff);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const HASH = _.range(0, 10).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');

let development = true;

function swallowError(e) {
	console.log(e.message);
	this.emit('end');
}

const runAsync = (command, args) => new Promise((resolve, reject) => {
	const proc = spawn(command, args)
		.on('error', reject)
		.on('exit', resolve);

	proc.stdout.pipe(process.stdout);
	proc.stderr.pipe(process.stderr);
});

const readFile = src => fs.readFileSync(src, { encoding: 'utf-8' });

const lintCode = code => (code.trim() + '\n')
	.replace(/\r\n/g, '\n')
	.replace(/  /g, '\t')
	.replace(/"/g, "'");

const npmScript = (name, args = []) => {
	const func = () => runAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', name, ...args]);
	func.displayName = `npm run ${name}`;
	return func;
};

const clean = () => del([
	'build/*',
	'temp/*',
	'!temp/.gitignore',
]);

const clearnAdmin = () => del([
	'build/assets-admin',
]);

const manifest = cb => {
	const json = {
		name: config.title,
		short_name: config.title,
		start_url: '/',
		scope: '/',
		theme_color: '#5b6ee1',
		background_color: '#5b6ee1',
		display: 'standalone',
		icons: [
			{
				src: '/android-chrome-192x192.png',
				sizes: '192x192',
				type: 'image/png'
			},
			{
				src: '/android-chrome-512x512.png',
				sizes: '512x512',
				type: 'image/png'
			}
		]
	};

	fs.writeFile('src/ts/generated/changelog.ts', JSON.stringify(json, null, 2), 'utf8', cb);
};

const sprites = () => Promise.resolve() // del(['tools/output/images/*'])
	.then(() => runAsync('node', ['src/scripts/tools/create-sprites.js']))
	.then(() => gulp.src('tools/output/images/*')
		.pipe(gulpif(!argv.fast, imagemin()))
		.pipe(gulp.dest('assets/images')));

const changelog = cb => {
	const parseFile = (path) => {
		if (!fs.existsSync(path)) {
			return [];
		}

		const text = readFile(path);
		const tree = markdownTree(text);

		const entries = [];

		const collectTokens = (node, changes) => {
			if (node.tokens) {
				for (const token of node.tokens) {
					if (token.text) {
						const text = token.text
							.replace(/^\[test\]/, '<span class="badge badge-secondary">test</span>');
						if (text.trim()) {
							changes.push(text);
						}
					}
				}
			}
			if (node.children) {
				node.children.forEach(child => collectTokens(child, changes));
			}
		};

		const traverse = (node) => {
			if (node.type === 'Heading' && node.depth === 2) {
				const version = (node.text || '').trim();
				const changes = [];
				node.children && node.children.forEach(child => collectTokens(child, changes));
				entries.push({ version, changes });
			}
			node.children && node.children.forEach(child => traverse(child));
		};

		traverse(tree);
		
		return entries;
	};

	const publicEntries = config.nochangelog ? [] : parseFile('CHANGELOG.md');
	const devEntries = config.nochangelog ? [] : parseFile('DEVCHANGELOG.md');

	const type = `{ version: string; changes: string[]; }[]`;
	const code = `/* tslint:disable */\n\nexport const CHANGELOG_PUBLIC: ${type} = ${JSON.stringify(publicEntries, null, 2)};\n\nexport const CHANGELOG_DEV: ${type} = ${JSON.stringify(devEntries, null, 2)};\n\nexport const CHANGELOG_ALL: ${type} = ${JSON.stringify([...publicEntries, ...devEntries], null, 2)};\n`;
	fs.writeFile('src/ts/generated/changelog.ts', code, 'utf8', cb);
};

const icons = cb => {
    const root1 = path.join('node_modules', '@fortawesome', 'free-solid-svg-icons');
    const root2 = path.join('node_modules', '@fortawesome', 'free-brands-svg-icons');
    const root3 = path.join('node_modules', '@fortawesome', 'free-regular-svg-icons'); // Добавили regular

	const getIconCode = src => {
		// try direct require first
		try {
			const mod = require(src);
			if (mod && mod.definition) return JSON.stringify(mod.definition);
			if (mod && mod.exports && mod.exports.definition) return JSON.stringify(mod.exports.definition);
		} catch (e) {
			// fallthrough to file parsing
		}

		const candidates = [];
		if (src.endsWith('.js')) candidates.push(src, src.replace(/\.js$/, '.d.ts'));
		else candidates.push(src);

		for (const filePath of candidates) {
			if (!fs.existsSync(filePath)) continue;
			let text = fs.readFileSync(filePath, 'utf8');

			// remove TypeScript import lines which break vm execution
			text = text.split('\n').filter(l => !l.trim().match(/^import\s+/)).join('\n');

			// If the file already contains exports.definition, try to evaluate safely in a VM
			if (text.indexOf('exports.definition') !== -1 || text.indexOf('exports.fa') !== -1) {
				const wrapper = `(function(require){ var exports = {}; var module = { exports: exports }; ${text}; return module.exports; })`;
				try {
					const fn = vm.runInThisContext(wrapper, { filename: filePath });
					const exported = fn(require);
					if (exported && exported.definition) return JSON.stringify(exported.definition);
				} catch (err) {
					// ignore and continue
				}
			}

			// Fallback: try to extract the object literal after "exports.definition ="
			const idx = text.indexOf('exports.definition');
			if (idx !== -1) {
				const assignIdx = text.indexOf('=', idx);
				if (assignIdx !== -1) {
					// find opening brace
					const openIdx = text.indexOf('{', assignIdx);
					if (openIdx !== -1) {
						// basic brace matching to find end
						let depth = 0;
						let endIdx = -1;
						for (let i = openIdx; i < text.length; i++) {
							const ch = text[i];
							if (ch === '{') depth++;
							else if (ch === '}') {
								depth--;
								if (depth === 0) { endIdx = i; break; }
							}
						}
						if (endIdx !== -1) {
							const objText = text.slice(openIdx, endIdx + 1);
							try {
								// attempt to convert JS object to JSON by removing identifiers (prefix references)
								// replace single quotes with double quotes for JSON parsing where safe
								const jsonLike = objText.replace(/(['"])\s*\+\s*(['"])*/g, '$1');
								// crude but often works: replace unquoted property names with quoted ones
								const quoted = jsonLike.replace(/(\b[a-zA-Z0-9_]+\b)\s*:/g, '"$1":');
								const parsed = JSON.parse(quoted);
								if (parsed && parsed.icon) return JSON.stringify(parsed);
							} catch (err) {
								// ignore parse errors
							}
						}
					}
				}
			}
		}

		throw new Error(`Cannot load icon from ${src}`);
	};
	const iconsTs = readFile('src/ts/client/icons.ts');
	const matched = _.uniq(iconsTs.match(/\bfa[A-Z]\S*\b/g));

	const normalizeIconName = name => name.replace(/^fa/, '').replace(/[-_]/g, '').toLowerCase();

	const findIconPath = name => {
		const normalizedName = normalizeIconName(name);
		const roots = [root1, root2, root3];

		for (const root of roots) {
			const files = fs.readdirSync(root);
			const matches = files.filter(file => (file.endsWith('.js') || file.endsWith('.d.ts')) && normalizeIconName(file.replace(/\.d\.ts$|\.js$/, '')) === normalizedName);
			if (matches.length > 0) {
				// prefer .js over .d.ts
				const pick = matches.find(f => f.endsWith('.js')) || matches.find(f => f.endsWith('.d.ts'));
				if (pick) return path.join(root, pick);
			}
		}

		return '';
	};

    let existingIcons = {};
    try {
        const existingCode = fs.readFileSync('src/ts/generated/fa-icons.ts', 'utf8');
        const existingMatches = existingCode.match(/export const (fa\w+) = (\{[^;]+\});/g);
        if (existingMatches) {
            for (const match of existingMatches) {
                const m2 = match.match(/export const (fa\w+) = (\{[^;]+\});/);
                if (m2) existingIcons[m2[1]] = m2[2];
            }
        }
    } catch (e) {}

    const icons = matched.map(m => {
        const iconPath = findIconPath(m);

        if (!iconPath) {
            if (existingIcons[m]) {
                return { name: m, code: existingIcons[m] };
            }
            console.warn(`[icons] Иконка ${m} не найдена ни в одном пакете Font Awesome, пропускаю.`);
            return null;
        }

        return {
            name: m,
            code: getIconCode(iconPath),
        };
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

    const code = `/* tslint:disable */\n\n${icons.map(({ name, code }) => `export const ${name} = ${code};`).join('\n')}`;
    fs.writeFile('src/ts/generated/fa-icons.ts', lintCode(code), 'utf8', cb);
};

const shaders = cb => {
	function getShaderCode(filePath) {
		return fs.readFileSync(filePath, 'utf8')
			.replace(/^\s*\n/gm, '').trim();
	}

	const dir = path.join('src', 'ts', 'graphics', 'shaders');
	const code = '/* tslint:disable */\n\n' + fs.readdirSync(dir)
		.map(file => [_.camelCase(file.replace(/\.glsl$/, '')), path.join(dir, file)])
		.map(([name, filePath]) => `export const ${name}Shader = \`${getShaderCode(filePath)}\`;`)
		.join('\n\n');
	fs.writeFile('src/ts/generated/shaders.ts', lintCode(code), 'utf8', cb);
};

const hash = cb => {
	const code = `export const HASH = '${HASH}';\nexport const STAMP = ${stamp};`;
	fs.writeFileSync('src/ts/generated/hash.ts', lintCode(code), 'utf8');
	fs.writeFile('src/ts/generated/hash.json', JSON.stringify({ hash: HASH, stamp }), 'utf8', cb);
};

const rollbar = cb => {
	const { environment, clientToken } = config.rollbar || {};
	const code = `export const ROLLBAR_ENV = '${environment}';\nexport const ROLLBAR_TOKEN = '${clientToken}';`;
	fs.writeFile('src/ts/generated/rollbarConfig.ts', lintCode(code), 'utf8', cb);
};

const assetsRev = cb => {
    let data = {};
    if (fs.existsSync('build/rev-manifest.json')) {
        const json = fs.readFileSync('build/rev-manifest.json', 'utf8');
        data = _.mapValues(JSON.parse(json), value => value.replace(/^\S+-([a-f0-9]{10})\.\S+$/, '$1'));
    }
    const code = `export const REV: { [key: string]: string; } = ${JSON.stringify(data, null, 4)};`;
    fs.writeFile('src/ts/generated/rev.ts', lintCode(code), 'utf8', cb);
};

const assetsCopy = () => gulp.src('assets/**/*')
	.pipe(gulpif(!argv.fast, imagemin()))
	.pipe(rev())
	.pipe(gulp.dest('build/assets'))
	.pipe(rev.manifest())
	.pipe(gulp.dest('build'));

function buildSass(name, src, dest) {
	const result = () => gulp.src([src], { base: 'src' })
		.pipe(sass({
			includePaths: ['src/styles/'],
		}).on('error', sass.logError))
		.pipe(autoprefixer('last 2 versions'))
		.pipe(gulpif(!development, cssnano({ discardComments: { removeAll: true } })))
		.pipe(gulpif(!development, rev()))
		.pipe(gulp.dest(dest));
	result.displayName = `sass (${name})`;
	return result;
}

const sassMain = buildSass('main', 'src/styles/style.scss', 'build/assets');
const sassInline = buildSass('inline', 'src/styles/style-inline.scss', 'build/assets');
const sassTools = buildSass('tools', 'src/styles/style-tools.scss', 'build/assets');
const sassAdmin = buildSass('admin', 'src/styles/style-admin.scss', 'build/assets-admin');
const sassTasks = gulp.series(sassMain, sassInline, sassTools, sassAdmin);

const testScripts = ['src/scripts/tests/**/*.js'];
const ts = npmScript('ts');

const tests = () => gulp.src(testScripts, { read: false })
	.pipe(mocha({
		exit: true,
		reporter: 'progress',
		timeout: 10000,
	}))
	.on('error', swallowError);

const coverage = () => gulp.src(testScripts, { read: false })
	.pipe(mocha({
		exit: true,
		reporter: 'progress',
		timeout: 10000,
		istanbul: {
			print: 'none',
		},
	}));

const remap = () => gulp.src('coverage/coverage.json')
	.pipe(remapIstanbul({ reports: { html: 'coverage-remapped' } }));

const size = () => gulp.src([
	'build/assets/*.js',
	'build/assets/scripts/*.js',
	'build/assets-admin/scripts/*.js',
	'build/assets/styles/*.css',
	'build/assets-admin/styles/*.css',
]).pipe(sizereport({ gzip: true, total: true }));

const music = () => gulp.src(path.join(config.assetsPath, 'assets/music/*.wav'), { read: false })
	.pipe(shell([
		'ffmpeg -y -i "<%= file.path %>" -acodec libmp3lame "<%= out(file.path, ".mp3") %>"',
		'ffmpeg -y -i "<%= file.path %>" -acodec libvorbis "<%= out(file.path, ".webm") %>"',
	], {
			templateData: {
				out: (file, ext) => path.join('assets', 'music', path.basename(file, '.wav') + ext),
			}
		}));

const serverDev = cb => {
	if (!argv.noserver) {
		const preloadPath = path.join(__dirname, 'src', 'scripts', 'preload.js');
		const serverPath = path.join(__dirname, 'src', 'scripts', 'server', 'server.js');
		const options = { env: { NODE_OPTIONS: '--inspect' } };
		const commonArgs = ['-r', preloadPath, serverPath, '--inspect', '--color', '--beta', '--admin'];
		const server = argv.adm ?
			liveServer([...commonArgs, '--adm'], options) :
			liveServer([...commonArgs, '--login', '--game', '--tools'], options);
		server.start();

		const restart = cb => {
			server.start();
			cb();
		};

		gulp.watch(['build/**/*.css']).on('change', path => server.notify({ path }));
		gulp.watch(['build/**/*.js']).on('change', path => server.notify({ path }));
		gulp.watch([
			'src/scripts/common/**/*.js',
			'src/scripts/generated/**/*.js',
			'src/scripts/graphics/**/*.js',
			'src/scripts/server/**/*.js',
			'views/index.pug',
		], { debounceDelay: 1000 }, restart);
	}

	cb();
};

let webpackScript = 'webpack-prod';
const webpackArgs = ['--'];

if (argv.parallel) {
	webpackScript = 'webpack-prod-parallel';
}

if (argv.debug) {
	webpackScript = 'webpack-debug';
}

if (argv.main) {
	webpackScript = 'webpack-main';
}

if (argv.beta) {
	webpackArgs.push('--env.beta');
}

if (argv.timing) {
	webpackArgs.push('--env.timing');
}

const webpackProd = npmScript(webpackScript, webpackArgs);
const webpackAdmin = npmScript('webpack-admin');
const sw = npmScript('sw');

const assets = gulp.series(assetsCopy, assetsRev);
const common = gulp.series(manifest, hash, rollbar, changelog, icons, shaders, assets, sassTasks);
const covRemap = gulp.series(coverage, remap);

const watch = cb => {
	gulp.watch(['CHANGELOG.md'], changelog);
	gulp.watch(['src/ts/client/icons.ts'], icons);
	gulp.watch(['src/styles/**/*.scss'], sassTasks);
	gulp.watch(['src/ts/graphics/shaders/*.glsl'], shaders);

	if (argv.coverage || argv.tests) {
		gulp.watch(['src/scripts/**/*.js'], { debounceDelay: 1000 }, argv.coverage ? covRemap : tests);
	}

	cb();
};

const watchTools = cb => {
	if (argv.sprites) {
		// gulp.watch(['src/scripts/tools/**/*.js'], { debounceDelay: 1000 }, sprites);
		gulp.watch(['src/ts/tools/trigger.txt'], sprites);
		gulp.watch(['assets/**/*'], { debounceDelay: 1000, readDelay: 1000 }, assets);
		// gulp.watch([path.join(config.assetsPath, 'assets/**/*')], { debounceDelay: 1000, readDelay: 1000 }, sprites);
	}

	cb();
};

const watchTests = cb => {
	const task = argv.coverage ? covRemap : tests;
	gulp.watch(['src/scripts/**/*.js', 'src/tests/**/*.txt', 'src/tests/**/*.png'], { debounceDelay: 1000 }, task);
	cb();
};

const setProd = cb => {
	development = false;
	cb();
};

const warnAboutTscBeingDumb = cb => {
	console.log("You're probably about to see some warnings from tsc about not being able to find certain files.");
	console.log("Don't worry about these. It's a known issue regarding circular build dependencies. The build should continue despite these errors.");
	cb();
};

const empty = cb => cb();
const tsTools = gulp.series(warnAboutTscBeingDumb, npmScript('ts-tools'));
const spritesTask = argv.sprites ? sprites : empty;
const buildSprites = gulp.series(tsTools, sprites);

const build = gulp.series(clean, setProd, common, ts, webpackProd, sw, size);
const admin = gulp.series(clearnAdmin, setProd, sassAdmin, ts, webpackAdmin);
const dev = gulp.series(clean, spritesTask, common, ts, gulp.parallel(serverDev, watch, watchTools));

module.exports = {
	music,
	admin,
	build,
	dev,
	changelog,
	sprites: buildSprites,
	default: dev,
	test: watchTests,
};
