let fs = require('fs');
console.log(JSON.parse(fs.readFileSync('./src/crunch-my-party/module.json', 'utf8')).version);