// Generated on 2015-05-08 using generator-angular 0.11.1
'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  // update the package version
  var pkgFile = 'package.json';
  var pkg = grunt.file.readJSON(pkgFile);
  var versionTokens = pkg.version.split('.');
  var version = versionTokens.pop();
  version++;
  versionTokens.push(version);
  pkg.version = versionTokens.join('.');

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  var bowerCoreFile = grunt.file.readJSON('bower.json');

  grunt.loadNpmTasks('grunt-replace');
  // grunt.loadNpmTasks("grunt-ts");
  // grunt.loadNpmTasks('grunt-contrib-sass');

  // Configurable paths for the application minified
  var appConfig = {
    app: 'src',
    dist: 'dist'
  };

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    yeoman: appConfig,
    pkg: pkg,

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{ dot: true, src: ['.tmp', '<%= yeoman.dist %>/{,*/}*'] }]
      },
      tmp: {
        files: [{ dot: true, src: ['.tmp'] }]
      }
    },

    // Automatically inject Bower components into the app
    wiredep: {
      app: {
        src: ['<%= yeoman.app %>/index.html'],
        ignorePath:  /\.\.\//
      }
    },

    // Reads HTML for usemin blocks to enable smart builds that automatically concat, minify and revision files.
    // Creates configurations in memory so additional tasks can operate on them
    useminPrepare: {
      html: '<%= yeoman.app %>/index.html',
      options: {
        dest: '<%= yeoman.dist %>',
        flow: {
          html: {
            steps: {
              js: ['concat', 'uglifyjs'],
              css: ['cssmin']
            },
            post: {}
          }
        }
      }
    },

    // Renames files for browser caching purposes
    filerev: {
      dist: {
        src: [
          '<%= yeoman.dist %>/{,*/}*.js',
          '<%= yeoman.dist %>/{,*/}*.css'
        ]
      }
    },

    // Performs rewrites based on filerev and the useminPrepare configuration
    usemin: {
      css: ['<%= yeoman.dist %>/*.css'],
      options: {
        assetsDirs: [
          '<%= yeoman.dist %>'
        ]
      }
    },


    includeSource: {
     options: {
       basePath: '../..',
       baseUrl: ''
     },
     myTarget: {
       files: { '../views/virtual-phone-app.html': '../views/virtual-phone-app-tpl.html' }
     }
    }

  });

  grunt.registerTask('build', [
    'clean:dist'
    ,'wiredep'
    ,'useminPrepare'
    ,'concat'
    ,'cssmin'
    ,'uglify'
    ,'filerev'
    ,'usemin'
    ,'clean:tmp'
    ,'includeSource'
  ]);


  grunt.registerTask('default', function () {
    grunt.task.run('build');
  });
};
