process.env.NODE_ENV = process.env.NODE_ENV || 'development';

global.DEVELOPMENT = process.env.NODE_ENV !== 'production';
global.SERVER = true;
global.BETA = false;
global.TOOLS = false;
global.TIMING = false;
global.TESTS = false;

require('./src/scripts/server/server');