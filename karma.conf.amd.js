module.exports = function(config) {
    config.set({
        browsers: ['Firefox'],
        files: [
            'test/amd/main.js',
            {
                pattern: 'test/amd/*.js',
                included: false
            },
            {
                pattern: 'test/node_modules/*.js',
                included: false
            }
        ],
        frameworks: ['mocha', 'requirejs'],
        preprocessors: {
            'test/node_modules/*.js': ['babel'],
        },
        reporters: ['mocha'],
        singleRun: true,

        babelPreprocessor: {
            options: {
                sourceMap: 'inline',
                plugins: [
                    [require("./"), {
                        addModuleExports: true,
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
