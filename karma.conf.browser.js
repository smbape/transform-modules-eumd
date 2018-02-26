module.exports = function(config) {
    config.set({
        browsers: ['Firefox'],
        files: ['test/node_modules/*.js', 'test/browser/*.js'],
        frameworks: ['browserify', 'mocha'],
        preprocessors: {
            'test/node_modules/*.js': ['babel'],
            'test/browser/*.js': ['browserify']
        },
        reporters: ['mocha'],
        singleRun: true,

        browserify: {
            debug: true,
            transform: ['babelify']
        },

        babelPreprocessor: {
            options: {
                sourceMap: 'inline',
                plugins: [
                    "add-module-exports",
                    [require("./"), {
                        strict: false,
                        allowTopLevelThis: true,
                        explicitExtendedUmd: true
                    }]
                ]
            },
            filename: function(file) {
                return file.originalPath;
            },
            sourceFileName: function(file) {
                return file.originalPath.replace(/\.js$/, '.es6');
            }
        }
    });
};
