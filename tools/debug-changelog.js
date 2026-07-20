const fs = require('fs');
const markdownTree = require('markdown-tree');
const text = fs.readFileSync('CHANGELOG.md', 'utf8');
const tree = markdownTree(text);
const traverse = (node, depth = 0) => {
  if (!node) return;
  console.log(' '.repeat(depth*2)+`${node.type} depth=${node.depth} text=${JSON.stringify(node.text)}`);
  (node.children||[]).forEach(c=>traverse(c, depth+1));
};
traverse(tree);
