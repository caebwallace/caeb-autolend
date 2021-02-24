import path from 'path';
import dotenv from 'dotenv-defaults';

// Load environment config
dotenv.config({
    encoding: 'utf8',
    path: path.resolve(process.cwd(), '.env'),
    defaults: path.resolve(process.cwd(), '.env.defaults'),
});

// Debug ENV
const _env = {};
Object.keys(process.env).forEach(_key => {
    // Get the key value
    let _val = process.env[_key];

    // Remove NPM fields
    if (/^npm_/.test(_key)) return true;

    // Convert booleans
    if (_val === 'true') _val = true;
    else if (_val === 'false') _val = false;
    else if (_val === 'null') _val = null;

    // Convert escaped chars : |(mail=\\{\\{username\\}\\})(uid=\\{\\{username\\}\\})
    if (_val && typeof _val === 'string' && _val !== '') {
        _val = _val.replace(/\\/g, '');
    }

    // Add to humanized env
    _env[_key] = _val;
});

// Expose environment vars
export default _env;
