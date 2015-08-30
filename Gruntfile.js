module.exports = function(grunt) {

  // Project configuration
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),
     banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
		    '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
		    '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
		    '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
		    ' Licensed <%= pkg.license %> */\n',

    clean: {
      files: ['dist']
    },

    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true,
      },
      dist: {
        src: ['src/<%= pkg.name %>.js'],
        dest: 'dist/<%= pkg.name %>.js'
      }
    },

    jshint: {
      src: {
        options: {
          jshintrc: 'src/.jshintrc'
        },
        src: ['src/**/*.js', 'test/**/*.js']
      },
    },

    uglify: {
    	options: {
    		banner: '<%= banner %>',
    	},
    	build: {
    		src: 'src/<%= pkg.name %>.js',
    		dest: 'dist/<%= pkg.name %>.min.js'
    	}
    },

    connect: {
    	demo: {
    		options: {
    			port: 9001,
    			keepalive: true,
 	       	open: 'http://localhost:9001/demo-events.html'
    		}
    	},

    	test: {
    		options: {
    			port: 9001,
    			keepalive: true,
 	       	open: 'http://localhost:9001/test/index.html'
    		}
    	},
    },

    less: {
    	options: {
    		sourceMap: true,
    	},
    	dist: {
    		files: {
    			"demo-events.css": "demo-events.less"
    		}
    	}
    },

    demo: {
 
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('default', ['build',]);
  grunt.registerTask('build', ['jshint', 'clean', 'concat', 'uglify', 'less']);
  grunt.registerTask('demo', ['build', 'connect:demo']);
  grunt.registerTask('test', ['build', 'connect:test']);
};
