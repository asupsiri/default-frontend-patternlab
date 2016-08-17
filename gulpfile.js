/******************************************************
 * DEFAULT FRONTEND USING PATTERN LAB
 * The gulp wrapper around patternlab-node core, providing tasks to interact with the core library and move supporting frontend assets.
******************************************************/
var gulp = require('gulp'),
  path = require('path'),
  browserSync = require('browser-sync').create(),
  argv = require('minimist')(process.argv.slice(2));

// Additional plugins
var autoprefixer = require('autoprefixer'),
  //bust = require('gulp-buster'),
  //cachebust = require('gulp-cache-bust'),
  concat = require('gulp-concat'),
  cssnano = require('cssnano'),
  del = require('del'),
  gutil = require('gulp-util'),
  livereload = require('gulp-livereload'),
  modernizr = require('gulp-modernizr'),
  newer = require('gulp-newer'),
  notify = require('gulp-notify'),
  postcss = require('gulp-postcss'),
  pump = require('pump'),
  requirejs = require('requirejs'),
  runSequence = require('run-sequence').use(gulp),
  sass = require('gulp-sass'),
  styleguide = require('sc5-styleguide'),
  sourcemaps = require('gulp-sourcemaps'),
  uglify = require('gulp-uglify');

var config2 = require('./config-default.json');

/******************************************************
 * CLEAN TASKS - remove assets from destination
******************************************************/
/* Gulp task to empty the /public directory */
gulp.task('build-clean', function(done) {
    del([config2.dest.dir + '/**/*', '!' + config2.dest.dir, '!' + config2.dest.dir + 'README.md']);
    done();
});

/******************************************************
 * PROCESS TASKS
******************************************************/
var postcssProcessors = [
        autoprefixer({browsers: ['last 1 version']}),
        cssnano(),
    ];

/* Gulp task to pre-process sass and deliver the concatenated + minified CSS output */
gulp.task('process:styles', function(cb) {
    pump([
            gulp.src(config2.src.sass),
            // initialize the sourceMaps processor
            sourcemaps.init(),
            // process SASS if the file type is .scss
            sass(config2.sassOptions).on('error', sass.logError),
            // run the CSS stream through autoprefixer
            postcss(postcssProcessors),
            // write-out the CSS sourceMaps if gulp is run without '--type prod':
            sourcemaps.write("."),
            // write out the CSS in its final processed form
            gulp.dest(config2.dest.css)
        ],
        cb
    );
});


/******************************************************
 * COPY TASKS - stream assets from source to destination
******************************************************/
// JS copy
gulp.task('pl-copy:js', function(){
  return gulp.src('**/*.js', {cwd: path.resolve(paths().source.js)} )
    .pipe(gulp.dest(path.resolve(paths().public.js)));
});

// Images copy
gulp.task('pl-copy:img', function(){
  return gulp.src('**/*.*',{cwd: path.resolve(paths().source.images)} )
    .pipe(gulp.dest(path.resolve(paths().public.images)));
});

// Favicon copy
gulp.task('pl-copy:favicon', function(){
  return gulp.src('favicon.ico', {cwd: path.resolve(paths().source.root)} )
    .pipe(gulp.dest(path.resolve(paths().public.root)));
});

// Fonts copy
gulp.task('pl-copy:font', function(){
  return gulp.src('*', {cwd: path.resolve(paths().source.fonts)})
    .pipe(gulp.dest(path.resolve(paths().public.fonts)));
});

// CSS Copy
gulp.task('pl-copy:css', gulp.series('process:styles', function(cb){
  pump([
    gulp.src(path.resolve(paths().source.css, '*.css')),
    gulp.dest(path.resolve(paths().public.css)),
    browserSync.stream()
  ],
  cb
  );
}));

// Styleguide Copy everything but css
gulp.task('pl-copy:styleguide', function(){
  return gulp.src(path.resolve(paths().source.styleguide, '**/!(*.css)'))
    .pipe(gulp.dest(path.resolve(paths().public.root)))
    .pipe(browserSync.stream());
});

