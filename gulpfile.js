'use strict';

var gulp = require('gulp');
var cfg = require('./config.json');
var runTimestamp = Math.round(Date.now()/1000);

// Global Plugins
var path = require('path');
var del = require('del');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var mergestream = require('merge-stream');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var assign = require('lodash.assign');
var consolidate = require('gulp-consolidate');
var data = require('gulp-data');

// Style Plugins
var sass = require('gulp-sass');
// var cssnext = require('gulp-cssnext');
var autoprefixer = require('gulp-autoprefixer');
var cssnano = require('gulp-cssnano');

// Script Plugins
// var watchify = require('watchify');
var browserify = require('browserify');
var browserifyShim = require('browserify-shim');
var uglify = require('gulp-uglify');

// Graphics/Icons/Font Plugins
var spritesmith = require('gulp.spritesmith');
var iconfont = require('gulp-iconfont');
var imagemin = require('gulp-imagemin');

// Templating
var swig = require('gulp-swig');

// Web Server
var webserver = require('gulp-webserver');

/*
 * Clean the dist directory
 */
gulp.task('clean', function() {
	return del([cfg.path.dist.root+'**/*']);
});

/*
 * Process the CSS Styles
 *
 * TODO Handle Vendor CSS Styles
 *
 */
gulp.task('styles', function() {
	return gulp.src(cfg.path.src.sass+cfg.path.glob.sassfiles)
		.pipe(sass().on('error', sass.logError))
		.pipe(autoprefixer({browsers: cfg.browser.support}))
		.pipe(cssnano())
		// .pipe(cssnext({ compress: false, browsers: 'last 6 versions'}))
		.pipe(gulp.dest(cfg.path.dist.css));
});

/*
 * Process Javascript Files
 *
 * TODO Get Watchify Working
 * TODO Get Transform/Shim working
 * TODO Handle Vendor scripts
 */
gulp.task('scripts', function() {

	var customOpts = {
		entries: [cfg.path.src.js+cfg.js.entryfile],
		debug: cfg.js.debug,

	};

	// var opts = assign({},watchify.args,customOpts);

	var b = browserify(customOpts); // watchify(browserify(opts));
	// b.on('update',bundle);
	// b.on('log',gutil.log);

	// function bundle() {
		return b.bundle()
			.on('error', gutil.log.bind(gutil,'Browserify Error'))
			.pipe(source(cfg.js.outfile))
			.pipe(buffer())
            .pipe(uglify())
			.pipe(sourcemaps.init({loadMaps: true}))
			.pipe(sourcemaps.write('./'))
			.pipe(gulp.dest(cfg.path.dist.js));
	// }
});



/*
 * Spritesheeting
 */
gulp.task('sprite-smith', function () {
  var spriteData = gulp.src('./src/icons/png/**/*.png').pipe(spritesmith({
	imgName: 'icons.png',
	cssName: '_icons.css',
    imgPath: '../images/sprites/icons.png',
    padding: 20
  }));


  var imgStream = spriteData.img
	.pipe(buffer())
    //.pipe(imagemin())
	.pipe(gulp.dest('src/icons/sprites/'));

  var cssStream = spriteData.css
	.pipe(gulp.dest('src/scss/sprites/'));


  return mergestream(imgStream, cssStream);
  // return spriteData.pipe(gulp.dest('./src/icons/png/sprite/'));
});

gulp.task('sprite-images', () =>
	gulp.src('./src/icons/sprites/**/*')
		.pipe(imagemin())
		.pipe(gulp.dest('dist/images/sprites'))
);

gulp.task('sprite-icons', gulp.series('sprite-smith','styles','sprite-images'));



gulp.task('images', () =>
	gulp.src('./src/images/**/*')
		.pipe(imagemin())
		.pipe(gulp.dest('dist/images'))
);

gulp.task('fonts', () =>
	gulp.src('./src/fonts/**/*')
		.pipe(gulp.dest('dist/fonts'))
);

gulp.task('vendor', () =>
	gulp.src('./src/vendor/**/*')
        .pipe(uglify())
		.pipe(gulp.dest('dist/js/vendor'))
);


/*
 * SVG > Font Generation
 *
 * TODO Support for muliple font files to be generated (ie: icons, logos, ui etc.)
 */
gulp.task('font-icons', function(){
  return gulp.src(['./src/icons/svg/**/*.svg'])
	.pipe(iconfont({
	  fontName: 'iconfont', // required
	  prependUnicode: true, // recommended option
	  formats: ['ttf', 'eot', 'woff'], // default, 'woff2' and 'svg' are available
	  timestamp: runTimestamp, // recommended to get consistent builds when watching files
	}))
	  .on('glyphs', function(glyphs, options) {
		// CSS templating, e.g.

		options.className = 's';
		options.fontPath = '../fonts/'; // set path to font (from your CSS file if relative)
		options.glyphs = glyphs.map(mapGlyphs);

		console.log(glyphs, options);

		gulp.src('./src/templates/css/iconfont.swig.css')
			.pipe(consolidate('swig',options))
			.pipe(gulp.dest('./src/scss/fonts/'));


	  })
	.pipe(gulp.dest('./dist/fonts/'));
});

var swigoptions = {
  setup: function(swig) {
    swig.setDefaults({
      cache: false/*,
      locals: {
        nav: require('./src/template-data/common/nav.json')
      }*/
    });
  }
};

gulp.task('html-templates', function() {
  return gulp.src('./src/templates/pages/**/*.html')
	.pipe(data(getJsonData))
    .pipe(swig(swigoptions))
	.pipe(gulp.dest('./dist/'));
});


/*
 * Copy files from src to dist
 */
gulp.task('cp', function() {
	return gulp.src(cfg.path.src.root+cfg.path.glob.htmlfiles)
		.pipe(gulp.dest(cfg.path.dist.root));
})


/**
 * static web server w/ livereload
 *
 * Issue 26, Cannot GET html & gulp.src location ignored
 * https://github.com/schickling/gulp-webserver/issues/26
 */
gulp.task('server', function() {
	gulp.src('./dist')
		.pipe(webserver({
			port: 3000,
			directoryListing: {
        		enable: true,
        		path: './dist'
      		},
			open: "index.html"
		}));
});


gulp.task(
	'build', // Task Name
	gulp.series(
		'clean',
		'sprite-smith',
		// 'font-icons',
		gulp.parallel(
			'styles',
			'scripts',
            'vendor',
			'images',
            'sprite-images',
            'fonts'
		),
		'html-templates'
        // 'cp'
	)
);



/*
 * Default task to run
 */
gulp.task(
	'default', // Task Name
	gulp.series(
		'build',
		'server'
	)
);







/**
 * This is needed for mapping glyphs and codepoints.
 */
function mapGlyphs(glyph) {
  return { name: glyph.name, codepoint: glyph.unicode[0].charCodeAt(0).toString(16).toUpperCase() };
}

/**
 * Get JSON for use by SWIG Templates
 */
function getJsonData(file) {
	var fileBasename = path.basename(file.path , '.html'),
		filePathDir = path.dirname(file.path),
		templateDataDir = 'template-data',
		templateDir = 'templates';

	var dataPath = filePathDir.replace(templateDir, templateDataDir);
	var jsonFile = path.join(dataPath, fileBasename) + '.json';
		console.log('getJsonData: '+ jsonFile);
	var jsonData = require(jsonFile);

    var common = require('./src/template-data/global.json');
    var merge = require('merge'), original, cloned;
    jsonData = merge(common, jsonData);
		console.log(jsonData);

	return jsonData;
}
