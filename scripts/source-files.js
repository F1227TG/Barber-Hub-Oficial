/** Source readers for legacy audits; preserve assertions while modules move. */
const fs = require('node:fs');
const path = require('node:path');

function read(root, relative) {
  let files = [relative];
  const directories = relative === 'api/index.py' ? ['api/routers', 'backend/core']
    : relative === 'backend/models.py' ? ['backend/schemas'] : [];
  if (relative === 'api/index.py') files.push('backend/application.py');
  for (const dir of directories) {
    files.push(...fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.py')).sort().map(f => `${dir}/${f}`));
  }
  return files.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}
module.exports = { read };