// Styleguide Copy and flatten css
gulp.task('pl-copy:styleguide-css', function(){
  return gulp.src(path.resolve(paths().source.styleguide, '**/*.css'))
    .pipe(gulp.dest(function(file){
      //flatten anything inside the styleguide into a single output dir per http://stackoverflow.com/a/34317320/1790362
      file.path = path.join(file.base, path.basename(file.path));
      return path.resolve(path.join(paths().public.styleguide, 'css'));
    }))
    .pipe(browserSync.stream());
});

/******************************************************
 * PATTERN LAB CONFIGURATION - API with core library
******************************************************/
//read all paths from our namespaced config file
var config = require('./patternlab-config.json'),
  patternlab = require('patternlab-node')(config);

function paths() {
  return config.paths;
}

function getConfiguredCleanOption() {
  return config.cleanPublic;
}

function build(done) {
  patternlab.build(done, getConfiguredCleanOption());
}

gulp.task('pl-assets', gulp.series(
  gulp.parallel(
    'pl-copy:js',
    'pl-copy:img',
    'pl-copy:favicon',
    'pl-copy:font',
    'pl-copy:css',
    'pl-copy:styleguide',
    'pl-copy:styleguide-css'
  ),
  function(done){
    done();
  })
);

gulp.task('patternlab:version', function (done) {
  patternlab.version();
  done();
});

gulp.task('patternlab:help', function (done) {
  patternlab.help();
  done();
});

gulp.task('patternlab:patternsonly', function (done) {
  patternlab.patternsonly(done, getConfiguredCleanOption());
});

gulp.task('patternlab:liststarterkits', function (done) {
  patternlab.liststarterkits();
  done();
});

gulp.task('patternlab:loadstarterkit', function (done) {
  patternlab.loadstarterkit(argv.kit, argv.clean);
  done();
});

gulp.task('patternlab:build', gulp.series('pl-assets', build, function(done){
  done();
}));

/******************************************************
 * SERVER AND WATCH TASKS
******************************************************/
// watch task utility functions
function getSupportedTemplateExtensions() {
  var engines = require('./node_modules/patternlab-node/core/lib/pattern_engines');
  return engines.getSupportedFileExtensions();
}
function getTemplateWatches() {
  return getSupportedTemplateExtensions().map(function (dotExtension) {
    return path.resolve(paths().source.patterns, '**/*' + dotExtension);
  });
}

function reload() {
  livereload({ start: true });
  browserSync.reload();
}

function watch() {
  gulp.watch(path.resolve(paths().source.css, '**/*.scss')).on('change', gulp.series('pl-copy:css', reload));
  gulp.watch(path.resolve(paths().source.styleguide, '**/*.*')).on('change', gulp.series('pl-copy:styleguide', 'pl-copy:styleguide-css', reload));

  var patternWatches = [
    path.resolve(paths().source.patterns, '**/*.json'),
    path.resolve(paths().source.patterns, '**/*.md'),
    path.resolve(paths().source.data, '*.json'),
    path.resolve(paths().source.fonts + '/*'),
    path.resolve(paths().source.images + '/*'),
    path.resolve(paths().source.meta, '*'),
    path.resolve(paths().source.annotations + '/*')
  ].concat(getTemplateWatches());

  gulp.watch(patternWatches).on('change', gulp.series(build, reload));
}

gulp.task('patternlab:connect', gulp.series(function(done) {
  browserSync.init({
    server: {
      baseDir: path.resolve(paths().public.root)
    },
    snippetOptions: {
      // Ignore all HTML files within the templates folder
      blacklist: ['/index.html', '/', '/?*']
    },
    notify: {
      styles: [
        'display: none',
        'padding: 15px',
        'font-family: sans-serif',
        'position: fixed',
        'font-size: 1em',
        'z-index: 9999',
        'bottom: 0px',
        'right: 0px',
        'border-top-left-radius: 5px',
        'background-color: #1B2032',
        'opacity: 0.4',
        'margin: 0',
        'color: white',
        'text-align: center'
      ]
    }
  }, function(){
    console.log('PATTERN LAB NODE WATCHING FOR CHANGES');
  });
  done();
}));

/******************************************************
 * COMPOUND TASKS
******************************************************/
gulp.task('default', gulp.series('patternlab:build'));
gulp.task('patternlab:watch', gulp.series('patternlab:build', watch));
gulp.task('serve', gulp.series('build-clean', 'patternlab:build', 'patternlab:connect', watch));
