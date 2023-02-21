let fs = require('fs');
console.log(JSON.parse(fs.readFileSync('./src/hot-pan/module.json', 'utf8')).version);